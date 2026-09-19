using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
namespace FishingPilot {
 public sealed class FishPrice {public string Label="";public long Yen;}
 public sealed class Valuation {public long Total,UnknownUnits;public int UnknownKinds;public bool Known;public ItemDisplay[] Items=new ItemDisplay[0];}
 public sealed class PriceCatalog {
  readonly Dictionary<string,long> prices=new Dictionary<string,long>(StringComparer.Ordinal);
  readonly Dictionary<string,string> aliases=new Dictionary<string,string>(StringComparer.Ordinal);
  public readonly FishPrice[] Entries;
  static string Normalize(string s){return (s??"").Normalize(NormalizationForm.FormKC).Trim();}
  public PriceCatalog(string root){
   var json=new JavaScriptSerializer();Entries=json.Deserialize<FishPrice[]>(File.ReadAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"fish-prices.json")));
   foreach(var row in Entries){if(row.Yen<0||row.Yen>1000000000||String.IsNullOrWhiteSpace(row.Label)||prices.ContainsKey(Normalize(row.Label)))throw new InvalidDataException("Invalid or duplicate fish price");prices.Add(Normalize(row.Label),row.Yen);}
   string path=Path.Combine(root,"price-aliases.json");if(File.Exists(path)){var map=json.Deserialize<Dictionary<string,string>>(File.ReadAllText(path));foreach(var item in map){if(!prices.ContainsKey(Normalize(item.Value)))throw new InvalidDataException("Price alias must reference the supplied chart");aliases[Normalize(item.Key)]=Normalize(item.Value);}}
  }
  public bool TryPrice(string name,string label,out long value){
   string alias;if(aliases.TryGetValue(Normalize(name),out alias))return prices.TryGetValue(alias,out value);
   return prices.TryGetValue(Normalize(label),out value)||prices.TryGetValue(Normalize(name),out value);
  }
  public Valuation Evaluate(Inventory inventory){if(inventory==null||!inventory.Known)return new Valuation();
   var names=new Dictionary<string,long>(StringComparer.Ordinal);
   foreach(var pair in inventory.Counts){int index=pair.Key.IndexOf('.');string name=index<0?pair.Key:pair.Key.Substring(0,index);long old;names.TryGetValue(name,out old);names[name]=checked(old+pair.Value);}
   return Evaluate(names.Select(x=>new ItemDisplay{Name=x.Key,Label=inventory.Labels.ContainsKey(x.Key)?inventory.Labels[x.Key]:x.Key,Count=x.Value}),false);
  }
  public Valuation Evaluate(IEnumerable<ItemDisplay> rows,bool cumulative){
   var result=new Valuation{Known=true};var list=new List<ItemDisplay>();
   foreach(var row in rows){long count=cumulative?row.Total:row.Count;if(count<=0)continue;long price;bool known=TryPrice(row.Name,row.Label,out price);var item=new ItemDisplay{Name=row.Name,Label=row.Label,Count=count,Total=row.Total,PriceKnown=known,UnitPrice=known?price:0,Value=known?checked(price*count):0};
    if(known)result.Total=checked(result.Total+item.Value);else{result.UnknownKinds++;result.UnknownUnits=checked(result.UnknownUnits+count);}list.Add(item);}
   result.Items=list.OrderByDescending(x=>x.PriceKnown).ThenByDescending(x=>x.Value).ThenBy(x=>x.Label,StringComparer.Ordinal).ToArray();return result;
  }
 }
 public sealed class LivePanel {
  public bool Fresh,TrunkKnown,TrunkOpen;public string Weight="未確認",Source="未確認",TrunkId="",TrunkLabel="",TrunkUpdated="未確認";
  public ItemDisplay[] Held=new ItemDisplay[0],Caught=new ItemDisplay[0],TrunkItems=new ItemDisplay[0];
  public Valuation HeldValue=new Valuation(),TrunkValue=new Valuation(),SessionValue=new Valuation(),LifetimeValue=new Valuation();
 }
 public sealed class ValueSession {
  PriceCatalog catalog;readonly Dictionary<string,long> baseline=new Dictionary<string,long>(StringComparer.Ordinal);
  Valuation trunk=new Valuation();string trunkSignature="";string trunkId="",trunkLabel="",trunkTime="未確認",epoch="";
  public ValueSession(PriceCatalog prices,ItemDisplay[] caught){catalog=prices;foreach(var x in caught)baseline[x.Name]=x.Total;}
  public void Reload(PriceCatalog prices){catalog=prices;}
  public LivePanel Update(Telemetry t,CatchStatistics stats,LivePanel previous){
   if(t.Epoch!=""&&epoch!=""&&epoch!=t.Epoch){trunk=new Valuation();trunkId=trunkLabel="";trunkTime="未確認";}if(t.Epoch!="")epoch=t.Epoch;
   // Opening a different trunk replaces the total. A closed trunk is LAST CONFIRMED,
   // not proof of its present contents (another player may have changed it).
   if(t.TrunkId!=""&&t.Trunk.Known){bool changed=trunkId!=t.TrunkId;trunkId=t.TrunkId;trunkLabel=t.TrunkLabel;
    string signature=String.Join(";",t.Trunk.Counts.OrderBy(x=>x.Key,StringComparer.Ordinal).Select(x=>x.Key+"="+x.Value));if(t.TrunkOpen||changed||signature!=trunkSignature){trunk=catalog.Evaluate(t.Trunk);trunkSignature=signature;trunkTime=DateTime.Now.ToString("HH:mm:ss");}}
   var session=stats.Caught.Select(x=>{long old;baseline.TryGetValue(x.Name,out old);return new ItemDisplay{Name=x.Name,Label=x.Label,Total=Math.Max(0,x.Total-old)};});
   return new LivePanel{Fresh=t.Known,Weight=t.Known?String.Format("{0:F2} / {1:F2} kg",t.Inventory.Weight/1000.0,t.Inventory.Maximum/1000.0):previous.Weight,
    Source=t.InventorySource,Held=stats.Held,Caught=stats.Caught,HeldValue=t.Known?catalog.Evaluate(t.Inventory):previous.HeldValue,
    SessionValue=catalog.Evaluate(session,true),LifetimeValue=catalog.Evaluate(stats.Caught,true),TrunkKnown=trunk.Known,TrunkOpen=t.Known&&t.TrunkOpen,
    TrunkId=trunkId,TrunkLabel=trunkLabel,TrunkUpdated=trunkTime,TrunkValue=trunk,TrunkItems=trunk.Items};
  }
 }
 public sealed class OverlayOptions {
  public int Opacity=90,Width=360,FontSize=10,MaxRows=3;public string Position="top-left";
  public bool ShowSession=true,ShowHeldValue=true,ShowTrunkValue=true,ShowWeight=true,ShowNeeds=false,ShowStatus=true,ShowItems=false,ShowLifetime=false,ShowDiagnostics=false,ShowMovement=true;
  public void Validate(){if(Opacity<55||Opacity>100||Width<280||Width>560||FontSize<9||FontSize>16||MaxRows<0||MaxRows>8||!(new[]{"top-left","top-right","bottom-left","bottom-right"}).Contains(Position))throw new ArgumentException("オーバーレイ設定が範囲外です");}
 }
 public static class Recovery060 {
  public static bool QuietTimeout(double now,double castAt,double quietSince,bool seenRing,bool freshScene,bool freshInventory,bool open,bool present,bool busy){
   return freshScene&&freshInventory&&!open&&!present&&!busy&&quietSince>=0&&now-quietSince>=(seenRing?6000:90000)&&now-castAt>=(seenRing?6000:90000);
  }
 }
 public sealed class NudgeSchedule {
  public const double IntervalMs=600000;double due;bool previouslyEnabled;
  public void Reset(double now){due=now+IntervalMs;previouslyEnabled=false;}
  public bool Due(bool enabled,double now){if(!enabled){previouslyEnabled=false;due=now+IntervalMs;return false;}if(!previouslyEnabled){previouslyEnabled=true;due=now+IntervalMs;}return now>=due;}
  public void Attempted(double now){due=now+IntervalMs;}
  public int Remaining(double now){return Math.Max(0,(int)Math.Ceiling((due-now)/1000));}
 }
}
