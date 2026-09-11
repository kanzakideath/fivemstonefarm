from pathlib import Path
import hashlib
p=Path(__file__).resolve().parents[1]/'src/wash-position/WashPosition.cs'
s=p.read_text(encoding='utf-8')
expected='451fcced7bdb9ac4097b4d48b8e5959f7856bf0147e4b8a470649e8afc1ff4cb'
if hashlib.sha256(p.read_bytes()).hexdigest()!=expected:raise RuntimeError('Unexpected helper source')
for a,b in [('sealed class Anchor','sealed class PositionAnchor'),('new Anchor {','new PositionAnchor {'),('Anchor anchor=Json.Deserialize<Anchor>','PositionAnchor anchor=Json.Deserialize<PositionAnchor>')]:
 if s.count(a)!=1:raise RuntimeError('Unexpected DTO boundary')
 s=s.replace(a,b)
p.write_text(s,encoding='utf-8',newline='\n')
if hashlib.sha256(p.read_bytes()).hexdigest()!='eccf3b02e23f234602513860d46fad4da7a78f90992ec63b21d4879945e57123':raise RuntimeError('Compiled helper source differs from audited correction')
