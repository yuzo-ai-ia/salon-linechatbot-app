"use server";

// メニューの追加・更新を行う Server Action。
//
// 重要: Server Action はページを経由せず直接 POST でも呼び出せる
// （Next.js公式ドキュメントに明記）。proxy.ts のガードだけに頼らず、
// 各Actionの先頭で必ず requireAdminSession() を呼ぶ。

import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin/guard";
import { createMenu, updateMenu } from "@/lib/menus/admin";

export type MenuFormValues = {
  name: string;
  // 入力欄の生の文字列のまま保持する（全角数字・カンマ入りの表示や、
  // バリデーションエラー時の再入力を避けるため、数値化はサーバー側でのみ行う）。
  price: string;
  description: string;
  isActive: boolean;
};

export type MenuFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "price" | "description", string>>;
  values: MenuFormValues;
};

// DBのCHECK制約には長さ上限が無いが、際限なく長い文章が登録されると
// 一覧の見た目が崩れるので、画面側で現実的な上限を決めておく（FAQ側と同じ方針）。
const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
// Postgres の integer 型（price カラム）の上限。これを超える値を insert/update
// しようとすると DB エラーになるため、フォーム側で先に弾く。
const PRICE_MAX = 2147483647;

// 全角数字・カンマ・空白（全角スペース含む）を許容して正規化する。
// スマホの数字キーパッドやコピペ入力で全角になりがちなケースを吸収するため。
function normalizePriceInput(raw: string): string {
  const halfWidthDigits = raw.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
  return halfWidthDigits.replace(/[,，\s]/g, "");
}

type ParsedPrice = { ok: true; value: number } | { ok: false; message: string };

function parsePrice(raw: string): ParsedPrice {
  const normalized = normalizePriceInput(raw);

  if (normalized.length === 0) {
    return { ok: false, message: "価格を入力してください。" };
  }
  // 数字以外（小数点・マイナス・文字列など）が混じっていたら弾く。
  if (!/^\d+$/.test(normalized)) {
    return { ok: false, message: "価格は0以上の整数で入力してください。" };
  }

  const value = Number(normalized);
  if (value > PRICE_MAX) {
    return { ok: false, message: "価格が大きすぎます。" };
  }

  return { ok: true, value };
}

type ParsedMenuForm =
  | {
      ok: true;
      input: {
        name: string;
        price: number;
        description: string | null;
        is_active: boolean;
      };
    }
  | {
      ok: false;
      fieldErrors: NonNullable<MenuFormState["fieldErrors"]>;
      values: MenuFormValues;
    };

function parseMenuForm(formData: FormData): ParsedMenuForm {
  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  // チェックボックスは check されている時だけ "on" として送られてくる。
  const isActive = formData.get("is_active") === "on";

  const values: MenuFormValues = {
    name,
    price: priceRaw,
    description: descriptionRaw,
    isActive,
  };
  const fieldErrors: NonNullable<MenuFormState["fieldErrors"]> = {};

  if (name.length === 0) {
    fieldErrors.name = "メニュー名を入力してください。";
  } else if (name.length > NAME_MAX_LENGTH) {
    fieldErrors.name = `メニュー名は${NAME_MAX_LENGTH}文字以内で入力してください。`;
  }

  const parsedPrice = parsePrice(priceRaw);
  if (!parsedPrice.ok) {
    fieldErrors.price = parsedPrice.message;
  }

  if (descriptionRaw.length > DESCRIPTION_MAX_LENGTH) {
    fieldErrors.description = `説明は${DESCRIPTION_MAX_LENGTH}文字以内で入力してください。`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, values };
  }

  // ここまで来ていれば parsedPrice は ok:true が保証されている。
  const price = parsedPrice as { ok: true; value: number };

  return {
    ok: true,
    input: {
      name,
      price: price.value,
      description: descriptionRaw.length === 0 ? null : descriptionRaw,
      is_active: isActive,
    },
  };
}

export async function createMenuAction(
  _prevState: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  await requireAdminSession();

  const parsed = parseMenuForm(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  try {
    await createMenu(parsed.input);
  } catch (e) {
    // 生のDBエラーは見せず、ログにだけ残す（FAQ側と同方針）。
    console.error("[createMenuAction] メニューの追加に失敗しました", e);
    return {
      ok: false,
      error: "保存に失敗しました。時間をおいて再度お試しください。",
      values: {
        name: parsed.input.name,
        price: String(parsed.input.price),
        description: parsed.input.description ?? "",
        isActive: parsed.input.is_active,
      },
    };
  }

  // redirect() は内部で例外を投げて遷移するので try/catch の外で呼ぶ。
  redirect("/admin/menus?created=1");
}

export async function updateMenuAction(
  id: string,
  _prevState: MenuFormState,
  formData: FormData,
): Promise<MenuFormState> {
  await requireAdminSession();

  const parsed = parseMenuForm(formData);
  if (!parsed.ok) {
    return {
      ok: false,
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  try {
    await updateMenu(id, parsed.input);
  } catch (e) {
    console.error("[updateMenuAction] メニューの更新に失敗しました", e);
    return {
      ok: false,
      error: "保存に失敗しました。時間をおいて再度お試しください。",
      values: {
        name: parsed.input.name,
        price: String(parsed.input.price),
        description: parsed.input.description ?? "",
        isActive: parsed.input.is_active,
      },
    };
  }

  redirect("/admin/menus?updated=1");
}
