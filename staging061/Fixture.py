"""Local CDP-shaped test peer. No real FiveM, remote hosts, or game APIs."""
import asyncio,json,argparse
from pathlib import Path
from http import HTTPStatus
from websockets.asyncio.server import serve
p=argparse.ArgumentParser();p.add_argument('--root',required=True);a=p.parse_args();root=Path(a.root);root.mkdir(parents=True,exist_ok=True)
urls=['nui://game/ui/root.html','https://cfx-nui-ox_target/web/index.html','https://cfx-nui-ox_inventory/web/build/index.html','https://cfx-nui-ox_lib/web/build/index.html']
def frame(i):return {'frame':{'id':'f'+str(i),'loaderId':'load'+str(i),'url':urls[i]}}
tree=frame(0);tree['childFrames']=[frame(i) for i in range(1,4)]
def data():
 mode=(root/'mode.txt').read_text().strip() if (root/'mode.txt').exists() else 'right-null'
 done=(root/'digit.sent').exists();ring=(root/'rod.sent').exists() and not done
 left={'id':'28','type':'player','label':'Player fixture','weight':150000 if mode=='full' else 1200 if done else 1000,'max':150000,'used':1,'slots':40,'items':[{'slot':10,'name':'salmon','count':2 if done else 1,'meta':'{}','weight':1200 if done else 1000,'label':'サケ'}]}
 inv={'version':6,'revision':2 if done else 1,'source':'fixture','unknownDelta':False,'open':mode=='inventory-open','left':None if mode=='left-null' else left,'right':None}
 scene={'w':700,'h':560,'hunger':80,'water':80,'busy':False,'ring':{'valid':ring,'present':ring,'key':4,'pointer':215,'start':200,'end':240,'radius':60,'stamp':'fixture-round'},'input':{'sent':False},'delivery':'idle','notices':[{'kind':'CAUGHT','id':1}] if done else []}
 return inv,scene
async def handler(ws):
 try:
  async for text in ws:
   m=json.loads(text);method=m['method'];result={}
   if method=='Page.getFrameTree':result={'frameTree':tree}
   elif method=='Runtime.enable':
    for i in range(4):await ws.send(json.dumps({'method':'Runtime.executionContextCreated','params':{'context':{'id':i+1,'origin':urls[i],'name':'','auxData':{'isDefault':True,'frameId':'f'+str(i)}}}}))
   elif method=='Runtime.evaluate':
    expression=m.get('params',{}).get('expression','');inv,scene=data()
    value=json.dumps(inv if '__fpInventory060' in expression else scene,ensure_ascii=False)
    result={'result':{'type':'string','value':value}}
   else:
    await ws.send(json.dumps({'id':m['id'],'error':{'code':-32601,'message':'Unexpected method: '+method}}));continue
   await ws.send(json.dumps({'id':m['id'],'result':result}))
 except Exception as e:
  with (root/'peer.log').open('a',encoding='utf-8') as f:f.write(type(e).__name__+' '+str(e)+'\n')
async def request(connection,request):
 if request.path=='/json':return connection.respond(HTTPStatus.OK,json.dumps([{'url':urls[0],'webSocketDebuggerUrl':'ws://127.0.0.1:13172/devtools/page/fixture'}]))
 if request.path=='/health':return connection.respond(HTTPStatus.OK,'test peer ready')
async def main():
 async with serve(handler,'127.0.0.1',13172,process_request=request):
  (root/'ready').write_text('ready');await asyncio.Future()
asyncio.run(main())
