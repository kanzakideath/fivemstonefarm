from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'scripts/Test-StoneProgressContract.ps1'
raw = p.read_bytes()
s = raw.decode('utf-8-sig')
old = r'StartMining\(\*\)'
new = r'StartMining\(startMode\s*:=\s*"",\s*\*\)'
if s.count(old) != 2:
    raise RuntimeError('Expected the two original start ownership assertions')
s = s.replace(old, new)
p.write_bytes((b'\xef\xbb\xbf' if raw.startswith(b'\xef\xbb\xbf') else b'') + s.encode('utf-8'))
print('Updated only the StartMining signature in both ownership assertions; all boundary and generation checks retained.')
