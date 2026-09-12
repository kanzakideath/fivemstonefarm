from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'src/wash-position/WashPosition.cs'
b = p.read_bytes()
s = b.decode('utf-8-sig')
def one(old, new):
    global s
    if s.count(old) != 1:
        raise RuntimeError('Unexpected precision boundary: ' + old[:100])
    s = s.replace(old, new, 1)
one('if(best<0.86 || Math.Abs(bx)==Search || Math.Abs(by)==Search) continue;',
    '// Integer NCC is only a candidate search in the precise profile.\n'
    '            // Fractional interpolation can lower integer NCC even for a perfect match.\n'
    '            if(best<(precise ? 0.45 : 0.86) || Math.Abs(bx)==Search || Math.Abs(by)==Search) continue;')
one('if(precise) RefineSubpixel(reference,image,tile,bx,by,out sx,out sy);',
    'if(precise) {\n'
    '                best=RefineSubpixel(reference,image,tile,bx,by,out sx,out sy);\n'
    '                if(best<0.94) continue; // Require high confidence AFTER fractional fitting.\n'
    '            }')
one('private static void RefineSubpixel(', 'private static double RefineSubpixel(')
one('sx=fx;sy=fy;', 'sx=fx;sy=fy;return best;')
one('throw new Exception("FRACTIONAL_TRANSLATION_TEST");',
    'throw new Exception("FRACTIONAL_TRANSLATION_TEST shift="+F(shift)+" estimated="+F(m.error)+" support="+m.support);')
p.write_bytes((b'\xef\xbb\xbf' if b.startswith(b'\xef\xbb\xbf') else b'') + s.encode('utf-8'))
print('Fractional fitting requires final NCC >= 0.94 and six supported, unique tiles; standard profile unchanged.')
