from pathlib import Path
import re
p = Path(__file__).resolve().with_name('Apply-FastWash.py')
s = p.read_text(encoding='utf-8')
pattern = re.compile(r"s = once\(s,\n'''        IniWrite Config\.washForwardCorrection, temporarySettingsPath, \"Washing\", \"ForwardCorrection\"\\n        IniWrite Config\.washPostCompletionSettleMs, temporarySettingsPath, \"Washing\", \"PostCompletionSettleMs\"''',\n'''        IniWrite Config\.washForwardCorrection, temporarySettingsPath, \"Washing\", \"ForwardCorrection\"\\n        IniWrite Config\.fastWashMode, temporarySettingsPath, \"Washing\", \"FastMode\"\\n        IniWrite Config\.washPostCompletionSettleMs, temporarySettingsPath, \"Washing\", \"PostCompletionSettleMs\"''', 'persist fast'\)")
replacement = '''persist_old = \'\'\'        IniWrite Config.washForwardCorrection, temporarySettingsPath, "Washing", "ForwardCorrection"\\n        IniWrite Config.washPostCompletionSettleMs, temporarySettingsPath, "Washing", "PostCompletionSettleMs"\'\'\'\npersist_new = \'\'\'        IniWrite Config.washForwardCorrection, temporarySettingsPath, "Washing", "ForwardCorrection"\\n        IniWrite Config.fastWashMode, temporarySettingsPath, "Washing", "FastMode"\\n        IniWrite Config.washPostCompletionSettleMs, temporarySettingsPath, "Washing", "PostCompletionSettleMs"\'\'\'\npersist_count = s.count(persist_old)\nif persist_count != 2:\n    raise RuntimeError(f'persist fast: expected two settings writers, got {persist_count}')\ns = s.replace(persist_old, persist_new)'''
s2, n = pattern.subn(replacement, s, count=1)
if n != 1:
    raise RuntimeError(f'Could not patch persist-fast patcher block: {n}')
p.write_text(s2, encoding='utf-8')
print('FastWash patcher now updates both settings persistence writers.')
