-- ============================================================
-- broadcasts: LINE友だち全員へのお知らせ一斉配信の送信履歴
--
-- 管理画面（/admin/broadcasts）からのbroadcast API呼び出し結果を記録する。
-- 「何を送ったか忘れた」「誤送信の証跡が無い」を防ぐための履歴テーブル。
--
-- conversations（1顧客×1受信メッセージ向けの設計）とは意味が異なるため
-- 相乗りさせず、専用テーブルとして新設する。
-- ============================================================

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  status text not null check (status in ('sent', 'failed')),
  error_detail text,
  created_at timestamptz not null default now()
);

comment on table public.broadcasts is 'LINE友だち全員へのお知らせ一斉配信の送信履歴。';
comment on column public.broadcasts.message is '配信を試みた本文（失敗時も保存し、何を送ろうとしたか追えるようにする）。';
comment on column public.broadcasts.status is '配信結果。sent=成功 / failed=失敗。';
comment on column public.broadcasts.error_detail is '失敗時のLINE APIエラー詳細。成功時はnull。';

create index broadcasts_created_at_idx on public.broadcasts (created_at desc);

-- ============================================================
-- RLS（行レベルセキュリティ）
-- ============================================================

-- broadcasts: 配信履歴。顧客への一斉配信内容は管理者以外に見せる必要がない。
alter table public.broadcasts enable row level security;
-- ポリシーを作らない = anon / authenticated からは読み書き不可。
--   conversationsと同方針。サーバーのsecretクライアント（RLSバイパス）からのみ読み書きする。

-- ============================================================
-- テーブル権限（GRANT）
-- ============================================================
-- 20260903_init_schema.sqlと同じ理由でSupabaseの自動GRANTに頼らず明示する。

revoke all on public.broadcasts from anon, authenticated;

grant select, insert, update, delete
  on public.broadcasts
  to service_role;
