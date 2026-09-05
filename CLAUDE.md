@AGENTS.md

# salon-linechatbot-app プロジェクト規約

## プロジェクトの前提

- **目的**: 個人美容室オーナー向けの「LINE 問い合わせ自動応答 bot」。LINE で届く
  問い合わせ（営業時間・メニュー料金・アクセス・予約など）に自動で返信し、
  オーナーの対応負荷を下げる。
- **最終構成**: LINE Messaging API の webhook で受信 → Supabase の FAQ / メニュー
  データを参照 → OpenAI GPT-4o で回答生成 → LINE に返信。会話は `conversations` に記録。
- **段階的に作る**。現在のフェーズ = **環境構築のみ**（プロジェクト雛形・DB スキーマ・
  Supabase クライアント・環境変数の型）。
  - 次フェーズ: OpenAI 応答ロジック → LINE webhook 連携 → 初期データ投入 → 管理 UI。
- **DB**: Supabase。API キーは**新形式（Publishable / Secret）**を使う（旧 anon /
  service_role は使わない）。

## 命名規則

- **DB**: テーブル名・カラム名は `snake_case`。テーブル名は複数形（`faq` は集合名詞扱い）。
- **TypeScript**: 変数・関数は `camelCase`、型・React コンポーネントは `PascalCase`。
- **環境変数**: `UPPER_SNAKE_CASE`。
- **ファイル**: React コンポーネントは `PascalCase.tsx`、それ以外（lib・util 等）は
  `kebab-case.ts`。
- **ルーティング**: `app/` 配下のフォルダは `kebab-case`。API は `app/api/<name>/route.ts`。

## コーディング規約

- **TypeScript strict**。`any` は使わない。型は明示する。
- **Server Components をデフォルト**にする。`"use client"` は本当に必要なときだけ。
- **秘密情報をコードにハードコードしない**。環境変数は必ず `lib/env.ts` 経由で読む
  （`process.env` を直接あちこちで参照しない）。未設定なら分かりやすいメッセージで
  throw する（原因究明を早くするため）。
- **公開してよい環境変数だけ `NEXT_PUBLIC_` を付ける**。
  `SUPABASE_SECRET_KEY` / `OPENAI_API_KEY` / `LINE_CHANNEL_ACCESS_TOKEN` /
  `LINE_CHANNEL_SECRET` は**サーバー専用**。絶対に `NEXT_PUBLIC_` を付けない。
- **Supabase アクセスの使い分け**:
  - ブラウザ / クライアントコンポーネント → `lib/supabase/client.ts`
    （Publishable キー。RLS でデータを保護）
  - サーバー / API ルート / webhook → `lib/supabase/server.ts`
    （Secret キー。RLS をバイパスするので取り扱い注意）
- **`.env.local` は絶対にコミットしない**（`.gitignore` 済み）。テンプレートは
  `.env.local.example`。
- **コメントは日本語**で、「何を」より「なぜ」を書く。
- **エラーを握りつぶさない**。握るときはログを残し、理由をコメントする。

## DB マイグレーション

- `supabase/migrations/YYYYMMDD_*.sql` で管理（`new-migration` スキルの規約に準拠）。
- 各マイグレーションは **RLS 有効化・適切なインデックス・テーブル/カラムコメント**を含める。
- 適用は Supabase Studio の SQL Editor で手動実行する（このリポジトリでは Supabase
  CLI / MCP は未使用）。

## 配色・デザイン

- **ベーストーン**: 白＋グレー（Tailwindの`zinc`パレット）が地の色。カード背景・
  枠線・本文テキストなどはzincのまま変更しない。
- **差し色（グレージュ）**: `app/globals.css`の`@theme`に`greige-50`〜`greige-900`
  （アンカー`greige-500 = #A89A8C`、大人女性向けの上品な隠れ家サロンという
  コンセプトに合わせたくすみベージュ）を定義済み。通常操作のアクセントとして使う:
  - 主要アクションボタン（追加・保存・送信・ログイン等）: `bg-greige-800 text-white`
  - タブのアクティブ表示: `border-greige-700 text-greige-800`
  - フォーム入力のフォーカス枠: `focus:border-greige-500`
  - チェックボックスのアクセント: `accent-greige-700`
  - 見出し・カテゴリラベル等の控えめなアクセント: `text-greige-600`
- **危険操作の赤（`red-*`）は絶対に変更しない**: 削除ボタン・一斉配信の本番送信
  ボタン・「要対応」バッジ・エラー表示。危険/要注意を色で伝えているため、
  グレージュや他の色に置き換えない。
- **成功表示の緑（`green-*`）も変更しない**: フラッシュメッセージ・successバッジ。
  赤と同じ理由で、意味を伝える色は差し色と別枠にする。
- 新しい画面・コンポーネントを作る際もこの使い分け（zinc=地／greige=通常操作の
  アクセント／red=危険／green=成功）を踏襲する。色を都度思いつきで追加しない。
