using System;
using System.Collections.Generic;
using System.Linq;
using System.IO;
using System.Web.Script.Serialization;
namespace FishingPilot {
 public sealed class ItemDisplay {public string Name="",Label="";public long Count,Total;}
 // Current inventory is a replacement snapshot, never an increment-only counter.
 public sealed class CatchStatistics {
  readonly string file; readonly Dictionary<string,long> totals=new Dictionary<string,long>(StringComparer.Ordinal);
  readonly Dictionary<string,string> labels=new Dictionary<string,string>(StringComparer.Ordinal);
  public ItemDisplay[] Held=new ItemDisplay[0], Caught=new ItemDisplay[0];
  public bool CurrentKnown; public double ObservedAt;
  public CatchStatistics(string root){file=Path.Combine(root,"catch-history.json");if(File.Exists(file))try{var saved=new JavaScriptSerializer().Deserialize<Dictionary<string,long>>(File.ReadAllText(file));foreach(var x in saved)if(StorageRegistration.ValidItem(x.Key)&&x.Value>=0)totals[x.Key]=x.Value;}catch{}RefreshCaught();}
  static string Name(string key){int n=key.IndexOf('.');return n>0?key.Substring(0,n):key;}
  public void Observe(Inventory inv,double at){if(inv==null||!inv.Known){CurrentKnown=false;return;}CurrentKnown=true;ObservedAt=at;foreach(var x in inv.Labels)if(x.Value.Length<=128)labels[x.Key]=x.Value;
   var counts=new Dictionary<string,long>(StringComparer.Ordinal);foreach(var x in inv.Counts){string name=Name(x.Key);if(inv.ProtectedNames.Contains(name))continue;long old;counts.TryGetValue(name,out old);counts[name]=checked(old+x.Value);}
   Held=counts.Where(x=>x.Value>0).OrderBy(x=>x.Key,StringComparer.Ordinal).Select(x=>new ItemDisplay{Name=x.Key,Label=Label(x.Key),Count=x.Value,Total=Total(x.Key)}).ToArray();RefreshCaught();
  }
  string Label(string n){string l;return labels.TryGetValue(n,out l)&&!String.IsNullOrWhiteSpace(l)?l:n;}
  long Total(string n){long v;return totals.TryGetValue(n,out v)?v:0;}
  void RefreshCaught(){Caught=totals.Where(x=>x.Value>0).OrderByDescending(x=>x.Value).ThenBy(x=>x.Key,StringComparer.Ordinal).Select(x=>new ItemDisplay{Name=x.Key,Label=Label(x.Key),Total=x.Value}).ToArray();}
  public void Credit(Inventory before,Inventory after){if(before==null||after==null||!before.Known||!after.Known)return;bool changed=false;
   foreach(var x in after.Counts){string n=Name(x.Key);if(after.ProtectedNames.Contains(n)||n.StartsWith("WEAPON_",StringComparison.OrdinalIgnoreCase))continue;long old;before.Counts.TryGetValue(x.Key,out old);if(x.Value<=old)continue;totals[n]=checked(Total(n)+x.Value-old);changed=true;}
   if(changed){Directory.CreateDirectory(Path.GetDirectoryName(file));string temp=file+".tmp";File.WriteAllText(temp,new JavaScriptSerializer().Serialize(totals));if(File.Exists(file))File.Replace(temp,file,file+".bak");else File.Move(temp,file);}Observe(after,ObservedAt);RefreshCaught();
  }
 }
}
