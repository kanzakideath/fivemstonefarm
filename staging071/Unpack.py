from pathlib import Path
import hashlib,json,lzma
p=Path(__file__).resolve().parent
b=b''.join((p/f'payload{i}.part').read_bytes() for i in range(3))
assert hashlib.sha256(b).hexdigest()=='a08c8666b3ded3e6c06efc1b9c679dcb8bd731c62801333f84ce814dad5f9cca','Source bundle integrity failed'
for name,text in json.loads(lzma.decompress(b)).items():
 assert Path(name).name==name and not name.startswith('.') and name!='Unpack.py'
 (p/name).write_text(text,encoding='utf-8',newline='\n')
print('Verified and extracted registered-device source')
