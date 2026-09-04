"use server";

// FAQ の追加・更新・削除を行う Server Action。
//
// 重要: Server Action はページを経由せず直接 POST でも呼び出せる
// （Next.js公式ドキュメントに明記）。proxy.ts のガードだけに頼らず、
// 各Actionの先頭で必ず requireAdminSession() を呼ぶ。

import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin/guard";
import { createFaq, deleteFaq, updateFaq } from "@/lib/faq/admin";
import { isFaqCategory, type FaqCategory } from "@/lib/faq/categories";

export type FaqFormValues = {
  category: string;
  question: string;
  answer: string;
};

export type FaqFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"category" | "question" | "answer", string>>;
  values: FaqFormValues;
};

// DBのCHECK制約には長さ上限が無いが、際限なく長い文章が登録されると
// 一覧やLINE返信の見た目が崩れるので、画面側で現実的な上限を決めておく。
const QUESTION_MAX_LENGTH = 200;
const ANSWER_MAX_LENGTH = 2000;

type ParsedFaqForm =
  | {
      ok: true;
      input: { category: FaqCategory; question: string; answer: string };
    }
  | {
      ok: false;
      fieldErrors: NonNullable<FaqFormState["fieldErrors"]>;
      values: FaqFormValues;
    };

function parseFaqForm(formData: FormData): ParsedFaqForm {
  const categoryRaw = String(formData.get("category") ?? "");
  const question = String(formData.get("question") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();

  const values: FaqFormValues = { category: categoryRaw, question, answer };
  const fieldErrors: NonNullable<FaqFormState["fieldErrors"]> = {};

  if (!isFaqCategory(categoryRaw)) {
    fieldErrors.category = "カテゴリを選択してください。";
  }
  if (question.length === 0) {
    fieldErrors.question = "質問を入力してください。";
  } else if (question.length > QUESTION_MAX_LENGTH) {
    fieldErrors.question = `質問は${QUESTION_MAX_LENGTH}文字以内で入力してください。`;
  }
  if (answer.length === 0) {
    fieldErrors.answer = "回答を入力してください。";
  } else if (answer.length > ANSWER_MAX_LENGTH) {
    fieldErrors.answer = `回答は${ANSWER_MAX_LENGTH}文字以内で入力してください。`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values };
  }

  return {
    ok: true,
    input: { category: categoryRaw as FaqCategory, question, answer },
  };
}

export async function createFaqAction(
  _prevState: FaqFormState,
  formData: FormData,
): Promise<FaqFormState> {
  await requireAdminSession();

  const parsed = parseFaqForm(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  try {
    await createFaq(parsed.input);
  } catch (e) {
    // 生のDBエラーは見せず、ログにだけ残す（DEVLOGの申し送り事項に準拠）。
    console.error("[createFaqAction] FAQの追加に失敗しました", e);
    return {
      ok: false,
      error: "保存に失敗しました。時間をおいて再度お試しください。",
      values: parsed.input,
    };
  }

  // redirect() は内部で例外を投げて遷移するので try/catch の外で呼ぶ。
  redirect("/admin/faq?created=1");
}

export async function updateFaqAction(
  id: string,
  _prevState: FaqFormState,
  formData: FormData,
): Promise<FaqFormState> {
  await requireAdminSession();

  const parsed = parseFaqForm(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  try {
    await updateFaq(id, parsed.input);
  } catch (e) {
    console.error("[updateFaqAction] FAQの更新に失敗しました", e);
    return {
      ok: false,
      error: "保存に失敗しました。時間をおいて再度お試しください。",
      values: parsed.input,
    };
  }

  redirect("/admin/faq?updated=1");
}

export async function deleteFaqAction(id: string): Promise<void> {
  await requireAdminSession();

  try {
    await deleteFaq(id);
  } catch (e) {
    console.error("[deleteFaqAction] FAQの削除に失敗しました", e);
    redirect(`/admin/faq/${id}/delete?error=1`);
  }

  redirect("/admin/faq?deleted=1");
}
