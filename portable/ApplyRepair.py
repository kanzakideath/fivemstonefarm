from pathlib import Path
import base64, zlib, hashlib, json
root=Path(__file__).resolve().parent
expected=['d89dd11745d574366b4d51d5c8f21e00d33a97e460d81958c255895dd3777144','e7ca4437822e0c7452279bf483b4d7edf8db952212b9fb00334a3a5650e7c693','021ee16318ab4a60f88e3d51f6ff662636ad213ef724a64f006ebb61e8915cdb','8fa78ad25d40bf97f2e1c1d7dd0212d666c7a091a4713c58edadd73e7aa5d1da','4ebfa0353402a65fa47d2b505efb108dcf7df8d468b410de1b01509a9a8aca54','c857b6b920906cc4b790dc46c7f6078f9b03cc137cb20ec04a95377af9c723af','1aec04c9a27bc34dd294e2eb37cf41c46ccc6661782d14e36750fac8663e0f64','026b5aa1b31840c26b37e1490aec1619446b5b49b5cabd0dc825554193022139']
chunks=[]
for i,want in enumerate(expected):
    s=(root/f'repair.part{i}.b64').read_text(encoding='utf-8-sig').strip()
    # Correct a known transport transcription, then verify against the local original.
    if i==2:s=s.replace('J+baf93JywtyhQD+K1bsasVJsDFj83Uw','J+baf93J5ywtyhQD+K1bsasV37Uw')
    got=hashlib.sha256(s.encode()).hexdigest()
    if got!=want:raise RuntimeError(f'Transport chunk {i}: length={len(s)} sha={got} expected={want}')
    chunks.append(s)
raw=zlib.decompress(base64.b64decode(''.join(chunks),validate=True))
assert hashlib.sha256(raw).hexdigest()=='470955d8b45ebce1a24dd17d23262f53f4c1f6d7b8d00ba2cd0c8f2da1438305','Source patch digest mismatch'
changes=json.loads(raw)
allowed={'Engine.cs','FishingScene.cs','BridgeRead.cs','FishCore.cs','Native.cs','Program.cs','Tests.cs','RecastPolicy.cs','SceneProbe.js','TestScene.py','README.txt','Build.ps1','CdpBridge.cs'}
assert set(changes)==allowed
prepared={}
for name,change in changes.items():
    p=root/name
    text=p.read_text(encoding='utf-8-sig') if p.exists() else ''
    got=hashlib.sha256(text.encode()).hexdigest()
    if got!=change['before']:raise RuntimeError(f'Base mismatch {name}: {got} expected {change["before"]}')
    for begin,end,replacement in sorted(change['edits'],key=lambda x:x[0],reverse=True):
        assert 0<=begin<=end<=len(text)
        text=text[:begin]+replacement+text[end:]
    assert hashlib.sha256(text.encode()).hexdigest()==change['after'],name
    prepared[name]=text
for name,text in prepared.items():
    (root/name).write_text(text,encoding='utf-8-sig' if name.endswith(('.cs','.ps1')) else 'utf-8',newline='\n')
print('PATCH_VERIFIED:',len(prepared),'readable files; no private logs or recordings included')
