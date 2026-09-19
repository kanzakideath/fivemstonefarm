from pathlib import Path
import hashlib,json,lzma
root=Path(__file__).resolve().parent.parent
payload=b''.join((root/'staging060'/('payload'+str(i)+'.xz')).read_bytes() for i in range(4))
assert hashlib.sha256(payload).hexdigest()=='519c6e2febf3de10796569b6e4deec53b5c3435dcb009c5bf45d2dbb9b6360f1','Payload integrity failure'
repaired={
 'portable/FishCore.cs':'6a370d9b42965a7a57d26e1c38ce78e165cdf0740c6f98547cf05270ad89c81a',
 'portable/StatusOverlay.cs':'ae947bc656b37bf6cdb23d5e8c4cc37e344e9218b4b35f43e79d2b640fa691ad',
 'portable/Tests060.cs':'f43747a696ced64d1726e1913394cc09c517302cf60e9e1f111a3e217ae24787'
}
rows=json.loads(lzma.decompress(payload))
for row in rows:
    path=(root/row['path']).resolve()
    assert path.is_relative_to((root/'portable').resolve()),'Unexpected target'
    old=path.read_text(encoding='utf-8-sig') if path.exists() else ''
    digest=hashlib.sha256(old.encode()).hexdigest()
    if digest==row['new'] or digest==repaired.get(row['path']):
        print('Already applied:',row['path']);continue
    assert digest==row['base'],('Base source mismatch',row['path'],digest)
    new=old
    for start,end,text in reversed(row['edits']):new=new[:start]+text+new[end:]
    assert hashlib.sha256(new.encode()).hexdigest()==row['new'],('Result mismatch',row['path'])
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('w',encoding='utf-8',newline='\n') as f:f.write(new)
    print('Verified:',row['path'])
extra='''    foreach(double pointer in new[]{195d,198d,199d,199.5d,199.99d}){controller.Reset();controller.Observe(new Ring{Valid=true,Key=4,Start=200,End=212,Pointer=pointer-4},0);check(controller.Observe(new Ring{Valid=true,Key=4,Start=200,End=212,Pointer=pointer},20,50)<0,"latency lead cannot cross an unobserved entry boundary");}
    controller.Reset();controller.Observe(new Ring{Valid=true,Key=4,Start=200,End=212,Pointer=205},0);check(controller.Observe(new Ring{Valid=true,Key=4,Start=200,End=212,Pointer=211},20,10)<0,"trailing safety margin remains protected");
    controller.Reset();controller.Observe(new Ring{Valid=true,Key=4,Start=356,End=8,Pointer=355},0);check(controller.Observe(new Ring{Valid=true,Key=4,Start=356,End=8,Pointer=359},20,2)==4,"narrow zone crossing zero remains eligible");
'''
for name,digest in repaired.items():
    path=root/name
    text=path.read_text(encoding='utf-8-sig')
    if hashlib.sha256(text.encode()).hexdigest()==digest:continue
    if name.endswith('FishCore.cs'):
        old='observedProgress>=margin && progress>=margin'
        assert text.count(old)==1
        text=text.replace(old,'observedProgress>=margin && observedProgress<=span-margin && progress>=margin')
    elif name.endswith('StatusOverlay.cs'):
        text=text.replace('Text(g,','DrawText(g,').replace('void Text(Graphics','void DrawText(Graphics')
    else:
        anchor='    var reader=new RingReader('
        assert text.count(anchor)==1
        text=text.replace(anchor,extra+anchor)
    assert hashlib.sha256(text.encode()).hexdigest()==digest,('Repair integrity failure',name)
    with path.open('w',encoding='utf-8',newline='\n') as f:f.write(text)
    print('Verified Windows-test repair:',name)
print('Verified and integrated',len(rows),'source changes and bounded-latency repair')
