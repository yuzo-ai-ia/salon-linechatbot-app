// 管理画面（/admin/faq）用の FAQ 読み書き。
//
// lib/faq/knowledge.ts の FaqRow（id を持たない、OpenAI プロンプト整形専用の型）
// とは別物として扱う。編集・削除には id が必須なので、こちらは id・created_at・
// updated_at まで含む型にしている。
//
// faq テーブルへの insert/update/delete は RLS ポリシーが無く、GRANT も
// service_role のみ（supabase/migrations/20260903_init_schema.sql）。
// getServerSupabase()（secret キー）を使うここでしか書き込めない。

import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import type { FaqCategory } from "@/lib/faq/categories";

export type FaqAdminRow = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
};

export type FaqInput = {
  category: FaqCategory;
  question: string;
  answer: string;
};

/**
 * 全 FAQ を取得する。error は握りつぶさず throw する
 * （呼び出し側の Server Action / ページでユーザー向けの汎用メッセージへ変換する）。
 */
export async function listFaqs(): Promise<FaqAdminRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("faq")
    .select("id, category, question, answer, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as FaqAdminRow[];
}

/**
 * id 指定で1件取得する。存在しなければ null（呼び出し側で notFound() 等にする）。
 */
export async function getFaqById(id: string): Promise<FaqAdminRow | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("faq")
    .select("id, category, question, answer, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as FaqAdminRow | null) ?? null;
}

export async function createFaq(input: FaqInput): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase.from("faq").insert(input);
  if (error) throw error;
}

export async function updateFaq(id: string, input: FaqInput): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase.from("faq").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteFaq(id: string): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase.from("faq").delete().eq("id", id);
  if (error) throw error;
}
