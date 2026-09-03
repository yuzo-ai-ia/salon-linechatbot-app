// bot の「知識ベース」を DB から読み出し、プロンプトに差し込めるテキストへ整形する。
//
// 設計方針:
//   個人美容室の FAQ はせいぜい数十件、メニューも十数件。全部そのまま
//   プロンプトに入れれば十分に拾えるので、ベクトル検索や埋め込みは使わない
//   （インフラも複雑さも増えるだけ）。データが増えて限界が来たら検索方式を足す。

import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";

// faq テーブルの category が取り得る値（マイグレーションの check 制約と対応）。
const FAQ_CATEGORIES = [
  "hours",
  "menu_price",
  "access",
  "combination",
  "reservation",
  "other",
] as const;

type FaqCategory = (typeof FAQ_CATEGORIES)[number];

// カテゴリの日本語ラベル。プロンプトの見出しに使う。
const FAQ_CATEGORY_LABEL: Record<FaqCategory, string> = {
  hours: "営業時間",
  menu_price: "メニュー・料金",
  access: "アクセス",
  combination: "メニューの組み合わせ",
  reservation: "予約",
  other: "その他",
};

export type FaqRow = {
  category: string;
  question: string;
  answer: string;
};

export type MenuRow = {
  name: string;
  price: number;
  description: string | null;
};

export type KnowledgeBase = {
  faq: FaqRow[];
  menus: MenuRow[];
};

/**
 * DB から faq 全件と、有効な menus（sort_order 昇順）を取得する。
 * error は握りつぶさず throw する。呼び出し側（generate-answer）で
 * ユーザー向けの汎用メッセージへ変換する。
 */
export async function loadKnowledgeBase(): Promise<KnowledgeBase> {
  const supabase = getServerSupabase();

  const [faqResult, menusResult] = await Promise.all([
    supabase.from("faq").select("category, question, answer"),
    supabase
      .from("menus")
      .select("name, price, description")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (faqResult.error) throw faqResult.error;
  if (menusResult.error) throw menusResult.error;

  return {
    faq: (faqResult.data ?? []) as FaqRow[],
    menus: (menusResult.data ?? []) as MenuRow[],
  };
}

/**
 * 知識ベースを、GPT が読みやすい素朴なテキストへ整形する。
 * カテゴリ別に FAQ を並べ、最後にメニュー表を付ける。
 */
export function formatKnowledgeForPrompt(kb: KnowledgeBase): string {
  const sections: string[] = [];

  sections.push("## FAQ");
  if (kb.faq.length === 0) {
    sections.push("（登録されている FAQ はありません）");
  } else {
    for (const category of FAQ_CATEGORIES) {
      const rows = kb.faq.filter((row) => row.category === category);
      if (rows.length === 0) continue;

      const lines = rows.map(
        (row) => `- Q: ${row.question}\n  A: ${row.answer}`,
      );
      sections.push(`### ${FAQ_CATEGORY_LABEL[category]}\n${lines.join("\n")}`);
    }

    // check 制約外の category が万一混ざっていても捨てずに出す。
    const knownCategories = new Set<string>(FAQ_CATEGORIES);
    const others = kb.faq.filter((row) => !knownCategories.has(row.category));
    if (others.length > 0) {
      const lines = others.map(
        (row) => `- Q: ${row.question}\n  A: ${row.answer}`,
      );
      sections.push(`### 未分類\n${lines.join("\n")}`);
    }
  }

  sections.push("## メニューと料金");
  if (kb.menus.length === 0) {
    sections.push("（登録されているメニューはありません）");
  } else {
    const lines = kb.menus.map((menu) => {
      const desc = menu.description ? `（${menu.description}）` : "";
      return `- ${menu.name}: ${menu.price.toLocaleString("ja-JP")}円${desc}`;
    });
    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}
