// 環境構築フェーズの疎通確認ページ。
// Supabase（サーバー用 secret クライアント）で faq テーブルの件数を数え、
// 接続できているかを画面に表示する。本格的な UI は後のフェーズで作る。

import { connection } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

type HealthResult =
  { ok: true; faqCount: number } | { ok: false; message: string };

async function checkSupabase(): Promise<HealthResult> {
  try {
    const supabase = getServerSupabase();
    // head: true + count: "exact" で、行データを取らずに件数だけ取得する。
    const { count, error } = await supabase
      .from("faq")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return { ok: true, faqCount: count ?? 0 };
  } catch (e) {
    // 握りつぶさず、原因が分かるメッセージを画面に出す。
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export default async function Home() {
  // ビルド時のプリレンダーをここで止め、以降はリクエスト時のみ実行する
  // （.env.local が無いビルド環境で失敗しないようにするため）。
  await connection();

  const health = await checkSupabase();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">美容室 LINE bot</h1>
        <p className="text-sm text-zinc-500">
          環境構築フェーズ / 疎通確認ページ
        </p>
      </div>

      {health.ok ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="font-medium text-green-800">
            ✅ 環境構築OK — Supabase 接続成功
          </p>
          <p className="mt-1 text-sm text-green-700">
            faq テーブル: {health.faqCount} 件
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="font-medium text-red-800">
            ❌ Supabase に接続できませんでした
          </p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-red-700">
            {health.message}
          </pre>
          <p className="mt-2 text-xs text-red-600">
            .env.local の値、またはマイグレーション（faq
            テーブル）の適用を確認してください。
          </p>
        </div>
      )}

      <ul className="list-disc pl-5 text-sm text-zinc-600">
        <li>DB スキーマ: supabase/migrations/20260903_init_schema.sql</li>
        <li>環境変数テンプレート: .env.local.example</li>
        <li>次フェーズ: OpenAI 応答ロジック → LINE webhook 連携</li>
      </ul>
    </main>
  );
}
