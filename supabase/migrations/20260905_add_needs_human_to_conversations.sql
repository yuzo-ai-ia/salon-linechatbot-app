-- ============================================================
-- conversations.needs_human を追加
--
-- generateFaqAnswer()（lib/faq/generate-answer.ts）は応答生成時に
-- needsHuman（有人対応が必要か）を判定しているが、これまで conversations
-- テーブルには confidence しか保存しておらず、needsHuman の判定結果が
-- 残っていなかった。管理画面の会話ログ一覧で表示するために追加する。
--
-- RLS・GRANTは20260903_init_schema.sqlで conversations テーブルに対して
-- 既に設定済み（RLSは有効・ポリシーなし＝service_roleのみ読み書き可）。
-- 既存テーブルへのカラム追加なのでここでの再設定は不要。
-- フィルタ機能は今回作らないため、needs_human 用の新規インデックスも追加しない。
-- ============================================================

alter table public.conversations
  add column needs_human boolean not null default false;

comment on column public.conversations.needs_human is
  'true = bot応答が不確実で有人対応が必要と判断された会話（generateFaqAnswer()の自己申告値）。
   このカラムを追加する前に記録された行にはこの判定が保存されていないため、
   過去分は一律 false になる（実際の判定結果ではなく単なるデフォルト値）。';
