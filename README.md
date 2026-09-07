# salon-linechatbot-app

個人美容室オーナー向けの「LINE 問い合わせ自動応答 bot」。LINE で届く問い合わせ
（営業時間・メニュー料金・アクセス・予約など）に自動で返信し、オーナーの対応負荷を下げる。

## 概要

- **目的**: よくある問い合わせへの一次対応を自動化し、オーナーが手を止める回数を減らす。
  自動で答えられない問い合わせは検知してオーナーの LINE に通知する。
- **仕組み**: LINE Messaging API の webhook で受信 → Supabase の FAQ / メニューデータを
  参照 → OpenAI で回答生成 → LINE に返信。会話は `conversations` テーブルに記録する。
- **現在のステータス**: 学習用に段階的に構築したプロジェクト。Vercel に本番デプロイ済みで、
  架空サロン「hair salon Lin」（大人女性向けの隠れ家サロンという設定）のデータで稼働中。
  実店舗のデータに差し替えれば実運用できる構成。
- **公開 URL**: <https://salon-linechatbot-app.vercel.app>
  （トップは疎通確認ページ。管理画面は <https://salon-linechatbot-app.vercel.app/admin> ・`ADMIN_PASSWORD` でログイン）
- 開発の経緯・設計判断はフェーズ単位で [`DEVLOG.md`](./DEVLOG.md) に記録している。

## 主な機能

### LINE 自動応答

webhook でメッセージを受信 → 署名検証 → FAQ・メニューを知識ベースとして読み込み →
OpenAI で回答を生成 → LINE に返信 → 会話ログを保存。ベクトル検索は使わず、
個人店規模（数十件）の FAQ をそのままプロンプトに入れる方針。

### 要対応エスカレーション

回答生成時に「自動で答えきれない問い合わせか」を判定（`needs_human`）。該当する場合、
`conversations` に記録したうえで、オーナー自身の LINE へプッシュ通知する
（返信・記録処理は止めない副次機能として実装）。

### 管理画面（`/admin`）

簡易パスワード認証（HMAC 署名付き Cookie）で保護。スマホ操作前提の UI。

- **FAQ 管理** — 質問・回答・カテゴリの追加／編集／削除
- **メニュー・料金管理** — 追加／編集／削除／並び替え（一覧の ↑↓ ボタン）
- **会話ログ閲覧** — 読み取り専用。直近 50 件を新しい順に表示。要対応の行にバッジ
- **お知らせ一斉配信** — 友だち全員への配信。送信前プレビュー確認、テスト送信、配信履歴付き

| FAQ 管理の一覧                                    | メニュー・料金管理の一覧                                    |
| ------------------------------------------------- | ----------------------------------------------------------- |
| ![FAQ 管理の一覧画面](./docs/images/IMG_6245.PNG) | ![メニュー・料金管理の一覧画面](./docs/images/IMG_6255.PNG) |

オーナー自身が管理画面を操作するための手順は
[`docs/OPERATIONS.md`](./docs/OPERATIONS.md)（オーナー向け運用マニュアル・スマホ前提・
非エンジニア向け・画面キャプチャ付き）にまとめている。

## 技術構成

| 領域           | 使用技術                                                           |
| -------------- | ------------------------------------------------------------------ |
| フレームワーク | Next.js 16（App Router / Server Components 中心 / Server Actions） |
| 言語           | TypeScript（strict、`any` 不使用）                                 |
| スタイル       | Tailwind CSS v4（`@theme` で色を定義）                             |
| データベース   | Supabase（PostgreSQL）。API キーは新形式（Publishable / Secret）   |
| AI             | OpenAI（既定 `gpt-4o-mini`、`OPENAI_MODEL` で変更可）              |
| メッセージング | LINE Messaging API（webhook 受信・reply / push / broadcast 送信）  |
| ホスティング   | Vercel（GitHub 連携で `main` push 時に自動デプロイ）               |

### Next.js 16 についての注意

このリポジトリの Next.js は、一般的に知られている API・規約と異なる破壊的変更を含む
（例: `middleware.ts` → `proxy.ts`、`connection()` / `colorScheme` の扱いなど）。
実装前に [`AGENTS.md`](./AGENTS.md) と `node_modules/next/dist/docs/` の該当ガイドを
確認すること。

## 処理の流れ

```
LINE ユーザー
   │  メッセージ送信
   ▼
POST /api/line/webhook
   │  1. 生ボディを読む → x-line-signature を検証（不正なら 401）
   │  2. FAQ + 有効なメニューを知識ベースとして取得（Supabase）
   │  3. OpenAI で回答生成 → { answer, confidence, needsHuman }
   │  4. LINE reply API で返信
   │  5. conversations に会話ログを保存（失敗しても返信は止めない）
   │  6. needsHuman なら オーナーの LINE へ push 通知
   ▼
正常な署名なら常に 200 を返す（200 以外だと LINE が再送し二重返信になるため）
```

## ディレクトリ構成

| パス                   | 役割                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/`                 | ルーティング。`api/line/webhook`（webhook 本体）、`admin/`（管理画面）、`page.tsx`（疎通確認ページ）                                       |
| `lib/`                 | ドメインロジック。`env.ts`（環境変数の集約）、`supabase/`、`openai/`、`line/`、`faq/`、`menus/`、`conversations/`、`broadcasts/`、`admin/` |
| `components/`          | 管理画面の React コンポーネント（フォーム・ナビ等）                                                                                        |
| `supabase/migrations/` | DB マイグレーション（SQL）。Studio で手動適用                                                                                              |
| `supabase/seed/`       | 動作確認用のサンプルデータ（マイグレーションではない）                                                                                     |
| `scripts/`             | 手元確認用スクリプト（`try:answer` / `try:webhook`）                                                                                       |
| `proxy.ts`             | `/admin/*` の未ログインアクセスをログイン画面へリダイレクトするルートガード                                                                |

## セットアップ

### 前提

- Node.js 20.6 以降（`--env-file` を使うため）と npm
- Supabase / OpenAI / LINE Developers の各アカウント

### 1. 取得と依存インストール

```bash
git clone <このリポジトリ>
cd salon-linechatbot-app
npm install
```

### 2. 環境変数

```bash
cp .env.local.example .env.local
```

`.env.local` に実際の値を記入する。各変数の意味は下の「[環境変数](#環境変数)」を参照。
`.env.local` はコミットしない（`.gitignore` 済み）。

### 3. データベース

Supabase プロジェクトを作成し、Studio の SQL Editor で
`supabase/migrations/` の SQL をファイル名の日付順に実行する。

1. `20260903_init_schema.sql` — `faq` / `menus` / `conversations`（RLS・インデックス・コメント付き）
2. `20260905_add_needs_human_to_conversations.sql` — `conversations.needs_human` 追加
3. `20260906_create_broadcasts.sql` — `broadcasts`（一斉配信の履歴）

### 4. 初期データ投入（任意）

動作確認用に `supabase/seed/sample_data.sql` を SQL Editor で実行すると、
架空サロンの FAQ・メニューが入る（再実行すると全消し → 入れ直し）。実運用では
管理画面から実データを登録する。

### 5. 起動と動作確認

```bash
npm run dev
```

- <http://localhost:3000> — 「Supabase 接続成功 / faq テーブル: N 件」と表示されれば疎通 OK
- <http://localhost:3000/admin/login> — `ADMIN_PASSWORD` でログイン

LINE 実機テストは、`next dev` をトンネル（ngrok 等）で公開し、LINE Developers Console の
Webhook URL に `<公開URL>/api/line/webhook` を登録して行う。

## 環境変数

すべて `lib/env.ts` 経由で読む（`process.env` を直接参照しない）。**実値はこの表・
リポジトリに一切載せない。** テンプレートは `.env.local.example`。

| 変数名                                 | 役割                                                      | 必須 | 公開                             |
| -------------------------------------- | --------------------------------------------------------- | ---- | -------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase プロジェクトの URL                               | 必須 | `NEXT_PUBLIC_`（ブラウザに露出） |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable キー（旧 anon 相当・RLS 有効）                | 必須 | `NEXT_PUBLIC_`（ブラウザに露出） |
| `SUPABASE_SECRET_KEY`                  | Secret キー（旧 service_role 相当・RLS バイパス）         | 必須 | サーバー専用                     |
| `OPENAI_API_KEY`                       | OpenAI API キー（回答生成）                               | 必須 | サーバー専用                     |
| `OPENAI_MODEL`                         | 使用モデル。未設定なら `gpt-4o-mini`                      | 任意 | サーバー専用                     |
| `LINE_CHANNEL_ACCESS_TOKEN`            | reply / push / broadcast 送信用トークン                   | 必須 | サーバー専用                     |
| `LINE_CHANNEL_SECRET`                  | webhook 署名検証（`x-line-signature`）用                  | 必須 | サーバー専用                     |
| `LINE_TEST_USER_ID`                    | オーナー自身の LINE user id。テスト送信先 兼 要対応通知先 | 任意 | サーバー専用                     |
| `ADMIN_PASSWORD`                       | 管理画面のログインパスワード                              | 必須 | サーバー専用                     |
| `APP_URL`                              | アプリの公開 URL。設定すると通知文にリンクが入る          | 任意 | サーバー専用                     |

`SUPABASE_SECRET_KEY` / `OPENAI_API_KEY` / `LINE_CHANNEL_ACCESS_TOKEN` /
`LINE_CHANNEL_SECRET` / `ADMIN_PASSWORD` には**絶対に `NEXT_PUBLIC_` を付けない**。

## 動作確認用スクリプト

LINE 実機なしで挙動を確認できる（`.env.local` を読み込む）。

```bash
# 「質問文」→ 回答生成だけを確認（LINE 不要）
npm run try:answer -- "営業時間を教えてください"

# 署名検証 → イベント処理 → 回答生成 → conversations 保存 まで通しで確認
npm run try:webhook -- "カットの料金は？"
npm run try:webhook -- --bad-signature "テスト"   # 署名検証失敗（401）も確認できる
```

## デプロイ

- **Vercel + GitHub 連携**。`main` に push すると自動でビルド・デプロイ。
  `vercel.json` は不要（Next.js を自動検出）。
- Vercel の Project Settings → Environment Variables（Production）に上表の環境変数を
  登録する。`NEXT_PUBLIC_*` はビルド時にバンドルへ焼き込まれるため、**最初のデプロイ前に
  必須変数をすべて登録**しておく。
- `ADMIN_PASSWORD` は**本番専用の別の値**にする（セッションは DB を持たないステートレス
  方式で、流出時に有効期限まで無効化できないため）。
- デプロイ後、LINE Developers Console の Webhook URL を
  `<本番URL>/api/line/webhook` に切り替え、「検証」で疎通を確認する。
- `APP_URL` に本番 URL を設定して再デプロイすると、要対応通知にタップ可能なリンクが入る。

## ドキュメント

| ファイル                                         | 内容                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| [`docs/SETUP.md`](./docs/SETUP.md)               | 同じ構成を1から立ち上げる構築手順（Supabase / OpenAI / LINE / Vercel）     |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | API 仕様・DB 設計・外部サービス連携の技術リファレンス                      |
| [`docs/OPERATIONS.md`](./docs/OPERATIONS.md)     | オーナー向け運用マニュアル（管理画面の操作・スマホ前提・非エンジニア向け） |
| [`DEVLOG.md`](./DEVLOG.md)                       | フェーズ単位の開発記録（やったこと・詰まった点と解決策・学び）             |
| [`CLAUDE.md`](./CLAUDE.md)                       | プロジェクト規約（命名・コーディング規約・配色ルール）                     |
