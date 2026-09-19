from pathlib import Path
import urllib.request,hashlib,zipfile,io,json,lzma
r=Path(__file__).resolve().parent.parent
base='https://github.com/kanzakideath/fivemstonefarm/releases/download/fishingpilot-v0.7.2-preview/'
for name,digest,dest in [('FishingPilot-0.7.2-source.zip','c867f5f6d405fa26b65244d0fd1d1808b7be0f650366f686ac76536cc18eb710',r),('FishingPilot-0.7.2-app.zip','9f048d5f5b89e57097652dfea63f69cbf540aa3cf4ad1572d61f02458e364cc4',r/'fallback/0.7.2')]:
 with urllib.request.urlopen(urllib.request.Request(base+name,headers={'User-Agent':'FishingPilot-073-builder'}),timeout=60) as f:data=f.read(5000000)
 assert hashlib.sha256(data).hexdigest()==digest,'Published baseline changed'
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  for n in z.namelist():
   if n.endswith('/'):continue
   if name.endswith('source.zip') and not n.startswith(('portable/','staging071/','staging072/')):continue
   target=(dest/n).resolve();assert target.is_relative_to(dest.resolve()) and ':' not in n
   target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(n))
blob=b''.join((r/'staging073'/('part'+str(i)+'.xz')).read_bytes() for i in range(3))
assert hashlib.sha256(blob).hexdigest()=='32190f7b800b9820839b3a9abc464d79b13fccd56e4fea1d8b207fb6fc567956','Overlay integrity failure'
for row in json.loads(lzma.decompress(blob)):
 p=(r/row['path']).resolve();assert p.is_relative_to(r.resolve()) and row['path'].split('/')[0] in ('portable','staging071','staging072','staging073')
 old=p.read_bytes() if p.exists() else b'';assert hashlib.sha256(old).hexdigest()==row['base'],row['path']
 lines=old.decode('utf-8-sig').splitlines(keepends=True)
 for start,end,text in reversed(row['edits']):lines[start:end]=[text]
 text=''.join(lines);assert hashlib.sha256(text.encode()).hexdigest()==row['new'],row['path']
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf-8',newline='\n');print('Verified:',row['path'])
print('0.7.3 source and exact 0.7.2 rollback integrated')
