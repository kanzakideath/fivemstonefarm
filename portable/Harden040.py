from pathlib import Path
r=Path(__file__).parent

def edit(name,old,new,count=1):
 p=r/name;s=p.read_text(encoding='utf-8-sig')
 if s.count(old)!=count:raise RuntimeError(f'{name}: expected {count}, got {s.count(old)}: {old[:60]}')
 p.write_text(s.replace(old,new),encoding='utf-8-sig')
if 'DecodeScene(string raw,string url)' in (r/'FishingScene.cs').read_text(encoding='utf-8-sig'):
 print('JSON decoder corrections already applied');raise SystemExit(0)
# Deserialize<T> materializes untyped nested arrays as ArrayList; the original cast expected object[].
# DeserializeObject is the existing miner/CDP wire contract and preserves object[] consistently.
edit('Program.cs','var d=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(json);','var d=new JavaScriptSerializer().DeserializeObject(json) as Dictionary<string,object>;')
edit('FishingScene.cs','   var d=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(raw);var r=(Dictionary<string,object>)d["ring"];','''   return DecodeScene(raw,url);
  }
  public static FishingPilot.Scene DecodeScene(string raw,string url){
   var d=new JavaScriptSerializer().DeserializeObject(raw) as Dictionary<string,object>;if(d==null)throw new InvalidOperationException("INVALID_SCENE");
   var r=GetObject(d,"ring");''')
edit('FishingScene.cs','if(d.ContainsKey("notices"))foreach(var n in (object[])d["notices"])','if(d.ContainsKey("notices")&&d["notices"] is object[])foreach(var n in (object[])d["notices"])')
edit('Tests040.cs','   string templates=Path.Combine','''   var nativeScene=CdpBridge.FishingConnection.DecodeScene("{\\"ring\\":{\\"present\\":true,\\"valid\\":true,\\"key\\":4,\\"pointer\\":210,\\"start\\":190,\\"end\\":230},\\"notices\\":[{\\"kind\\":\\"CAUGHT\\",\\"id\\":\\"sample\\"}],\\"input\\":{\\"sent\\":false}}","synthetic-scene");
   Check(nativeScene.Ring.Valid&&nativeScene.Ring.Key==4&&nativeScene.Notices.Count==1,"actual scene JSON array decoding");
   var emptyScene=CdpBridge.FishingConnection.DecodeScene("{\\"ring\\":{\\"present\\":false},\\"notices\\":[],\\"input\\":{}}","synthetic-scene");
   Check(!emptyScene.Present&&emptyScene.Notices.Count==0,"empty notice array decoding");
   string templates=Path.Combine''')
print('Corrected scene and UI JSON decoding with production decoder tests')
