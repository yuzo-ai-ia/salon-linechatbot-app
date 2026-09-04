// faq.category の許可値と、画面表示用の日本語ラベル。
//
// なぜここに1箇所化するか:
//   DB 側は supabase/migrations/20260903_init_schema.sql の CHECK 制約で
//   6値に固定されている。この制約と食い違うと「保存できたのに選択肢に出ない」
//   「選択肢にあるのに保存で弾かれる」が起きるので、フォームの選択肢・
//   バリデーション・一覧表示のグルーピングすべてでこの配列を唯一の情報源にする。
//
// lib/faq/knowledge.ts の FaqRow とは別物（あちらは OpenAI プロンプト整形専用の
// 型で id を持たない）。混同しないよう、こちらは管理画面専用として扱う。

export const FAQ_CATEGORIES = [
  "hours",
  "menu_price",
  "access",
  "combination",
  "reservation",
  "other",
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

// 「専門用語を避ける」方針に合わせて、DB上の値ではなく日本語ラベルを画面に出す。
export const FAQ_CATEGORY_LABEL: Record<FaqCategory, string> = {
  hours: "営業時間",
  menu_price: "料金・メニュー",
  access: "アクセス",
  combination: "組み合わせ",
  reservation: "予約",
  other: "その他",
};

// <select> の選択肢として使う配列（表示順 = FAQ_CATEGORIES の順）。
export const FAQ_CATEGORY_OPTIONS = FAQ_CATEGORIES.map((value) => ({
  value,
  label: FAQ_CATEGORY_LABEL[value],
}));

export function isFaqCategory(value: string): value is FaqCategory {
  return (FAQ_CATEGORIES as readonly string[]).includes(value);
}
