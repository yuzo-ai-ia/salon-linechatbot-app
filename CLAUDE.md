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

- **未定**。UI を本格的に作るフェーズで決める。現時点はデフォルトのグレースケールのみ。
