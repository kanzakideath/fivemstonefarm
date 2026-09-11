from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
p = ROOT / 'src/ui-host/Protocol.cs'
t = p.read_text(encoding='utf-8-sig')
old = '''                    case "route.teach":
                    case "route.trial":
                    case "action.select":'''
new = '''                    case "route.teach":
                    case "route.trial":
                        if (payload.Count != 1)
                        {
                            throw new ArgumentException("Route commands accept only a mode field.");
                        }
                        result.Arguments.Add(GetEnum(payload, "mode", "mining", "washing", "gold"));
                        break;
                    case "action.select":'''
if old in t:
    if t.count(old) != 1: raise RuntimeError('Ambiguous route command switch')
    t = t.replace(old, new)
elif new not in t:
    raise RuntimeError('Route command source differs from the reviewed boundary')
p.write_text(t, encoding='utf-8', newline='\n')
p = ROOT / 'scripts/ui-tests/Test-RouteSetupBrowser.py'
t = p.read_text(encoding='utf-8')
anchor = "            page.locator('#content-stage').evaluate('(el) => { el.scrollTop = 0; }')"
addition = "\n            page.locator('#screen-routes').evaluate('(el) => { el.scrollTop = 0; }')"
if addition.strip() not in t:
    if t.count(anchor) != 1: raise RuntimeError('Browser capture boundary missing')
    t = t.replace(anchor, anchor + addition)
p.write_text(t, encoding='utf-8', newline='\n')
print('Route command payload validation tightened; complete self-tests remain mandatory.')
