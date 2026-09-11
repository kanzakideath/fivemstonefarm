from pathlib import Path
import subprocess
R=Path(__file__).resolve().parents[1]
def edit(path,old,new):
 p=R/path;b=p.read_bytes();s=b.decode('utf-8-sig').replace('\r\n','\n')
 if s.count(old)!=1:raise RuntimeError('Unexpected boundary: '+path+' '+old[:80])
 p.write_bytes((b'\xef\xbb\xbf' if b.startswith(b'\xef\xbb\xbf') else b'')+s.replace(old,new).encode())
edit('src/ui-web/src/index.html','''                <div class="route-steps">''','''                <section class="route-feedback" aria-live="polite" aria-label="石洗いの位置補正">
                  <strong>石洗いの位置補正 · 入力と効果</strong>
                  <p id="route-wash-position">未計測。FiveMを前面にして石洗いを開始してください。</p>
                  <p>開始位置を保持し、洗浄後に景色の静止とずれを測ります。ずれた時だけ短いW入力で補正し、動かなければ成功扱いしません。</p>
                </section>
                <div class="route-steps">''')
edit('src/ui-web/src/index.html','視点は前面では相対入力、バックグラウンドではFiveM専用入力で補正し、別の画面には入力しません。食事は個数が減ったときだけ成功として記録します。','石洗いの自動補正はFiveM前面で画面を確認しながら行います。補正OFFでは位置保持を行いません。石洗い以外の視点復旧と食事の確認は従来どおりです。')
edit('src/ui-web/src/app.js','    const cycle = route.cycle;', "    document.getElementById('route-wash-position').textContent = route.washFeedback\n      || '未計測。FiveMを前面にして石洗いを開始してください。';\n    const cycle = route.cycle;")
edit('scripts/ui-tests/Test-RouteSetupBrowser.py',"            assert '近接' in page.locator('#route-trial').inner_text()",'''            page.evaluate("""() => {
                const s = window.aiMinerTest.getState(); s.revision += 1;
                s.routes.washFeedback = '補正確認 / W入力 2回・計80ms / ずれ 0.1px';
                window.aiMinerTest.setState(s);
            }""")
            assert '80ms' in page.locator('#route-wash-position').inner_text()
            assert '近接' in page.locator('#route-trial').inner_text()''')
edit('docs/EXE_ONLY_ROUTES.md','## v9.1.9の入口','## v9.1.10の入口')
edit('docs/EXE_ONLY_ROUTES.md','4. 画面上のカウントダウン後、W/A/S/Dとマウスだけで荷台まで歩きます。ダッシュ・ジャンプ・乗車・UI操作は記録しません。','4. 準備画面で見やすい視点にして立ち止まり、F6で記録を開始します。記録中はツールが勝手に下を向けません。W/A/S/Dとマウスだけで荷台まで歩きます。ダッシュ・ジャンプ・乗車・UI操作は記録しません。')
edit('docs/EXE_ONLY_ROUTES.md','撮影・視点補正中は動かないでください。','照合点の撮影中は動かないでください。')
edit('docs/EXE_ONLY_ROUTES.md','## 通常の動作','''## その場で作業と荷台を開ける場合（近接収納）

徒歩記録の代わりに **この位置で近接収納を確認（歩かない）** を使えます。現在地の作業ボタンと登録荷台IDを、移動・視点変更・アイテム転送なしで確認します。成功後に自動収納をONにしてください。実行時も毎回荷台と転送結果を確認します。近接設定は離れた車両への到達を保証しません。

## 通常の動作''')
with (R/'docs/EXE_ONLY_ROUTES.md').open('a',encoding='utf-8') as f:f.write('\n\n石洗いの位置補正、近接収納、自然視点のルート記録の最新手順は `RELEASE_v9.1.10.md` を参照してください。補正ONの石洗いではFiveMを前面に保ち、開始位置の景色を保持します。\n')
# Preserve original BOMs for Windows PowerShell 5.1 and Japanese source paths.
for name in subprocess.check_output(['git','ls-files','-z'],cwd=R).decode().split('\0'):
 p=R/name
 if not name or not p.is_file():continue
 if p.suffix not in ['.ps1','.ahk','.ini','.txt','.md']:continue
 old=subprocess.run(['git','show','dc2f4bfbfb23a6ff1d30731f576a7c0d9a7d3ede:'+name],cwd=R,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 if old.returncode==0 and old.stdout.startswith(b'\xef\xbb\xbf') and not p.read_bytes().startswith(b'\xef\xbb\xbf'):
  p.write_bytes(b'\xef\xbb\xbf'+p.read_bytes())
print('Visible wash feedback and four-viewport coverage applied. No real game tested.')
