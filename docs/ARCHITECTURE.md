# 技術ドキュメント

このアプリの **API 仕様・DB 設計・外部サービス連携** をまとめた技術リファレンスです。
コードを1ファイルずつ追わなくても、全体像と各インターフェースの「契約」（何を受けて
何を返すか）が分かることを目的にしています。

---

## 1. この文書について

### 対象読者

このリポジトリのコードを読む・改修する開発者、および引き継ぎを受ける人。
「なぜこの構成なのか」の経緯は [`DEVLOG.md`](../DEVLOG.md) にフェーズ単位で
記録しているので、本書では**現在の実装がどうなっているか**を中心にまとめます。

### この文書に載せないもの

- **実際のキー・トークン・URL・パスワード**は一切載せません。環境変数は「名前と役割」
  だけを扱います（実値は `.env.local` と Vercel の環境変数にのみ存在）。
- 画面の見た目・UI コンポーネントの詳細（管理画面の操作は運用マニュアル側で扱います）。

### 関連ドキュメント

| ドキュメント                  | 内容                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| [`README.md`](../README.md)   | プロジェクト概要・主な機能・技術構成・環境変数リファレンス    |
| [`docs/SETUP.md`](./SETUP.md) | 同じ構成を1から立ち上げる構築手順（Supabase / LINE / Vercel） |
| [`DEVLOG.md`](../DEVLOG.md)   | フェーズ単位の開発記録（設計判断・ハマりどころの詳細）        |

---

## 2. アーキテクチャ全体像

### 2.1 構成図

```
                       ┌──────────────────────────────────────────┐
                       │           Vercel（Next.js 16 アプリ）        │
                       │                                          │
   LINE ユーザー ──────▶│  POST /api/line/webhook   （LINE 受信）     │
        ▲              │  GET  /                   （疎通確認）      │
        │  返信/通知     │  /admin/*                 （管理画面）      │
        │              │  proxy.ts                 （/admin ガード） │
        │              └───┬───────────────┬──────────────┬────────┘
        │                  │               │              │
        │  reply /         │ SELECT        │ 読み書き      │ Chat
        │  push /          │ （参照のみ）    │ （RLS         │ Completions
        │  broadcast       │ Publishable   │  バイパス）    │
        │                  │ キー          │ Secret キー   │
   ┌────┴─────────┐   ┌────▼───────────────▼────┐   ┌─────▼──────┐
   │  LINE         │   │       Supabase          │   │   OpenAI    │
   │ Messaging API │   │     （PostgreSQL）        │   │ （回答生成）  │
   └──────────────┘   │  faq / menus /          │   └────────────┘
                      │  conversations /        │
                      │  broadcasts             │
                      └─────────────────────────┘
```

- **LINE Messaging API** — ユーザーのメッセージを webhook で受信し、返信（reply）・
  オーナーへの通知（push）・友だち全員への一斉配信（broadcast）を送る。
- **Supabase（PostgreSQL）** — FAQ・メニュー・会話ログ・配信履歴の保存先。アプリからは
  2種類のキーで接続する（3.2・5章）。
- **OpenAI** — 問い合わせ文と知識ベース（FAQ・メニュー）から返信文を生成する。
- **Vercel** — Next.js アプリのホスティング。`main` への push で自動デプロイ。

### 2.2 リクエストの流れ（LINE 自動応答）

```
LINE ユーザー
   │  メッセージ送信
   ▼
POST /api/line/webhook            app/api/line/webhook/route.ts
   │
   │  1. 生ボディを読む（request.text()）
   │  2. x-line-signature を検証        lib/line/verify-signature.ts
   │     └─ 不正なら 401 で終了
   │  3. JSON.parse（失敗なら 400）
   │  4. events[] を Promise.allSettled で1件ずつ処理
   │        └─ handleEvent（テキストメッセージのみ）
   │             a. 知識ベースを取得        lib/faq/knowledge.ts（Supabase: faq 全件 + 有効な menus）
   │             b. OpenAI で回答生成       lib/faq/generate-answer.ts → { answer, confidence, needsHuman }
   │             c. LINE へ返信            lib/line/client.ts（reply）
   │             d. conversations に記録    lib/conversations/log.ts（失敗しても返信は止めない）
   │             e. needsHuman なら         lib/line/notify-owner.ts（オーナーの LINE へ push）
   ▼
正常な署名なら常に 200 を返す（200 以外だと LINE が再送し二重返信になるため）
```

処理は返信をインラインで `await` します（個人店の低トラフィック前提。先に 200 を
返して `after()` で処理する形は将来の改善候補 — 6章）。

### 2.3 技術スタック

| 領域           | 使用技術                                                                      |
| -------------- | ----------------------------------------------------------------------------- |
| フレームワーク | Next.js 16.3.4（App Router / Server Components 中心 / Server Actions）        |
| ランタイム     | React 19.2.8                                                                  |
| 言語           | TypeScript 5（strict、`any` 不使用）                                          |
| スタイル       | Tailwind CSS v4（`app/globals.css` の `@theme` で色を定義）                   |
| データベース   | Supabase（PostgreSQL）/ `@supabase/supabase-js` 2.x。API キーは新形式         |
| AI             | OpenAI SDK 7.x（Chat Completions。既定 `gpt-4o-mini`）                        |
| メッセージング | LINE Messaging API（webhook 受信・reply / push / broadcast 送信。SDK 不使用） |
| ホスティング   | Vercel（GitHub 連携で `main` push 時に自動デプロイ）                          |

> **Next.js 16 の注意**: `middleware.ts` → `proxy.ts` へのリネームなど、一般に知られた
> API・規約と異なる破壊的変更を含みます。実装前に [`AGENTS.md`](../AGENTS.md) と
> `node_modules/next/dist/docs/` の該当ガイドを確認してください。

### 2.4 コードの層

| パス                   | 役割                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `app/`                 | ルーティング。`api/line/webhook`（webhook 本体）、`admin/`（管理画面）、`page.tsx`（疎通確認）     |
| `lib/`                 | ドメインロジック（下表）。UI・ルーティングから切り離した純粋な処理                                 |
| `components/`          | 管理画面の React コンポーネント（フォーム・ナビ・確認ボタン）                                      |
| `proxy.ts`             | `/admin/*` の未ログインアクセスをログイン画面へ送り返すルートガード（旧 middleware。常に Node.js） |
| `supabase/migrations/` | DB マイグレーション（SQL）。Supabase Studio で手動適用                                             |
| `supabase/seed/`       | 動作確認用サンプルデータ（マイグレーションではない）                                               |
| `scripts/`             | 手元確認用スクリプト（`try:answer` / `try:webhook`）                                               |

`lib/` の内訳:

| ディレクトリ         | 中身                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/env.ts`         | 環境変数の唯一の読み込み口。用途別に関数を分けて公開（7章）                                                                              |
| `lib/supabase/`      | `client.ts`（Publishable キー・ブラウザ用）/ `server.ts`（Secret キー・サーバー用）                                                      |
| `lib/openai/`        | `client.ts`（OpenAI クライアントのシングルトン）                                                                                         |
| `lib/faq/`           | `knowledge.ts`（知識ベース読み込み・整形）/ `generate-answer.ts`（回答生成）/ `admin.ts`（管理 CRUD）/ `categories.ts`                   |
| `lib/menus/`         | `admin.ts`（メニュー CRUD ＋ 並び替え）                                                                                                  |
| `lib/conversations/` | `log.ts`（会話ログの書き込み）/ `admin.ts`（読み取り専用一覧）                                                                           |
| `lib/broadcasts/`    | `admin.ts`（配信履歴の記録・一覧）                                                                                                       |
| `lib/line/`          | `verify-signature.ts`（署名検証）/ `client.ts`（reply/push/broadcast 送信）/ `notify-owner.ts`（要対応通知）/ `types.ts`（webhook の型） |
| `lib/admin/`         | `session.ts`（署名 Cookie の発行・検証）/ `guard.ts`（ログインチェック）                                                                 |

---

## 3. 外部サービス連携

3つの外部サービス（LINE / Supabase / OpenAI）と、ホスティング先の Vercel。
それぞれ「何のために・どう通信するか・使う環境変数」を整理します。

### 3.1 LINE Messaging API

SDK は使わず、`fetch` と `node:crypto` の数行で実装しています（依存を増やさず、
仕組みが見える形を優先。`lib/line/`）。

#### 受信（webhook）

| 項目           | 内容                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- |
| エンドポイント | `POST /api/line/webhook`（このアプリ側で公開する URL）                                  |
| 認証           | `x-line-signature` ヘッダの検証（下記）                                                 |
| ボディ         | LINE webhook のイベント配列。型は `lib/line/types.ts`（テキストメッセージ用の最小定義） |

**署名検証**（`lib/line/verify-signature.ts`）:

- 期待値 = `HMAC-SHA256(生ボディ, LINE_CHANNEL_SECRET)` を Base64 エンコードした文字列。
- リクエストの `x-line-signature` と `crypto.timingSafeEqual` で比較する
  （1文字ずつ早期 return する比較だと、応答時間の差から正解を推測されうるため）。
- **生ボディ（`request.text()` の結果）で検証する**。`JSON.parse` して再度文字列化すると
  キー順・空白が変わって署名が一致しなくなるので、route では生ボディを最初に読む。

#### 送信（reply / push / broadcast）

| 関数              | エンドポイント                         | 宛先          | 用途                                         |
| ----------------- | -------------------------------------- | ------------- | -------------------------------------------- |
| `replyText()`     | `api.line.me/v2/bot/message/reply`     | 受信者（1人） | webhook で受けたメッセージへの返信（無料枠） |
| `pushText()`      | `api.line.me/v2/bot/message/push`      | 指定した1人   | 要対応通知・一斉配信のテスト送信             |
| `broadcastText()` | `api.line.me/v2/bot/message/broadcast` | 友だち全員    | お知らせ一斉配信                             |

- 認証は `Authorization: Bearer LINE_CHANNEL_ACCESS_TOKEN`。3関数で共通の POST 処理を
  `postLineMessage()` に集約している（`lib/line/client.ts`）。
- 非 2xx はレスポンス本文を添えて `throw`。呼び出し側でログを残す。
- `replyToken` は webhook イベントに付いてくる使い捨てトークン。1回・短時間のみ有効。

**テキスト長 5000 文字の扱い**（LINE の制約）:

| 関数                             | 超過時              | 理由                                                             |
| -------------------------------- | ------------------- | ---------------------------------------------------------------- |
| `replyText()`                    | 黙って `slice` する | bot 自動応答の文面は生成側が完全には制御できないので安全側に倒す |
| `broadcastText()` / `pushText()` | `throw` する        | 管理者が書いた文面を無言で削ると誤解を招くため、気づかせる       |

> 要対応通知（`lib/line/notify-owner.ts`）は、顧客メッセージを本文に引用する前に
> 200 字へ切り詰める。「一番知らせたい長文の問い合わせのときに限って 5000 字超過で
> 通知が飛ばない」という事態を防ぐ安全網（DEVLOG フェーズ12）。

#### 使う環境変数

`LINE_CHANNEL_SECRET`（署名検証）/ `LINE_CHANNEL_ACCESS_TOKEN`（送信）/
`LINE_TEST_USER_ID`（任意・要対応通知とテスト送信の宛先）。すべてサーバー専用。

### 3.2 Supabase（PostgreSQL）

アプリからは**2種類のキー**で接続し、経路を分けています。

| 経路                          | キー                                   | ロール相当        | RLS      | 使う場所                                           |
| ----------------------------- | -------------------------------------- | ----------------- | -------- | -------------------------------------------------- |
| ブラウザ / クライアント       | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon              | 有効     | `lib/supabase/client.ts`（`getBrowserSupabase()`） |
| サーバー / webhook / 管理画面 | `SUPABASE_SECRET_KEY`                  | service_role 相当 | バイパス | `lib/supabase/server.ts`（`getServerSupabase()`）  |

- `lib/supabase/server.ts` は `import "server-only"` 付き。クライアントコンポーネントから
  誤って import するとビルドが失敗する（Secret キーがブラウザに漏れるのを防ぐ）。
- どちらも一度作ったインスタンスを使い回す（シングルトン）。`persistSession: false`
  （bot 用途でユーザーセッションを持たないため）。
- **RLS と GRANT は別レイヤー**。RLS =「どの行を返すか」、GRANT =「テーブルを操作して
  よいか」。Secret キー（service_role）は RLS はバイパスするが、テーブル権限は別途必要
  （5.4）。

現状、実際に SELECT でブラウザから読むコードはありません（管理画面もすべてサーバー側で
`getServerSupabase()` を使う）。Publishable キー経路は疎通確認ページ用の口として
用意されているものです。詳細なスキーマ・ポリシー・権限は5章。

### 3.3 OpenAI

`lib/faq/generate-answer.ts` の `generateFaqAnswer(userMessage)` が唯一の呼び出し口です。

| 項目         | 値                                                                                   |
| ------------ | ------------------------------------------------------------------------------------ |
| API          | Chat Completions（`openai` SDK 7.x・`lib/openai/client.ts` でシングルトン）          |
| モデル       | `OPENAI_MODEL` 未設定時は `gpt-4o-mini`                                              |
| パラメータ   | `temperature: 0.3`（回答のブレを抑える）/ `response_format: { type: "json_object" }` |
| 入力         | system プロンプト（ルール）＋ system プロンプト（知識ベース）＋ user（問い合わせ文） |
| 出力（想定） | `{ "answer": string, "confidence": number, "needs_human": boolean }`                 |

- **知識ベースは丸ごとプロンプトに入れる**（`lib/faq/knowledge.ts`）。`faq` 全件 ＋
  `is_active` な `menus`（`sort_order` 昇順）をカテゴリ別テキストに整形して渡す。
  ベクトル検索・埋め込みは使わない（個人店の FAQ は数十件規模で、別インフラの複雑さに
  見合わないため。判断の経緯は DEVLOG フェーズ1）。
- 出力 JSON は zod を使わず3フィールドを手書きで検証。`confidence` は 0〜1 にクランプ。
- **失敗しても `throw` しない**。OpenAI エラー・空応答・パース失敗時は定型文
  `FALLBACK_ANSWER`（`confidence: 0` / `needsHuman: true`）を返し、詳細は
  `console.error` でサーバーログに残す（生エラーを LINE 返信に漏らさない）。

#### 使う環境変数

`OPENAI_API_KEY`（必須）/ `OPENAI_MODEL`（任意）。どちらもサーバー専用。

### 3.4 Vercel

- Next.js を自動検出してビルド・デプロイする（`vercel.json` なし）。
- GitHub の `main` に push すると自動デプロイ。
- 環境変数は Vercel の Project Settings（Production）で設定する。`NEXT_PUBLIC_*` は
  ビルド時に JS バンドルへ焼き込まれるため、最初のデプロイ前に必須変数をすべて登録する。
- `proxy.ts` は Vercel 上で Node.js ランタイム固定で動く（`node:crypto` がそのまま使える）。

構築・デプロイ手順の詳細は [`docs/SETUP.md`](./SETUP.md) 8章。

---

## 4. API 仕様

### 4.1 エンドポイント一覧

| 種別          | パス / 関数                              | 認証                            | 用途                                         |
| ------------- | ---------------------------------------- | ------------------------------- | -------------------------------------------- |
| Route Handler | `POST /api/line/webhook`                 | `x-line-signature` 検証         | LINE メッセージの受信・自動応答              |
| ページ        | `GET /`                                  | なし                            | 疎通確認（Supabase 接続と `faq` 件数を表示） |
| ページ        | `GET /admin/login`                       | なし                            | ログイン画面                                 |
| ページ        | `GET /admin/faq` ほか `(protected)` 配下 | `admin_session` Cookie          | 管理画面（FAQ・メニュー・ログ・配信）        |
| Server Action | `loginAction` / `logoutAction`           | —（`loginAction` は自身が認証） | ログイン / ログアウト                        |
| Server Action | FAQ・メニュー・一斉配信の各 Action       | `requireAdminSession()`         | 管理画面のデータ操作（4.4）                  |

このアプリの「API」は大きく2種類です。

- **`/api/line/webhook`** — 外部（LINE）から叩かれる唯一の HTTP エンドポイント。
- **Server Actions** — 管理画面のフォームから呼ばれるサーバー関数。見た目は関数呼び出し
  ですが、実体は Next.js が生成する POST エンドポイントです（4.4）。

REST 的な JSON API（`GET /api/faq` など）は提供していません。管理画面のデータ取得は
Server Component が `lib/*/admin.ts` を直接呼び、更新は Server Action 経由です。

### 4.2 `POST /api/line/webhook`

`app/api/line/webhook/route.ts`。LINE Developers Console の Webhook URL に登録する。

| 設定                   | 値                | 理由                                               |
| ---------------------- | ----------------- | -------------------------------------------------- |
| `export const runtime` | `"nodejs"`        | 署名検証で `node:crypto` を使うため                |
| `export const dynamic` | `"force-dynamic"` | 生ボディ・署名ヘッダを毎回読むのでキャッシュしない |

**リクエスト**:

- ヘッダ `x-line-signature`（Base64。無ければ検証失敗）
- ボディ = LINE webhook のイベント配列 `{ destination, events: [...] }`
  （型は `lib/line/types.ts`。これは `JSON.parse` 結果への型注釈で、実行時検証ではない）

**処理順**:

```
1. rawBody = await request.text()            ← 署名検証のため生の文字列で読む
2. 署名検証（verifyLineSignature）
      失敗 → 401 Unauthorized で終了
3. JSON.parse(rawBody)
      失敗 → 400 Bad Request で終了
4. Promise.allSettled(body.events.map(handleEvent))
      ← 1イベントの失敗が他イベントを巻き込まないよう allSettled
5. 200 OK を返す
```

**`handleEvent`（1イベントの処理）**:

- `event.type === "message"` かつ `event.message.type === "text"` のイベントだけ処理する。
  スタンプ・画像・follow などは黙って無視。
- `replyToken` / `source.userId` / `text`（trim 済み）が揃わなければ何もしない。
- 揃っていれば「回答生成 → reply → `conversations` 記録 → （needs_human なら）オーナー通知」
  を順に実行（2.2 のフロー）。

**レスポンス**:

| ステータス | ボディ         | 条件                                         |
| ---------- | -------------- | -------------------------------------------- |
| `200`      | `OK`           | 署名が正しい（イベント処理の成否は問わない） |
| `400`      | `Bad Request`  | 署名は正しいが JSON として壊れている         |
| `401`      | `Unauthorized` | 署名がない / 一致しない                      |

> **正常な署名には常に 200 を返す**のが重要な設計です。200 以外を返すと LINE が
> webhook を再送し、同じメッセージに二重返信してしまいます。返信や記録に失敗しても
> ログを残して 200 で返します。

### 4.3 管理画面の認証

DB やセッションストアを使わない、**署名付き Cookie によるステートレス認証**です
（オーナー1人しか使わない前提。`lib/admin/session.ts`）。

**セッション Cookie**:

| 項目     | 値                                                                                |
| -------- | --------------------------------------------------------------------------------- |
| 名前     | `admin_session`                                                                   |
| 値の形式 | `"<有効期限の Unix 秒>.<HMAC-SHA256 署名（base64url）>"`                          |
| 署名の鍵 | `ADMIN_PASSWORD`。`createHmac("sha256", password).update("admin-session:<期限>")` |
| 有効期間 | 7日（`SESSION_MAX_AGE_SECONDS`）                                                  |
| 属性     | `httpOnly` / `sameSite=lax` / `path=/` / `secure`（本番のみ）                     |

- 検証（`verifyAdminSessionToken`）は「期限内か」＋「署名が一致するか」を確認する。
  パスワードを知らない第三者はこの文字列を偽造できない。比較は `timingSafeEqual`。
- ログイン（`verifyAdminPassword`）も入力値と `ADMIN_PASSWORD` を `timingSafeEqual` で比較。

**2層のガード**:

| 層               | 実装                                                              | 役割                                                             |
| ---------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| ルーティング入口 | `proxy.ts`（`matcher: ["/admin/:path*"]`、`/admin/login` は除外） | 未ログインで `/admin/*` を開いたら `/admin/login` へリダイレクト |
| ページ / Action  | `requireAdminSession()`（`lib/admin/guard.ts`、`server-only`）    | 各ページ・各 Server Action の先頭で再チェック                    |

Server Action はページを経由せず直接 POST でも呼び出せるため、`proxy.ts` だけに頼らず
Action 自身の先頭でも `requireAdminSession()` を呼ぶ多重防御にしています。

> `lib/admin/session.ts` には `server-only` を付けていません。`proxy.ts`（React の
> レンダリングパイプライン外）から import する必要があり、付けると誤検知で throw する
> 恐れがあるためです。`cookies()` を使う Next.js 依存部分（`guard.ts`）だけに付けています。

> **流出時の注意**: ステートレスなので、`ADMIN_PASSWORD` や Cookie が漏れると有効期限
> （7日）まで無効化できません。本番の `ADMIN_PASSWORD` は開発用と別の値にします
> （[`docs/SETUP.md`](./SETUP.md) 8.3）。

### 4.4 Server Actions

すべて `app/admin/` 配下の `"use server"` ファイルで定義。共通の作りは次のとおりです。

1. 先頭で `await requireAdminSession()`（未ログインなら `/admin/login` へ）
2. `parseXxxForm(formData)` で入力を検証（フィールド別エラーは入力値を保持したまま返す）
3. `lib/*/admin.ts` の関数で DB 操作。**DB エラーは `console.error` に残し、ユーザーには
   汎用メッセージ**（生のエラーは見せない）
4. 成功時は `redirect("/admin/xxx?created=1")` のようにフラッシュ用クエリ付きで遷移

| Action                    | 引数                        | 成功時                         | 失敗時                                        |
| ------------------------- | --------------------------- | ------------------------------ | --------------------------------------------- |
| `loginAction`             | `(prevState, formData)`     | Cookie 発行 → `/admin/faq`     | エラー文言を state で返す（画面は留まる）     |
| `logoutAction`            | なし                        | Cookie 削除 → `/admin/login`   | —                                             |
| `createFaqAction`         | `(prevState, formData)`     | `/admin/faq?created=1`         | fieldErrors / error を state で返す           |
| `updateFaqAction`         | `(id, prevState, formData)` | `/admin/faq?updated=1`         | 同上                                          |
| `deleteFaqAction`         | `(id)`                      | `/admin/faq?deleted=1`         | `/admin/faq/<id>/delete?error=1` へ           |
| `createMenuAction`        | `(prevState, formData)`     | `/admin/menus?created=1`       | fieldErrors / error を state で返す           |
| `updateMenuAction`        | `(id, prevState, formData)` | `/admin/menus?updated=1`       | 同上                                          |
| `deleteMenuAction`        | `(id)`                      | `/admin/menus?deleted=1`       | `/admin/menus/<id>/delete?error=1` へ         |
| `moveMenuAction`          | `(id, direction)`           | `/admin/menus`（並び替え反映） | `/admin/menus?moveError=1` へ                 |
| `sendBroadcastAction`     | `(prevState, formData)`     | `/admin/broadcasts?sent=1`     | redirect **せず** 文面を保持して error を返す |
| `sendTestBroadcastAction` | `(prevState, formData)`     | redirect せず notice を返す    | redirect せず error を返す                    |

**入力バリデーションの要点**（`parseXxxForm`）:

- FAQ: `category` は6値のいずれか（`lib/faq/categories.ts`）、`question` ≤ 200 字、
  `answer` ≤ 2000 字。
- メニュー: `name` ≤ 100 字、`price` は全角数字・カンマを正規化してから `^\d+$` かつ
  Postgres `integer` 上限以下、`description` ≤ 500 字。`sort_order` はフォームに無く
  自動採番（既存最大 +1）。
- 一斉配信: `message` は必須・≤ 5000 字。
- クライアント側の `pattern` 属性は使わない（サーバー側の正規化より先に働いて全角入力を
  弾くため。DEVLOG フェーズ4）。

**一斉配信の特別扱い**（取り消せない操作のため）:

- `sendBroadcastAction` は成功・失敗どちらも `broadcasts` テーブルに履歴を記録する。
  失敗時は `error_detail` に LINE API のエラーを残す。
- `sendTestBroadcastAction`（自分にだけ届くテスト送信）は履歴に記録しない。
  `LINE_TEST_USER_ID` 未設定なら UI でボタンを出さないうえ、Action 側でも弾く。
- 送信前プレビュー / 確認は `components/BroadcastForm.tsx` がクライアント state で
  compose → confirm の2フェーズを切り替えて実現（DB の下書き行は作らない）。

### 4.5 横断的なエラーハンドリング方針

| 方針                                          | 具体                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 生の DB / 外部 API エラーをユーザーに返さない | 汎用文言を表示し、詳細は `console.error`（`app/admin/error.tsx` の Error Boundary も同様）                                      |
| webhook は正常署名なら常に 200                | 返信・記録・通知の失敗はログのみ。LINE の再送＝二重処理を避ける                                                                 |
| ログ・通知は本流（返信）を止めない            | `logConversation()` / `notifyOwnerNeedsHuman()` は内部で握って `throw` しない                                                   |
| 疎通確認ページ（`/`）は例外的に詳細を表示     | 構築時の切り分け用。`code` / `hint` / `details` まで整形して出す。この書き方を webhook / API に持ち込まない（DEVLOG フェーズ0） |

---

## 5. DB 設計

Supabase（PostgreSQL）。スキーマは `supabase/migrations/` の SQL がすべての正で、
Supabase Studio の SQL Editor で手動適用します（このリポジトリは Supabase CLI / MCP を
使いません）。

### 5.1 テーブルの関係

テーブルは4つ。**外部キー・リレーションは持たず、それぞれ独立**しています。

| テーブル        | 役割                                    | 書き込み経路                                 | 増え方                         |
| --------------- | --------------------------------------- | -------------------------------------------- | ------------------------------ |
| `faq`           | よくある質問と回答（bot の知識ベース）  | 管理画面（`/admin/faq`）                     | オーナーが登録（数十件規模）   |
| `menus`         | メニューと料金（bot の知識ベース）      | 管理画面（`/admin/menus`）                   | オーナーが登録（十数件規模）   |
| `conversations` | LINE の会話ログ（受信文・応答・確信度） | webhook（`lib/conversations/log.ts`）        | メッセージ1件＝1行で増え続ける |
| `broadcasts`    | 一斉配信の送信履歴                      | 一斉配信 Action（`lib/broadcasts/admin.ts`） | 配信するたびに増える           |

`faq` / `menus` は bot が参照する「カタログ」、`conversations` / `broadcasts` は
「ログ」という性格の違いがあります（一覧取得の方針が変わる — 6章）。

### 5.2 テーブル定義

共通: 主キー `id uuid`（`gen_random_uuid()`）、`created_at timestamptz not null default now()`。

#### `faq`

| カラム       | 型            | 制約 / 既定                                                                                 |
| ------------ | ------------- | ------------------------------------------------------------------------------------------- |
| `id`         | `uuid`        | PK / `gen_random_uuid()`                                                                    |
| `category`   | `text`        | `not null` / CHECK: `hours` `menu_price` `access` `combination` `reservation` `other` の6値 |
| `question`   | `text`        | `not null`（想定される質問文）                                                              |
| `answer`     | `text`        | `not null`（bot が返す回答文）                                                              |
| `created_at` | `timestamptz` | `not null` / `now()`                                                                        |
| `updated_at` | `timestamptz` | `not null` / `now()` / 更新時にトリガーで自動更新                                           |

- インデックス: `faq_category_idx (category)`
- トリガー: `faq_set_updated_at`（`before update` → `set_updated_at()`）
- `category` の6値は `lib/faq/categories.ts`（フォーム選択肢・バリデーション・一覧の
  グルーピング）と `lib/faq/knowledge.ts`（プロンプト見出し）でも同じ配列を使う。
  DB の CHECK 制約と食い違わせないための単一情報源。

#### `menus`

| カラム        | 型            | 制約 / 既定                                                    |
| ------------- | ------------- | -------------------------------------------------------------- |
| `id`          | `uuid`        | PK / `gen_random_uuid()`                                       |
| `name`        | `text`        | `not null`                                                     |
| `price`       | `integer`     | `not null` / CHECK: `price >= 0`（単位は円・税込想定）         |
| `description` | `text`        | null 可                                                        |
| `is_active`   | `boolean`     | `not null` / `default true`。`false` は bot 応答・表示から除外 |
| `sort_order`  | `integer`     | `not null` / `default 0`。小さいほど先に表示                   |
| `created_at`  | `timestamptz` | `not null` / `now()`                                           |
| `updated_at`  | `timestamptz` | `not null` / `now()` / トリガーで自動更新                      |

- インデックス: `menus_active_sort_idx (is_active, sort_order)`
- トリガー: `menus_set_updated_at`
- bot の知識ベースは `is_active = true` のみ・`sort_order` 昇順で取得。管理画面の一覧は
  非表示メニューも含めて全件表示する。

#### `conversations`

| カラム             | 型              | 制約 / 既定                                             |
| ------------------ | --------------- | ------------------------------------------------------- |
| `id`               | `uuid`          | PK / `gen_random_uuid()`                                |
| `line_user_id`     | `text`          | `not null`（LINE Messaging API の userId）              |
| `received_message` | `text`          | `not null`（ユーザーから受信した本文）                  |
| `bot_response`     | `text`          | null 可（生成した文面。実際に届いた文面とは限らない ※） |
| `confidence`       | `numeric(4, 3)` | CHECK: `null` または `0 <= confidence <= 1`             |
| `needs_human`      | `boolean`       | `not null` / `default false`（`20260905` で追加）       |
| `created_at`       | `timestamptz`   | `not null` / `now()`                                    |

- インデックス: `conversations_line_user_id_idx (line_user_id)` /
  `conversations_created_at_idx (created_at desc)`
- ※ `bot_response` は `generateFaqAnswer()` が生成した文面。`replyText()` が失敗しても
  この値は記録される（配信の成否は区別しない）。
- `needs_human` を追加する前の行は一律 `false`（実際の判定結果ではなくデフォルト値）。
- **個人情報を含む**（`line_user_id` ＋ 顧客メッセージ本文）。保持期間・削除フローは未定（6章）。

#### `broadcasts`

| カラム         | 型            | 制約 / 既定                                          |
| -------------- | ------------- | ---------------------------------------------------- |
| `id`           | `uuid`        | PK / `gen_random_uuid()`                             |
| `message`      | `text`        | `not null`（配信を試みた本文。失敗時も保存）         |
| `status`       | `text`        | `not null` / CHECK: `sent` または `failed`           |
| `error_detail` | `text`        | null 可（失敗時の LINE API エラー詳細。成功時 null） |
| `created_at`   | `timestamptz` | `not null` / `now()`                                 |

- インデックス: `broadcasts_created_at_idx (created_at desc)`

### 5.3 RLS（行レベルセキュリティ）

全テーブルで RLS 有効。ポリシーは「誰がどの行を読めるか」を決めます。

| テーブル                       | ポリシー                                         | 結果                                                                            |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `faq` / `menus`                | `for select to anon, authenticated using (true)` | anon（Publishable キー）から全行 SELECT 可。INSERT/UPDATE/DELETE ポリシーは無し |
| `conversations` / `broadcasts` | ポリシーなし                                     | anon からは読み書き一切不可                                                     |

- 書き込み（および `conversations` / `broadcasts` の読み取り）は、RLS をバイパスする
  Secret キー（`getServerSupabase()`）経由でのみ行う。
- Supabase Studio から直接 SQL を叩く場合も RLS の外側なので操作できる。

### 5.4 テーブル権限（GRANT）

RLS とは別レイヤーで、「そのロールがテーブルを操作してよいか」を決めます。
`20260903_init_schema.sql` / `20260906_create_broadcasts.sql` で明示しています。

```
revoke all on <各テーブル> from anon, authenticated;                    -- まず全撤回
grant select on public.faq, public.menus to anon, authenticated;        -- 参照系のみ
grant select, insert, update, delete
  on public.faq, public.menus, public.conversations, public.broadcasts
  to service_role;                                                      -- サーバーは全操作
```

> **なぜ明示するか**: Supabase の「新規テーブルへの自動 GRANT」は
> `ALTER DEFAULT PRIVILEGES` が実体で、テーブル作成者ロールが一致するときだけ効きます。
> Studio の SQL Editor 経由では発火しないことがあり、その場合 anon も service_role も
> `42501 permission denied` になります。SQL は一部だけ抜き出さず全文で実行してください
> （DEVLOG フェーズ0続き）。

### 5.5 関数・トリガー

`public.set_updated_at()` — `before update` で `new.updated_at = now()` にする
`plpgsql` トリガー関数。`faq` と `menus` に適用。

`set search_path = ''` を固定しています。可変のままだと呼び出し側のスキーマ解決に
依存して意図しない関数・テーブルを参照させられる余地が残る（Supabase の DB linter も
`function_search_path_mutable` で警告する）ため。この関数は `now()` しか使わないので
空にして問題ありません。

### 5.6 マイグレーション一覧

| 順  | ファイル                                        | 内容                                                                                        |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | `20260903_init_schema.sql`                      | `faq` / `menus` / `conversations` の3テーブル・RLS・GRANT・インデックス・`set_updated_at()` |
| 2   | `20260905_add_needs_human_to_conversations.sql` | `conversations.needs_human` カラムを追加                                                    |
| 3   | `20260906_create_broadcasts.sql`                | `broadcasts` テーブル（RLS・GRANT・インデックス込み）                                       |

`supabase/seed/sample_data.sql` は**マイグレーションではありません**（架空サロンの
FAQ・メニューを投入する開発用の使い捨てデータ。再実行で全削除 → 入れ直し）。
適用順・手動適用の理由は [`docs/SETUP.md`](./SETUP.md) 4.2・10.2。

---

## 6. 設計上の既知の割り切り

「個人美容室オーナー1人・低トラフィック」という前提で意図的に簡略化している点です。
規模が変わったら見直す候補として、コードのコメントと DEVLOG に散っている判断を
1か所にまとめます。

| 割り切り                                                                  | 背景 / 見直しの目安                                                                     | 参照                 |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------- |
| webhook は返信をインラインで `await`（先に 200 を返さない）               | 生成に数秒かかるが低トラフィックなら許容。トラフィックが増えたら `after()` での非同期化 | DEVLOG フェーズ2     |
| 1 webhook 内のイベント処理に同時実行数の上限なし                          | LINE が複数イベントをまとめて送ると無制限に並列化される。実害が出たら上限を設ける       | DEVLOG フェーズ2     |
| 会話ログ・配信履歴の一覧はページネーションなし（`limit 50` 固定）         | 直近50件だけ表示。件数が増えて困ったらページ送りを実装                                  | DEVLOG フェーズ5     |
| `conversations` の保持期間・削除フローが未定                              | 個人情報（`line_user_id` ＋ 本文）を溜め続けている。運用ルールをプロダクト側で決める    | DEVLOG フェーズ0続き |
| `confidence` はモデルの自己申告値                                         | 厳密な指標ではない。プロンプトで基準を固定してブレを減らしているだけ                    | DEVLOG フェーズ1     |
| FAQ 検索はベクトル検索なし（知識ベース全件をプロンプトに投入）            | 数十件規模なら十分。増えて限界が来たら検索方式を足す                                    | DEVLOG フェーズ1     |
| メニュー並び替えは2クエリで `sort_order` をスワップ（非トランザクション） | 低頻度更新なら許容。簡易ロールバックのみ実装                                            | DEVLOG フェーズ4     |
| 管理セッションは流出時に失効させられない（ステートレス）                  | オーナー1人前提。本番は専用パスワード＋7日で自動失効                                    | DEVLOG フェーズ8     |
| 空メッセージ・絵文字のみのメッセージの扱いが甘い                          | 実運用の状況を見てから対応判断                                                          | DEVLOG フェーズ11    |

---

## 7. 環境変数

すべて `lib/env.ts` 経由で読みます（`process.env` を各所で直接参照しない）。
未設定なら「どの変数か・テンプレートはどこか」を明示して `throw` します。
検証は「モジュール読み込み時」ではなく「関数呼び出し時」に行います（ビルド時の
プリレンダー段階で `.env.local` が無くても落ちないようにするため）。

### 用途別に関数を分ける

1つの `getEnv()` にまとめず、使う場面ごとに関数を分けています。ある機能を使わない
経路（例: 疎通確認ページは LINE も OpenAI も使わない）が、無関係な変数の未設定で
落ちないようにするためです。

| 関数                          | 読む変数                                                             | 必須           |
| ----------------------------- | -------------------------------------------------------------------- | -------------- |
| `getPublicEnv()`              | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | 必須           |
| `getServerEnv()`              | `SUPABASE_SECRET_KEY`                                                | 必須           |
| `getOpenAIEnv()`              | `OPENAI_API_KEY`（必須）/ `OPENAI_MODEL`（任意・既定 `gpt-4o-mini`） | 一部必須       |
| `getLineChannelSecret()`      | `LINE_CHANNEL_SECRET`                                                | webhook で必須 |
| `getLineChannelAccessToken()` | `LINE_CHANNEL_ACCESS_TOKEN`                                          | 送信時に必須   |
| `getLineTestUserId()`         | `LINE_TEST_USER_ID`                                                  | 任意           |
| `getAppUrl()`                 | `APP_URL`                                                            | 任意           |
| `getAdminEnv()`               | `ADMIN_PASSWORD`                                                     | 管理画面で必須 |

> `LINE_CHANNEL_SECRET` と `LINE_CHANNEL_ACCESS_TOKEN` をあえて別関数にしているのは、
> 署名検証（secret のみ必要）が reply 送信（access token のみ必要）より前に走るためです。
> 1関数にまとめると、access token が未設定/失効しているだけで、正しい署名の webhook まで
> 検証前に `throw` して 500 になってしまいます（本来 401 か 200 で返すべきところ）。

### 公開 / サーバー専用の別

| 分類                                             | 変数                                                                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_`（ブラウザに露出）                 | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                                                                                  |
| サーバー専用（絶対に `NEXT_PUBLIC_` を付けない） | `SUPABASE_SECRET_KEY` / `OPENAI_API_KEY` / `OPENAI_MODEL` / `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` / `LINE_TEST_USER_ID` / `ADMIN_PASSWORD` / `APP_URL` |

各変数の役割・必須/任意の一覧は [`README.md` の「環境変数」表](../README.md#環境変数)、
本番デプロイ時の設定手順は [`docs/SETUP.md`](./SETUP.md) 8.3 にあります。
**実値はこのリポジトリのどこにも置きません**（`.env.local` と Vercel の環境変数のみ）。
