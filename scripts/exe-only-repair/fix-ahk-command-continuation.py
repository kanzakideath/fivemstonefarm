"""Fix the exact AHK continuation rejected by the Windows validation build.

This is an idempotent, narrow correction on the isolated EXE-only candidate.
It does not change navigation behavior, storage receipts, or live settings.
"""
from pathlib import Path

path = Path('src/exe-route-navigation.ahk')
raw = path.read_bytes()
bom = raw.startswith(b'\xef\xbb\xbf')
text = raw.decode('utf-8-sig')
old = '" " State.targetHwnd " " processId " " QuoteCommandArg(cancelPath)'
lines = text.splitlines(keepends=True)
matched = 0
already_fixed = 0
for index, line in enumerate(lines):
    stripped = line.strip()
    if stripped == old:
        if index == 0:
            raise RuntimeError('Unexpected continuation at beginning of file')
        indentation = line[:len(line) - len(line.lstrip())]
        ending = '\r\n' if line.endswith('\r\n') else '\n' if line.endswith('\n') else ''
        lines[index] = indentation + '. ' + old + ending
        matched += 1
    elif stripped == '. ' + old:
        already_fixed += 1
if matched + already_fixed != 1:
    raise RuntimeError(f'Expected exactly one known command continuation, found {matched} pending and {already_fixed} fixed')
if matched:
    path.write_bytes((''.join(lines)).encode('utf-8-sig' if bom else 'utf-8'))
    print('Corrected known AHK command continuation; full compiler validation is still required.')
else:
    print('Known AHK command continuation is already corrected.')
