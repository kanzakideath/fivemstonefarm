from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'src/ui-web/src/app.js'
s = p.read_text(encoding='utf-8-sig').replace('\r\n','\n')
if s.count("    version: '9.1.15',") != 1:
    raise RuntimeError('UI fixture version boundary changed')
s = s.replace("    version: '9.1.15',", "    version: '9.1.16',", 1)
old = "      correctionEnabled: { value: true, enabled: true },\n      autoEat: { value: true, enabled: true },"
new = "      correctionEnabled: { value: true, enabled: true },\n      fastWashMode: { value: true, enabled: true },\n      autoEat: { value: true, enabled: true },"
if s.count(old) != 1:
    raise RuntimeError('UI fixture control boundary changed')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
print('Updated deterministic UI fixture to v9.1.16 with FastWashMode ON.')
