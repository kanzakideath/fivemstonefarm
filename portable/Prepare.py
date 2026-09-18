from pathlib import Path
import json, math, struct, zlib, subprocess

root = Path(__file__).resolve().parent
# 24x40 binary glyphs derived from the user's recording. Each row is start,length pairs.
# No player scene, names, chat, audio, or raw inventory are included.
rows = {
'1': [[18,5],[18,6],[17,7],[15,9],[14,10],[12,12],[11,13],[8,16],[6,18],[5,19],[0,11,17,7],[0,9,17,7],[0,6,17,7],[0,5,17,7]] + [[17,7]]*26,
'2': [[9,8],[6,13],[5,15],[5,16],[4,6,16,6],[3,5,18,5],[2,5,19,4],[2,4,19,5],[1,5,20,4],[1,4,20,4],[1,4,20,4],[2,3,20,4],[20,4],[20,4],[20,4],[20,4],[19,5],[18,5],[18,5],[17,5],[15,5],[15,5],[14,5],[13,5],[12,5],[11,5],[10,5],[9,6],[8,6],[7,6],[5,5],[5,5],[4,5],[3,5],[2,5],[2,5],[1,6],[1,23],[0,24],[0,24]],
'3': [[7,9],[6,12],[5,14],[4,16],[3,6,15,6],[2,5,17,4],[1,5,18,4],[1,5,18,5],[0,5,18,5],[0,5,18,5],[18,5],[18,5],[18,5],[18,5],[18,4],[17,4],[12,8],[10,9],[10,8],[9,10],[9,12],[16,7],[18,5],[18,6],[19,5],[20,4],[20,4],[20,4],[20,4],[20,4],[0,4,20,4],[0,5,20,4],[0,6,19,5],[1,5,18,6],[1,5,18,5],[2,5,17,6],[2,6,16,6],[3,18],[4,16],[6,12]]}
templates = {}
for digit, rr in rows.items():
    assert len(rr) == 40
    mask = ['0']*960
    for y, spans in enumerate(rr):
        assert len(spans)%2 == 0
        for x, length in zip(spans[::2], spans[1::2]):
            assert 0 <= x < 24 and 0 < length <= 24-x
            mask[y*24+x:y*24+x+length] = ['1']*length
    templates[digit] = ''.join(mask)
(root/'digit-templates.json').write_text(json.dumps(templates), encoding='utf-8')

def chunk(name, data):
    return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
fixture = root/'fixtures'
fixture.mkdir(exist_ok=True)
for digit in '123':
    for r in (60,68):
        width = 22 if digit == '1' else 36
        height = 50
        data = bytearray()
        for y in range(320):
            data.append(0)
            for x in range(320):
                color = (0,0,0)
                d = math.hypot(x-160,y-160)
                if abs(d-r)<=4:
                    angle = math.degrees(math.atan2(x-160,160-y))%360
                    color = (60,70,80)
                    if 195 <= angle <= 246: color = (68,167,151)
                    if angle <= 210: color = (245,245,245)
                gx=x-(160-width//2);gy=y-(160-height//2)
                if 0<=gx<width and 0<=gy<height and templates[digit][(gy*40//height)*24+gx*24//width]=='1':
                    color=(245,245,245)
                data.extend(color)
        png = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',320,320,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(data))+chunk(b'IEND',b'')
        (fixture/('ring-'+digit+'-'+str(r)+'.png')).write_bytes(png)
(fixture/'README.txt').write_text('Recorded digit masks on synthetic circles. Not raw recording frames. These are recognition fixtures, not evidence of live FiveM success.\n',encoding='utf-8')

base='38d48da170cf3ed9778ad7206198c7f3f4522e51'
original = subprocess.check_output(['git','show',base+':src/background-bridge/CdpBridge.cs'],cwd=root.parent).decode('utf-8-sig')
assert original.count('internal static class CdpBridge') == 1
(root/'CdpBridge.cs').write_text(original.replace('internal static class CdpBridge','internal static partial class CdpBridge',1),encoding='utf-8-sig')
(root/'LICENSE').write_bytes(subprocess.check_output(['git','show',base+':LICENSE'],cwd=root.parent))

p=root/'Engine.cs'
s=p.read_text(encoding='utf-8-sig')
def replace(old,new):
    global s
    if new in s:return
    if s.count(old)!=1:raise RuntimeError('Reviewed source boundary not found: '+old[:70])
    s=s.replace(old,new,1)
replace('if(t.Epoch!=""&&epoch!=""', 'if(t.Error=="接続が変わりました"){Fail("サーバー再接続・再起動を検出しました");break;}\n     if(t.Epoch!=""&&epoch!=""')
replace('else if(r.Valid && castIssued) {', 'else if(r.Valid && castIssued && !fresh) {phase="telemetry";state.Detail="新鮮な接続確認を待っています。数字キーは送っていません";}\n     else if(r.Valid && castIssued) {')
replace('phase="full";\n       if(!fullAlert)', 'phase="full";\n       HandleNeeds(now,token);\n       if(!fullAlert)')
replace('if(needReady && now>=nextCastAt && now-lastRingAt>250)', 'if(needReady && !token.IsCancellationRequested && now-t.At<3000 && now>=nextCastAt && now-lastRingAt>250)')
p.write_text(s,encoding='utf-8-sig')
p=root/'Tests.cs';s=p.read_text(encoding='utf-8-sig').replace('recorded sanitized glyph','recorded glyph on synthetic circle').replace('all six recorded-mask fixtures present','all six recorded-glyph synthetic-circle fixtures present');p.write_text(s,encoding='utf-8-sig')
print('Prepared recorded glyph masks, synthetic recognition fixtures, pinned read-only bridge and reviewed safety fixes.')
