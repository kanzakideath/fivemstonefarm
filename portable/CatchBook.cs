using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Web.Script.Serialization;
namespace FishingPilot {
 public sealed class ItemCount { public string Name="",Label=""; public long Count,Caught; }
 // Inventory is a replacement snapshot, not an incrementing fishing counter.
 public sealed class CatchBook {
  readonly object gate=new object(); readonly string path;
  Dictionary<string,long> totals=new Dictionary<string,long>(StringComparer.Ordinal);
  Dictionary<string,long> held=new Dictionary<string,long>(StringComparer.Ordinal);
  readonly Dictionary<string,string> labels=new Dictionary<string,string>(StringComparer.Ordinal);
  readonly Queue<string> creditOrder=new Queue<string>();
  readonly HashSet<string> credited=new HashSet<string>(StringComparer.Ordinal);
  bool known;double at;
  public CatchBook(string root){path=Path.Combine(root,"catch-totals.json");if(File.Exists(path))try {var d=new JavaScriptSerializer().Deserialize<Dictionary<string,long>>(File.ReadAllText(path));if(d!=null&&d.Count<=2048&&d.All(x=>StorageRegistration.ValidItem(x.Key)&&x.Value>=0))totals=d;}catch{} }
  public void Observe(Inventory inv, IDictionary<string,string> names,double time){lock(gate){if(inv==null||!inv.Known){known=false;return;}held=Group(inv);known=true;at=time;if(names!=null)foreach(var e in names)if(StorageRegistration.ValidItem(e.Key)&&e.Value!=null&&e.Value.Length<=120)labels[e.Key]=e.Value;}}
  public void Credit(string cycle,Inventory before,Inventory after,bool inventoryTouched){lock(gate){if(inventoryTouched||String.IsNullOrEmpty(cycle)||credited.Contains(cycle)||before==null||after==null||!before.Known||!after.Known)return;
   var protectedNames=new HashSet<string>(StringComparer.Ordinal);
   if(!String.IsNullOrEmpty(after.Spec))foreach(var row in StorageRow.Parse(after.Spec))if(row.Slot<=5||row.Name.StartsWith("WEAPON_",StringComparison.OrdinalIgnoreCase))protectedNames.Add(row.Name);
   var a=Group(before);var b=Group(after);bool changed=false;
   foreach(var e in b){long old,n;a.TryGetValue(e.Key,out old);totals.TryGetValue(e.Key,out n);if(e.Value>old&&!protectedNames.Contains(e.Key)){totals[e.Key]=checked(n+e.Value-old);changed=true;}}
   credited.Add(cycle);creditOrder.Enqueue(cycle);if(creditOrder.Count>4096)credited.Remove(creditOrder.Dequeue());
   if(changed){string tmp=path+".tmp";File.WriteAllText(tmp,new JavaScriptSerializer().Serialize(totals));if(File.Exists(path))File.Replace(tmp,path,path+".bak");else File.Move(tmp,path);}
  }}
  public static Dictionary<string,long> Group(Inventory inv){var d=new Dictionary<string,long>(StringComparer.Ordinal);foreach(var e in inv.Counts){string n=CatchLedger.Name(e.Key);if(!StorageRegistration.ValidItem(n))continue;long old;d.TryGetValue(n,out old);d[n]=checked(old+e.Value);}return d;}
  string Label(string name){string label;return labels.TryGetValue(name,out label)?label:name;}
  public ItemCount[] Held {get{lock(gate)return held.Where(x=>x.Value>0).OrderByDescending(x=>totals.ContainsKey(x.Key)).ThenBy(x=>x.Key,StringComparer.Ordinal).Select(x=>new ItemCount{Name=x.Key,Label=Label(x.Key),Count=x.Value,Caught=totals.ContainsKey(x.Key)?totals[x.Key]:0}).ToArray();}}
  public ItemCount[] Totals {get{lock(gate)return totals.Where(x=>x.Value>0).OrderByDescending(x=>x.Value).ThenBy(x=>x.Key,StringComparer.Ordinal).Select(x=>new ItemCount{Name=x.Key,Label=Label(x.Key),Caught=x.Value,Count=held.ContainsKey(x.Key)?held[x.Key]:0}).ToArray();}}
  public bool Fresh(double now){lock(gate)return known&&now>=at&&now-at<2500;}
 }
}
