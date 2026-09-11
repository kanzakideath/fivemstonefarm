# サードパーティーソフトウェア

AI採掘機の作者が作成したソースコードは、ルートの `LICENSE` に記載された MIT License で提供します。以下のサードパーティーソフトウェアには、それぞれのライセンスが適用されます。

## AutoHotkey v2.0.26

- Copyright: AutoHotkey Foundation LLC および各コントリビューター
- ライセンス: GNU General Public License version 2、および同梱されるコンポーネント固有の条件
- 公式ソース: <https://github.com/AutoHotkey/AutoHotkey/tree/v2.0.26>
- ライセンス原文: <https://github.com/AutoHotkey/AutoHotkey/blob/v2.0.26/license.txt>

配布ZIPには、ビルドに用いた公式配布物内の `license.txt` を `licenses/AutoHotkey-license.txt` として同梱します。

## Ahk2Exe v1.1.37.02a2

- Copyright: Ahk2Exe の各コントリビューター
- ライセンス: 配布元の `COPYING` を参照
- 公式ソース: <https://github.com/AutoHotkey/Ahk2Exe/tree/Ahk2Exe1.1.37.02a2>
- ライセンス原文: <https://github.com/AutoHotkey/Ahk2Exe/blob/Ahk2Exe1.1.37.02a2/COPYING>

Ahk2Exe はビルド時だけ使用し、Releaseの配布ZIPには含めません。

## Framework7 9.1.3

- Copyright: 2014 Vladimir Kharlampidi
- ライセンス: MIT License
- 公式ソース: <https://github.com/framework7io/framework7>

オフラインUIにはiOSテーマのminified CSS/JavaScriptを同梱します。ライセンス原文は配布ZIPの `licenses/Framework7-LICENSE.txt` にあります。

Framework7 bundleに含まれる実行時依存関係も、ロックファイルで次の版に固定しています。

- Dom7 4.0.6 — MIT License — `licenses/Dom7-LICENSE.txt`
- HTM 3.1.1 — Apache License 2.0 — `licenses/HTM-LICENSE.txt`
- path-to-regexp 6.3.0 — MIT License — `licenses/Path-to-RegExp-LICENSE.txt`
- Skeleton Elements 4.0.1 — MIT License — `licenses/Skeleton-Elements-LICENSE.txt`
- SSR Window 4.0.2 / 5.0.1 — MIT License — `licenses/SSR-Window-4-LICENSE.txt` / `licenses/SSR-Window-5-LICENSE.txt`
- Swiper 12.2.0 — MIT License — `licenses/Swiper-LICENSE.txt`

Skeleton Elementsのnpm配布物は `license: MIT` と公式LICENSEへの参照を含みますが、LICENSEファイル自体を含まないため、配布ZIPには公式LICENSEと同じMITライセンス文を明示的に収録します。

## STONEVERSE UI

STONEVERSEのオフラインUIには、次の実行時依存関係をロックした版で同梱します。

- React 19.2.0 — MIT License — `licenses/React-LICENSE.txt`
- React DOM 19.2.0 — MIT License — `licenses/React-DOM-LICENSE.txt`
- Scheduler 0.27.0 — MIT License — `licenses/React-Scheduler-LICENSE.txt`
- Lucide React 0.544.0 — ISC License — `licenses/Lucide-React-LICENSE.txt`
- Zustand 5.0.8 — MIT License — `licenses/Zustand-LICENSE.txt`

これらは通常起動時に外部CDNへ接続せず、AI採掘機の実行ファイル内から読み込まれます。

## Microsoft Edge WebView2 SDK 1.0.4191.47

- Copyright: Microsoft Corporation
- ライセンス: Microsoft.Web.WebView2 NuGet packageに付属する条件
- 公式配布: <https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4191.47>

UIホストへ必要なSDK DLLとLoaderを同梱します。ライセンスとNOTICEは配布ZIPの `licenses/WebView2-LICENSE.txt` と `licenses/WebView2-NOTICE.txt` にあります。WebView2 Evergreen Runtime自体は本プロジェクトのZIPへ同梱しません。

Microsoft Windows、FiveM、Grand Theft Auto V、および記載される製品名は各権利者に帰属します。本プロジェクトはそれらの権利者による公式製品・公認製品ではありません。


## Completion voice clips

音声：VOICEVOX:四国めたん（あまあま・ノーマル）。生成音声のみを同梱し、合成エンジン・モデルは配布しません。音声の利用・再配布は https://voicevox.hiroshiba.jp/term/ と https://zunko.jp/con_ongen_kiyaku.html に従ってください。他者への再利用許諾にも同じ条件を引き継いでください。生成条件とSHA-256は `src/audio/voice-manifest.json`。
