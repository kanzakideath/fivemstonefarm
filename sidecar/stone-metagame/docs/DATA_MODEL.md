# データモデルと追加方法

## 状態の所有者

永続状態は `MetaGameState` が唯一の正本です。UI は `MetaGameSnapshot` の読み取り表示であり、独自集計を保存しません。単独プレビューの LocalStorage はデザイン確認専用です。

主な領域:

- `Profile`: 表示名、アイコン、フレーム、称号、初回導線、作成日時
- `Mining`: 検証済み累計、日別件数、XP、レベル、Mining Points、チケット、
  Stone Fragment、稼働時間
- `Gacha`: 累計、レア度別件数、バナー別Pity、連敗・神引き統計、履歴
- `Collection`: item ID ごとの所有数、初回・最終獲得日時、NEW確認、お気に入り
- `Achievements`: achievement ID ごとの解除日時と報酬受取状態
- `RewardGrants`: レベル・好感度・実績報酬の発生／受取日時
- `OwnedTitles`: 解除済み称号と解除日時
- `Settings`: 音量、Mute、Effect Quality、演出速度、reduced motion
- `ProcessedMiningEventIds`: 採掘成功通知の重複排除窓
- `RecentDrawReceipts`: ガチャ要求の冪等性保持

保存時は JSON 本文と SHA-256 を envelope に入れ、一時ファイルを書いてから置換します。読み込みで本文またはハッシュが不正なら `.bak` を試します。

## カタログ

- `data/gacha.json`: 確率、通貨、Pity、演出パラメーター
- `data/banners.json`: コスト、期間、pool、PICK UP、バナー別確率・保証・Pity
- `data/items.json`: 全アイテム。追加は配列末尾へ一意 ID で行う。`image` は `procedural://stone/<種>`、`procedural://frame/<種>`、`procedural://avatar/<種>` のいずれかを指定し、UIが種類と形状差へ変換する
- `data/affinity.json`: 採掘累計閾値。`mined` を昇順にする
- `data/achievements.json`: 条件と表示。条件型は C# と demo adapter の両方に実装する
- `data/level-rewards.json`: レベル節目と報酬
- `data/titles.json`: 装備可能な称号
- `data/assets.json`: バナー／アイコン／fallbackのAsset Registry
- `data/messages.json`: 節目・低レア・高レア・NEW の文章群

確率は整数 basis points で管理し、全レア度合計を必ず10,000にします。アイテムの `weight` は同一レア度内の相対抽選重みで、0以下は禁止です。

## 互換性ルール

- item/achievement/rank ID は公開後に変更・再利用しない
- 表示名、説明、色、演出時間は ID を維持したまま変更可能
- 状態フィールド削除はしない。非推奨化して移行期間を置く
- 新しい achievement condition を追加したら、本番 C#、プレビュー、検証テストを同時に更新する
- 新しい報酬型を追加したら、Grant解決・受取・UI表示・移行テストを同時に更新する
- Pity counterはバナーIDとtrack IDの組で保存し、別バナーへ暗黙共有しない
- UI に秘密アイテムの未取得名・説明を露出しない
