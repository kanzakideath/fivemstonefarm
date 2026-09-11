#!/usr/bin/env python3
"""Build-time only. Runtime uses the three bundled WAVs, with no TTS server.

VOICEVOX:春日部つむぎ (style 8). Generated audio remains subject to the
voice library's terms; see src/audio/VOICE_CREDITS.md. Models are not shipped.
"""
import hashlib
import io
import json
import sys
import wave
from pathlib import Path
from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile

root = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
lib = next(root.rglob('libvoicevox_onnxruntime.so.*'), None)
if lib is None:
    lib = next(root.rglob('voicevox_onnxruntime.dll'), None)
if lib is None:
    raise RuntimeError('VOICEVOX ONNX Runtime was not found')
dictionary = next(p.parent for p in root.rglob('sys.dic'))
model = next(root.rglob('0.vvm'))
synth = Synthesizer(Onnxruntime.load_once(filename=str(lib)), OpenJtalk(dictionary),
                    acceleration_mode='CPU', cpu_num_threads=2)
with VoiceModelFile.open(model) as voice:
    synth.load_voice_model(voice)
out.mkdir(parents=True, exist_ok=True)
clips = [
    ('stone-mining-complete', '石掘りが終わったよ！', 'いしほりが終わったよ！'),
    ('stone-washing-complete', '石洗いが終わったよ！', '石洗いが終わったよ！'),
    ('gold-panning-complete', '砂金取りが終わりました！', '砂金取りが終わりました！'),
]
manifest = {'schema': 1, 'credit': 'VOICEVOX:春日部つむぎ', 'styleId': 8,
            'coreVersion': '0.16.4', 'modelsVersion': '0.16.0', 'clips': []}
for name, display_text, synthesis_text in clips:
    query = synth.create_audio_query(synthesis_text, 8)
    query.speed_scale = 1.04
    query.intonation_scale = 1.10
    query.volume_scale = 0.90
    data = synth.synthesis(query, 8)
    with wave.open(io.BytesIO(data), 'rb') as wav:
        seconds = wav.getnframes() / wav.getframerate()
        if not (0.6 <= seconds <= 10) or wav.getsampwidth() != 2:
            raise RuntimeError('Invalid generated audio: ' + name)
    (out / (name + '.wav')).write_bytes(data)
    manifest['clips'].append({'file': name + '.wav', 'text': display_text,
                             'synthesisText': synthesis_text, 'seconds': seconds,
                             'sha256': hashlib.sha256(data).hexdigest()})
(out / 'completion-voices.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(out / 'VOICE_CREDITS.md').write_text('''# 作業完了音声\n\n音声生成: **VOICEVOX:春日部つむぎ**\n\n本アプリの3種類の完了WAVはVOICEVOX COREを用いて事前生成しています。\n本アプリ利用中に音声サーバーへ通信せず、モデル・エンジンの追加インストールも不要です。\nWindows SAPIの声を変更しただけのものではありません。\n\n生成音声は本リポジトリのソースコード用MITライセンスとは区別されます。\n再利用・再配布する場合もVOICEVOXおよび春日部つむぎの音声利用規約に従い、\n「VOICEVOX:春日部つむぎ」のクレジットを保持してください。\n\n- https://voicevox.hiroshiba.jp/term/\n- https://github.com/VOICEVOX/voicevox_vvm#音声ライブラリ利用規約\n- https://tsumugi-official.studio.site/rule\n\nモデル、辞書、音声エンジン本体、キャラクター画像は同梱していません。\n特定のアニメ作品や声優本人による録音・公式コラボレーションを示すものではありません。\n''', encoding='utf-8')
print(json.dumps(manifest, ensure_ascii=False, indent=2))
