from pathlib import Path
import gzip,json,hashlib
p=Path(__file__).resolve().parent
b=b''.join((p/('bundle'+str(i)+'.part')).read_bytes() for i in range(4))
assert hashlib.sha256(b).hexdigest()=='9f7ee6cd26cb0a23aed94254fddd89808d2416f76e868f6518224d5b824ef05e','Source bundle integrity mismatch'
for name,text in json.loads(gzip.decompress(b)).items():
 assert Path(name).name==name and not name.startswith('.'),name
 (p/name).write_text(text,encoding='utf-8',newline='\n')
print('Source bundle verified and extracted')
