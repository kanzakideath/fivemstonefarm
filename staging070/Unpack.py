from pathlib import Path
import hashlib,json,lzma
p=Path(__file__).resolve().parent
b=b''.join((p/f'payload{i}.part').read_bytes() for i in range(3))
assert hashlib.sha256(b).hexdigest()=='3f501c1bbf86188ccb0f156d46ef3a0780f5d57d59c3ce7cb3722000960f1e8d','Source bundle integrity failure'
for name,text in json.loads(lzma.decompress(b)).items():
 assert Path(name).name==name and not name.startswith('.')
 (p/name).write_text(text,encoding='utf-8',newline='\n')
print('Verified and unpacked source bundle')
