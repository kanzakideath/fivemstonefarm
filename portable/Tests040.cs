using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web.Script.Serialization;
using System.Drawing;
namespace FishingPilot {
 internal static class Tests040 {
  static int count;static void Check(bool value,string name){count++;if(!value)throw new Exception("040: "+name);}
  static Inventory Inv(string spec){return Inventory.Parse("SNAPSHOT 1000 100000 3 40 "+spec);}
  static StorageView View(string left,string right){return new StorageView{Epoch="epoch",Id="trunk-test",Type="trunk",PlayerId="player-test",Open=true,LeftSpec=left,RightSpec=right,Left=Inv(left),Right=Inv(right)};}
  public static int Run(string output){count=0;
   var reg=new StorageRegistration{Id="trunk-test",Type="trunk",Epoch="epoch",PlayerId="player-test",Items=new[]{"fish"}};
   var old=Inv("0001.food.e30=5,0002.rod.e30=1,0006.fish.e30=10");
   var view=View("0001.food.e30=5,0002.rod.e30=1,0006.fish.e30=13","0001.fish.e30=2");
   var ledger=new CatchLedger(old);ledger.Credit(old,view.Left,new[]{"fish"});
   Check(ledger.Available("fish.e30",view.Left)==3,"credits only confirmed permitted increases");
   Check(ledger.Available("food.e30",view.Left)==0,"food never credited");
   var intent=StorageIntent.Plan(reg,view,ledger);Check(intent!=null&&intent.Count==3&&intent.SourceSlot==6,"exact single-stack plan");
   Check(intent.Baseline["6\nfish\n{}"]==10&&intent.Baseline["1\nfood\n{}"]==5,"initial fish and food protected");
   Check(intent.Authorized.Count==1&&intent.Authorized["fish\n{}"]==3,"authorization contains one exact metadata key");
   string encId=Convert.ToBase64String(Encoding.UTF8.GetBytes("trunk-test")),encType=Convert.ToBase64String(Encoding.UTF8.GetBytes("trunk"));
   string receipt="DEPOSITED 3 3 1 "+encId+" "+encType+" "+intent.Token+" COMPLETE fish.e30=3";
   Check(intent.ReceiptConfirmed(receipt),"legacy receipt contract reused");
   Check(!intent.ReceiptConfirmed(receipt.Replace(intent.Token,"wrong")),"operation token mandatory");
   Check(!intent.ReceiptConfirmed(receipt.Replace("fish.e30=3","food.e30=3")),"item mismatch refused");
   Check(!intent.ReceiptConfirmed(receipt.Replace(" 3 3 1 "," 2 3 1 ")),"partial receipt not success");
   var after=View("0001.food.e30=5,0002.rod.e30=1,0006.fish.e30=10","0001.fish.e30=5");
   Check(intent.PairConfirmed(after),"both inventories and source slot match");
   Check(!intent.PairConfirmed(View(after.LeftSpec,"0001.fish.e30=4")),"right-side missing unit rejected");
   Check(!intent.PairConfirmed(View("0001.food.e30=5,0002.rod.e30=1,0006.fish.e30=9",after.RightSpec)),"unrelated decrease rejected");
   after.Id="other-truck";Check(!intent.PairConfirmed(after),"wrong trunk rejected");after.Id="trunk-test";
   after.Epoch="other-epoch";Check(!intent.PairConfirmed(after),"changed connection rejected");after.Epoch="epoch";
   after.Open=false;Check(!intent.PairConfirmed(after),"closed UI cannot confirm");after.Open=true;
   ledger.Debit(intent.Key,3);Check(StorageIntent.Plan(reg,after,ledger)==null,"confirmed units never transferred twice");
   var blocked=new CatchLedger(old);blocked.Credit(old,view.Left,new[]{"fish"});var hot=View("0001.fish.e30=13,0002.rod.e30=1","0001.fish.e30=2");Check(StorageIntent.Plan(reg,hot,blocked)==null,"hotbar excluded");
   reg.Items=new[]{"food"};Check(StorageIntent.Plan(reg,view,blocked)==null,"allowlist required");reg.Items=new[]{"fish"};
   Check(!NearbyStorageService.ProvablyNotSent("ERROR AMBIGUOUS_TRANSFER"),"unknown transfer never retryable");Check(NearbyStorageService.ProvablyNotSent("ERROR STORAGE_FULL"),"preflight full can wait without transfer");
   string root=Path.Combine(Path.GetTempPath(),"fp-storage-test-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(root);
   try{var j=new StorageJournal(root);intent.State="dispatched_or_unknown";j.Write(intent);Check(new StorageJournal(root).Pending().Token==intent.Token,"pending survives process restart");j.Confirm(intent);Check(j.Pending()==null&&File.Exists(Path.Combine(root,"storage-receipts.jsonl")),"confirmation archived");}finally{Directory.Delete(root,true);}
   var gate=new PixelEvidenceGate();var a=new Ring{Valid=true,Key=4,Start=190,End=230,Pointer=210,Confidence=.85};Check(!gate.Accept(a,0)&&gate.Accept(a,15),"two consistent image observations required");
   var b=new Ring{Valid=true,Key=1,Start=190,End=230,Pointer=212,Confidence=.85};Check(!gate.Accept(b,30),"digit disagreement does not become immediate input");Check(!gate.Accept(new Ring(),40),"unknown breaks agreement");
   var explicitInitial=new CatchLedger(view.Left,new[]{"fish"});Check(StorageIntent.Plan(reg,view,explicitInitial).Count==13,"initial fish require explicit opt-in");
   var options=new Options{AutoStorage=true,HighAccuracy=true};UiCommands.Validate(options);Check(options.AutoStorage&&options.HighAccuracy,"optional settings available");
   Check((string)UiCommands.Parse("{\"action\":\"storage.register\",\"items\":[\"fish\"]}")["action"]=="storage.register","explicit authorization message");
   bool rejected=false;try{UiCommands.Parse("{\"action\":\"storage.register\",\"items\":[\"../other\"]}");}catch{rejected=true;}Check(rejected,"malformed item blocked");
   var nativeScene=CdpBridge.FishingConnection.DecodeScene("{\"ring\":{\"present\":true,\"valid\":true,\"key\":4,\"pointer\":210,\"start\":190,\"end\":230},\"notices\":[{\"kind\":\"CAUGHT\",\"id\":\"sample\"}],\"input\":{\"sent\":false}}","synthetic-scene");
   Check(nativeScene.Ring.Valid&&nativeScene.Ring.Key==4&&nativeScene.Notices.Count==1,"actual scene JSON array decoding");
   var emptyScene=CdpBridge.FishingConnection.DecodeScene("{\"ring\":{\"present\":false},\"notices\":[],\"input\":{}}","synthetic-scene");
   Check(!emptyScene.Present&&emptyScene.Notices.Count==0,"empty notice array decoding");
   string templates=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"digit-templates.json");
   foreach(int digit in new[]{1,2,3})using(var fixture=new Bitmap(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"fixtures","ring-"+digit+"-60.png")))using(var shifted=new Bitmap(420,420)){
    using(var g=Graphics.FromImage(shifted)){g.Clear(Color.Black);g.DrawImage(fixture,new Rectangle(70,40,320,320));}
    var reader=new AdaptiveRingReader(templates);var found=reader.ReadAuto(shifted);Check(found.Valid&&found.Key==digit,"off-center adaptive image acquisition "+digit);
    found=reader.ReadAuto(shifted);Check(found.Valid&&found.Key==digit,"cached local tracking "+digit);
   }
   File.WriteAllText(Path.Combine(output,"storage040.txt"),"PASS\nassertions="+count+"\nModel and production receipt checks only; not live FiveM storage.\n");return count;
  }
 }
}
internal static partial class CdpBridge {
 public static void ExportStorageExpressions(string path){
  var baseline=new Dictionary<string,int>{{"1\nfood\n{}",5},{"2\nrod\n{}",1},{"6\nfish\n{}",10}};
  var authorized=new Dictionary<string,int>{{"fish\n{}",3}};
  var d=new Dictionary<string,object>{{"deposit",DepositDeltaExpression("trunk-test","trunk",baseline,authorized,"test-operation")},{"pair",FishingStorageBridge.PairExpression()},{"targetProbe",StorageTargetExpression(false)},{"targetClick",StorageTargetExpression(true)}};
  File.WriteAllText(path,new JavaScriptSerializer().Serialize(d));
 }
}
