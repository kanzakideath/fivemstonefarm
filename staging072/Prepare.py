from pathlib import Path
import urllib.request,hashlib,zipfile,io,json,lzma
r=Path(__file__).resolve().parent.parent
base='https://github.com/kanzakideath/fivemstonefarm/releases/download/fishingpilot-v0.7.1-preview/'
for name,digest,dest in [('FishingPilot-0.7.1-source.zip','a65508f08df51e227e5722971dd4d905950f96c5c1340e1cead97348267fe493',r),('FishingPilot-0.7.1-app.zip','50db8e7c6cac4ec7a1660c21b913e70d1b474d7313cf7d0c6539e9ac96d7fed8',r/'fallback/0.7.1')]:
 with urllib.request.urlopen(urllib.request.Request(base+name,headers={'User-Agent':'FishingPilot-072-builder'}),timeout=60) as f:data=f.read(5000000)
 assert hashlib.sha256(data).hexdigest()==digest,'Published baseline changed'
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  for n in z.namelist():
   if n.endswith('/'):continue
   if name.endswith('source.zip') and not n.startswith(('portable/','staging071/')):continue
   target=(dest/n).resolve();assert target.is_relative_to(dest.resolve()) and ':' not in n
   target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(n))
blob=b''.join((r/'staging072'/('part'+str(i)+'.xz')).read_bytes() for i in range(4))
assert hashlib.sha256(blob).hexdigest()=='645d9cef0b303438802098ecdfb5c503df3fc7fecd88129dd12f0c59f2874fd0','Overlay integrity failure'
for row in json.loads(lzma.decompress(blob)):
 p=(r/row['path']).resolve();assert p.is_relative_to(r.resolve()) and row['path'].split('/')[0] in ('portable','staging071','staging072')
 old=p.read_bytes() if p.exists() else b'';assert hashlib.sha256(old).hexdigest()==row['base'],row['path']
 lines=old.decode('utf-8-sig').splitlines(keepends=True)
 for start,end,text in reversed(row['edits']):lines[start:end]=[text]
 text=''.join(lines);assert hashlib.sha256(text.encode()).hexdigest()==row['new'],row['path']
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf-8',newline='\n');print('Verified:',row['path'])
# Keep lambda parameter names distinct from the new registration local.
v=r/'staging071/View.cs'
t=v.read_text(encoding='utf-8').replace('FirstOrDefault(d=>d.Enabled&&d.ClientKey==req.ClientKey)','FirstOrDefault(x=>x.Enabled&&x.ClientKey==req.ClientKey)').replace('Count(d=>d.Enabled)','Count(x=>x.Enabled)')
v.write_text(t,encoding='utf-8',newline='\n')
(r/'portable/OwnerRuntime.cs').write_text((r/'staging071/View.cs').read_text(encoding='utf-8').replace('[assembly:System.Reflection.AssemblyVersion("0.7.2.0")]',''),encoding='utf-8',newline='\n')
(r/'portable/OwnerAccount.cs').write_bytes((r/'staging071/Account.cs').read_bytes())
# Source files are UTF-8, independently of the Windows runner's ANSI locale.
for name in ('TestLease.py','TestAdminUi.py'):
 p=r/'staging072'/name
 text=p.read_text(encoding='utf-8').replace('.read_text()',".read_text(encoding='utf-8-sig')")
 p.write_text(text,encoding='utf-8',newline='\n')
print('0.7.2 source and exact 0.7.1 rollback integrated')
