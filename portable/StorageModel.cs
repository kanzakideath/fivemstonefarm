using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace FishingPilot {
 public sealed class StorageView {
  public string Epoch="", Id="", Type="", PlayerId="", Label="", LeftSpec="", RightSpec="";
  public bool Open;
  public Inventory Left=new Inventory(), Right=new Inventory();
 }
 public sealed class StorageRegistration {
  public string Id="", Type="", Epoch="", PlayerId="", Label="";
  public string[] Items=new string[0];
  public static bool ValidItem(string name){return name!=null&&Regex.IsMatch(name,"^[A-Za-z0-9_-]{1,64}$");}
  public void Validate(){
   if(Type!="trunk"||String.IsNullOrWhiteSpace(Id)||Id.Length>256||String.IsNullOrEmpty(Epoch)||String.IsNullOrEmpty(PlayerId))throw new InvalidOperationException("荷台登録が未確認です");
   if(Items==null||Items.Length>128||Items.Any(n=>!ValidItem(n))||Items.Distinct(StringComparer.Ordinal).Count()!=Items.Length)throw new InvalidOperationException("収納対象が不正です");
  }
  public bool Matches(StorageView v){return v!=null&&v.Open&&v.Left.Known&&v.Right.Known&&v.Type=="trunk"&&Id==v.Id&&Epoch==v.Epoch&&PlayerId==v.PlayerId;}
 }
 public sealed class StorageRow {
  public int Slot, Count;public string Name,Meta,Key;
  public static List<StorageRow> Parse(string spec){
   var result=new List<StorageRow>();if(spec=="-")return result;
   if(String.IsNullOrEmpty(spec)||spec.Length>24000)throw new InvalidDataException("INVALID_SNAPSHOT_SPEC");
   var seen=new HashSet<int>();
   foreach(string entry in spec.Split(',')){
    int d=entry.IndexOf('.'),d2=entry.IndexOf('.',d+1),eq=entry.LastIndexOf('=');int slot,count;
    if(d<1||d2<d+2||eq<d2+2||!Int32.TryParse(entry.Substring(0,d),out slot)||slot<1||slot>1000||!seen.Add(slot)||!Int32.TryParse(entry.Substring(eq+1),out count)||count<1)throw new InvalidDataException("INVALID_SNAPSHOT_ROW");
    string name=entry.Substring(d+1,d2-d-1),encoded=entry.Substring(d2+1,eq-d2-1);
    if(!StorageRegistration.ValidItem(name))throw new InvalidDataException("INVALID_ITEM");
    string padded=encoded.Replace('-','+').Replace('_','/');padded+=new string('=',(4-padded.Length%4)%4);
    string meta=Encoding.UTF8.GetString(Convert.FromBase64String(padded));
    if(meta.Length==0||Encoding.UTF8.GetByteCount(meta)>8192)throw new InvalidDataException("INVALID_METADATA");
    new JavaScriptSerializer().DeserializeObject(meta);
    result.Add(new StorageRow{Slot=slot,Name=name,Meta=meta,Count=count,Key=name+"."+encoded});
   }return result;
  }
 }
 public sealed class CatchLedger {
  readonly Dictionary<string,long> earned=new Dictionary<string,long>(StringComparer.Ordinal);
  readonly Dictionary<string,long> protectedNames=new Dictionary<string,long>(StringComparer.Ordinal);
  public CatchLedger(Inventory initial,IEnumerable<string> includeExisting=null){var approved=new HashSet<string>(includeExisting??new string[0],StringComparer.Ordinal);if(initial!=null&&initial.Known)foreach(var e in initial.Counts){string name=Name(e.Key);if(approved.Contains(name)){earned[e.Key]=e.Value;continue;}long n;protectedNames.TryGetValue(name,out n);protectedNames[name]=n+e.Value;}}
  public static string Name(string key){int dot=key.IndexOf('.');return dot>0?key.Substring(0,dot):"";}
  public void Credit(Inventory before,Inventory after,IEnumerable<string> allowed){
   if(before==null||after==null||!before.Known||!after.Known)return;
   var names=new HashSet<string>(allowed??new string[0],StringComparer.Ordinal);
   foreach(var e in after.Counts){long old,n;before.Counts.TryGetValue(e.Key,out old);if(e.Value<=old||!names.Contains(Name(e.Key)))continue;earned.TryGetValue(e.Key,out n);earned[e.Key]=checked(n+e.Value-old);}
  }
  public long Available(string key,Inventory current){long n,total,protect;earned.TryGetValue(key,out n);current.Counts.TryGetValue(key,out total);string name=Name(key);protectedNames.TryGetValue(name,out protect);long all=current.Counts.Where(x=>Name(x.Key)==name).Sum(x=>x.Value);return Math.Max(0,Math.Min(Math.Min(n,total),all-protect));}
  public void Debit(string key,int n){long old;earned.TryGetValue(key,out old);if(n<1||n>old)throw new InvalidOperationException("LEDGER_MISMATCH");earned[key]=old-n;}
 }
 public sealed class StorageIntent {
  public string Token="", Epoch="", StorageId="", PlayerId="", Key="", Name="", Meta="", State="planned", Receipt="";
  public int Count,SourceSlot;
  public long BeforeLeft,BeforeRight,BeforeSource;
  public Dictionary<string,int> Baseline=new Dictionary<string,int>(),Authorized=new Dictionary<string,int>();
  public static StorageIntent Plan(StorageRegistration reg,StorageView view,CatchLedger ledger){
   reg.Validate();if(!reg.Matches(view))throw new InvalidOperationException("WRONG_OR_UNVERIFIED_STORAGE");
   var allow=new HashSet<string>(reg.Items,StringComparer.Ordinal);var rows=StorageRow.Parse(view.LeftSpec);
   var hotbarNames=new HashSet<string>(rows.Where(x=>x.Slot<=5).Select(x=>x.Name),StringComparer.Ordinal);
   foreach(var row in rows.OrderByDescending(x=>x.Slot)){
    if(row.Slot<=5||hotbarNames.Contains(row.Name)||!allow.Contains(row.Name)||row.Name.StartsWith("WEAPON_",StringComparison.OrdinalIgnoreCase))continue;
    var meta=new JavaScriptSerializer().DeserializeObject(row.Meta) as Dictionary<string,object>;
    if(meta!=null&&meta.ContainsKey("container"))continue;
    long allowed=ledger.Available(row.Key,view.Left);int take=(int)Math.Min(row.Count,Math.Min(Int32.MaxValue,allowed));if(take<1)continue;
    long right;view.Right.Counts.TryGetValue(row.Key,out right);
    var p=new StorageIntent{Token=Guid.NewGuid().ToString("N"),Epoch=view.Epoch,StorageId=view.Id,PlayerId=view.PlayerId,Key=row.Key,Name=row.Name,Meta=row.Meta,Count=take,SourceSlot=row.Slot,BeforeLeft=view.Left.Counts[row.Key],BeforeRight=right,BeforeSource=row.Count};
    foreach(var r in rows){int preserve=r.Count-(r.Slot==row.Slot?take:0);if(preserve>0)p.Baseline.Add(r.Slot+"\n"+r.Name+"\n"+r.Meta,preserve);}
    p.Authorized.Add(row.Name+"\n"+row.Meta,take);return p;
   }return null;
  }
  public bool PairConfirmed(StorageView v){
   if(v==null||!v.Open||!v.Left.Known||!v.Right.Known||v.Id!=StorageId||v.Type!="trunk"||v.Epoch!=Epoch||v.PlayerId!=PlayerId)return false;
   long left,right;v.Left.Counts.TryGetValue(Key,out left);v.Right.Counts.TryGetValue(Key,out right);
   var row=StorageRow.Parse(v.LeftSpec).FirstOrDefault(x=>x.Slot==SourceSlot);
   if(row!=null&&row.Key!=Key)return false;
   long source=row==null?0:row.Count;
   return BeforeLeft-left==Count&&right-BeforeRight==Count&&BeforeSource-source==Count;
  }
  public bool ReceiptConfirmed(string receipt){
   if(String.IsNullOrEmpty(receipt))return false;string[] a=receipt.Split(' ');int count,planned,stacks;
   if(a.Length!=9||a[0]!="DEPOSITED"||!Int32.TryParse(a[1],out count)||!Int32.TryParse(a[2],out planned)||!Int32.TryParse(a[3],out stacks))return false;
   return count==Count&&planned==Count&&stacks==1&&a[4]==Encode(StorageId)&&a[5]==Encode("trunk")&&a[6]==Token&&a[7]=="COMPLETE"&&a[8]==Key+"="+Count;
  }
  static string Encode(string value){return Convert.ToBase64String(Encoding.UTF8.GetBytes(value));}
 }
 public sealed class StorageJournal {
  readonly string path;public StorageJournal(string root){path=Path.Combine(root,"storage-pending.json");}
  public StorageIntent Pending(){if(!File.Exists(path))return null;var x=new JavaScriptSerializer().Deserialize<StorageIntent>(File.ReadAllText(path));if(x==null||x.Count<1||x.Token.Length!=32||x.State=="confirmed")throw new InvalidDataException("INVALID_STORAGE_JOURNAL");return x;}
  public void Write(StorageIntent value){string tmp=path+".tmp";Directory.CreateDirectory(Path.GetDirectoryName(path));byte[] bytes=Encoding.UTF8.GetBytes(new JavaScriptSerializer().Serialize(value));using(var stream=new FileStream(tmp,FileMode.Create,FileAccess.Write,FileShare.None)){stream.Write(bytes,0,bytes.Length);stream.Flush(true);}if(File.Exists(path))File.Replace(tmp,path,path+".bak");else File.Move(tmp,path);}
  public void Confirm(StorageIntent p){p.State="confirmed";string history=Path.Combine(Path.GetDirectoryName(path),"storage-receipts.jsonl");if(File.Exists(history)&&new FileInfo(history).Length>2*1024*1024){if(File.Exists(history+".1"))File.Delete(history+".1");File.Move(history,history+".1");}File.AppendAllText(history,new JavaScriptSerializer().Serialize(p)+Environment.NewLine);if(File.Exists(path))File.Delete(path);if(File.Exists(path+".bak"))File.Delete(path+".bak");}
 }
}
