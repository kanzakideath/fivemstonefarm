from pathlib import Path
import base64, hashlib, json, zlib

root = Path(__file__).resolve().parents[1]
parts = [(root / f'scripts/stationary-wait-{n}.b64').read_text().strip() for n in range(7)]
parts[0] = parts[0].replace('Y++SdRmx', 'Y++RdRmx').replace('Cv7+av//Sa', 'Cv7+9hJOCvz+av//Sa')
data = zlib.decompress(base64.b64decode(''.join(parts), validate=True))
assert hashlib.sha256(data).hexdigest() == 'b44caeb345396397c33e7f546d689b2f62d1a65127beee660c097fe90d9e98df', 'Transport SHA mismatch'
prepared = []
for row in json.loads(data):
    path = (root / row['path']).resolve()
    assert path.is_relative_to(root) and '.git' not in path.parts
    text = path.read_text(encoding='utf-8-sig').replace('\r\n', '\n') if path.exists() else ''
    if row['base'] is None:
        assert not path.exists(), f'New file already exists: {path}'
    else:
        assert path.exists() and hashlib.sha256(text.encode()).hexdigest() == row['base'], f'Base changed: {path}'
    lines = text.splitlines(keepends=True)
    for start, end, content in reversed(row['edits']):
        assert 0 <= start <= end <= len(lines)
        lines[start:end] = [content]
    value = ''.join(lines)
    assert hashlib.sha256(value.encode()).hexdigest() == row['after'], f'Result mismatch: {path}'
    prepared.append((path, (b'\xef\xbb\xbf' if row['bom'] else b'') + value.encode()))
for path, value in prepared:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value)
print(f'Applied {len(prepared)} files after verifying all base and result hashes.')

# Preserve the real migration contract; version validation remains unchanged.
for name in ['README.md', 'docs/AI採掘機_使い方.txt']:
    p = root / name
    s = p.read_text(encoding='utf-8-sig')
    assert 'v9.0.2への初回更新時' not in s
    s += '\n## STONEの履歴互換\n\n設定とセーブは別管理です。v9.0.2への初回更新時には確認済みログだけを取り込み、削除済み記録や推定値は復元しません。この履歴移行・確認済み報酬の保存方式は維持します。\n'
    s = s.replace('操作範囲の喪失を通知して停止します', '操作範囲の復帰を待ち、自動再開します。戻らない間は作業は進みません')
    s = s.replace('荷台満杯・補充石不足時の停止', '荷台満杯時の停止と、確定した石在庫0での補充待ち')
    s = s.replace('`STATIONARY_SITE_VERIFIED`、`STATIONARY_READINESS`、`STATIONARY_CARGO_OPENED`', '`STATIONARY_WAIT`、`STATIONARY_AUTO_RESUME`')
    s = s.replace('`STATIONARY_MOTION_BLOCKED`', '`STATIONARY_MOTION_REJECTED`')
    p.write_text(s, encoding='utf-8')
p = root / 'config/AI採掘機.ini'
s = p.read_text(encoding='utf-8-sig')
s = s.replace('ForwardCorrection=1', 'ForwardCorrection=0').replace('RecoveryEnabled=1', 'RecoveryEnabled=0')
s = s.replace('[ViewLock]\nEnabled=1', '[ViewLock]\nEnabled=0')
s = s.replace('; AI採掘機 v9.1.15 設定テンプレート', '; AI採掘機 v9.1.15 設定テンプレート\n; 移動・視点補正の旧設定はこの版では使用しません。ゲームの物理座標を固定する設定ではありません。')
p.write_text(s, encoding='utf-8-sig')

# AutoHotkey identifiers are case-insensitive. Avoid test parameters shadowing
# the scripted adapter globals; still include/run the actual production module.
p = root / 'scripts/ui-tests/StationaryWaitHarness.ahk'
s = p.read_text(encoding='utf-8-sig')
for old, new in [('Reset(name, responses) {', 'Reset(name, scriptedResponses) {'),
                 ('Responses := responses,', 'Responses := scriptedResponses,'),
                 ('TransitionFarmState(state, message, generation, task) {', 'TransitionFarmState(nextState, message, generation, task) {'),
                 ('State.farmState := state', 'State.farmState := nextState')]:
    assert s.count(old) == 1, old
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8-sig')
