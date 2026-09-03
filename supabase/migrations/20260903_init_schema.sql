-- 20260903_init_schema.sql
-- 美容室 LINE bot の初期スキーマ。faq / menus / conversations の3テーブルを作成する。
--
-- 新形式キー運用の前提:
--   - publishable キー（anon ロール）: 参照系（faq / menus の SELECT）のみ許可。
--   - secret キー（RLS バイパス）: 書き込みと conversations の読み書きはこちらで行う。
--
-- 適用方法: Supabase Studio > SQL Editor にこのファイルの内容を貼って実行する。

-- gen_random_uuid() 用（Supabase では通常有効だが、依存を明示しておく）。
create extension if not exists "pgcrypto";

-- ============================================================
-- 共通: updated_at を自動更新するトリガー関数
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is '行の更新時に updated_at を現在時刻へ自動更新する。';

-- ============================================================
-- faq: よくある質問マスタ（bot 応答の元データ）
-- ============================================================
create table public.faq (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint faq_category_check check (
    category in ('hours', 'menu_price', 'access', 'combination', 'reservation', 'other')
  )
);

comment on table public.faq is 'よくある質問と回答のマスタ。bot 応答の元データ。';
comment on column public.faq.category is
  '質問カテゴリ。hours=営業時間 / menu_price=メニュー料金 / access=アクセス / combination=組み合わせ / reservation=予約 / other=その他';
comment on column public.faq.question is '想定される質問文';
comment on column public.faq.answer is 'bot が返す回答文';

create index faq_category_idx on public.faq (category);

create trigger faq_set_updated_at
  before update on public.faq
  for each row execute function public.set_updated_at();

-- ============================================================
-- menus: 美容室のメニューと料金
-- ============================================================
create table public.menus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menus_price_check check (price >= 0)
);

comment on table public.menus is '美容室のメニューと料金。';
comment on column public.menus.name is 'メニュー名';
comment on column public.menus.price is '料金。単位は円（税込想定）。';
comment on column public.menus.description is 'メニューの説明（任意）';
comment on column public.menus.is_active is 'false のメニューは bot 応答・表示から除外する。';
comment on column public.menus.sort_order is '表示順。小さい値ほど先に表示する。';

create index menus_active_sort_idx on public.menus (is_active, sort_order);

create trigger menus_set_updated_at
  before update on public.menus
  for each row execute function public.set_updated_at();

-- ============================================================
-- conversations: LINE の会話ログ（受信メッセージと bot 応答）
-- ============================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  received_message text not null,
  bot_response text,
  confidence numeric(4, 3),
  created_at timestamptz not null default now(),
  constraint conversations_confidence_check check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

comment on table public.conversations is 'LINE で受けたメッセージと bot 応答の履歴。分析・改善用。';
comment on column public.conversations.line_user_id is 'LINE Messaging API の userId。';
comment on column public.conversations.received_message is 'ユーザーから受信した本文';
comment on column public.conversations.bot_response is 'bot が返した本文。生成失敗時は null。';
comment on column public.conversations.confidence is
  'bot 応答の確信度。0.000〜1.000。低い場合は有人対応へ回す判断材料。';

create index conversations_line_user_id_idx on public.conversations (line_user_id);
create index conversations_created_at_idx on public.conversations (created_at desc);

-- ============================================================
-- RLS（行レベルセキュリティ）
-- ============================================================

-- faq / menus: 参照系データ。anon / authenticated からの SELECT のみ許可する。
alter table public.faq enable row level security;
alter table public.menus enable row level security;

create policy "faq_select_public" on public.faq
  for select to anon, authenticated using (true);

create policy "menus_select_public" on public.menus
  for select to anon, authenticated using (true);

-- insert / update / delete のポリシーは作らない。
--   → データ変更は Supabase Studio か secret キー（RLS バイパス）経由でのみ可能。

-- conversations: 顧客の会話ログ。ブラウザからは一切アクセスさせない。
alter table public.conversations enable row level security;
-- ポリシーを作らない = anon / authenticated からは読み書き不可。
--   サーバーの secret クライアント（RLS バイパス）からのみ読み書きする。
