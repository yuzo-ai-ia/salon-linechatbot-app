// このフェーズの主役。
// 問い合わせ文を受け取り、DB の知識ベースを根拠に GPT で回答文を生成する。
//
// - LINE には依存しない純粋な関数。webhook フェーズでここを呼ぶだけにする。
// - 例外（OpenAI エラー / 応答のパース失敗）はユーザー向けの汎用文へ変換し、
//   詳細は console.error でサーバーログに残す。生エラーを呼び出し側に漏らさない
//   （DEVLOG フェーズ0の宿題: hint/details をエンドユーザーに返さないこと）。

import "server-only";

import { getOpenAI } from "@/lib/openai/client";
import { getOpenAIEnv } from "@/lib/env";
import {
  formatKnowledgeForPrompt,
  loadKnowledgeBase,
} from "@/lib/faq/knowledge";

export type FaqAnswer = {
  /** ユーザーへ返す回答文。 */
  answer: string;
  /** 回答の確信度 0〜1。モデルの自己申告なので目安。低いものは有人対応の判断材料。 */
  confidence: number;
  /** true = 自動回答が不確実。有人対応へ回すべき。 */
  needsHuman: boolean;
};

// OpenAI 呼び出しや整形に失敗したときにユーザーへ返す定型文。
const FALLBACK_ANSWER: FaqAnswer = {
  answer:
    "申し訳ありません。ただいま自動での回答ができませんでした。担当より折り返しご連絡いたします。",
  confidence: 0,
  needsHuman: true,
};

const SYSTEM_PROMPT = `あなたは美容室の問い合わせ対応アシスタントです。LINE で届いたお客様からの質問に、丁寧な日本語で返信します。

# ルール
- 後述の「知識ベース」に書かれている情報だけを根拠にすること。書かれていないことは推測しない。
- 知識ベースで答えられない、または情報が曖昧なときは、正直に「確認して折り返します」と伝え、needs_human を true にする。憶測で答えない。
- 「知識ベース」「記載」「データ」などの内部的な言葉は返信に使わない。お客様には自然な接客の言葉で答える（例:「あいにく分かりかねますので、確認してご連絡いたします」）。
- 敬語で、簡潔に（2〜3文程度）。料金は「◯◯円」と表記する。
- 予約の確定や日時の約束はしない（予約希望は受け付けたうえで、確認して連絡する旨を伝える）。

# 出力形式
次の形の JSON オブジェクトだけを返すこと（前後に文章を付けない）:
{ "answer": string, "confidence": number, "needs_human": boolean }

- answer: お客様へ返信する本文。
- confidence: 0〜1 の数値。知識ベースに明確な根拠がある=0.8以上 / 部分的にしか答えられない=0.4〜0.7 / 知識ベースに情報がない=0.3以下。
- needs_human: 有人対応に回すべきなら true（情報不足・予約確定の要望・クレーム・込み入った相談など）。`;

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

/**
 * 問い合わせ文から回答を生成する。失敗時も throw せず FALLBACK_ANSWER を返す。
 */
export async function generateFaqAnswer(
  userMessage: string,
): Promise<FaqAnswer> {
  const trimmed = userMessage.trim();
  if (trimmed === "") {
    return {
      answer:
        "お問い合わせ内容が読み取れませんでした。恐れ入りますが、もう一度お送りいただけますか。",
      confidence: 0,
      needsHuman: true,
    };
  }

  try {
    const knowledge = formatKnowledgeForPrompt(await loadKnowledgeBase());
    const { model } = getOpenAIEnv();

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `# 知識ベース\n\n${knowledge}` },
      { role: "user", content: trimmed },
    ];

    const completion = await getOpenAI().chat.completions.create({
      model,
      // 回答のブレを抑えるため低めに固定する。
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages,
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      console.error("[generateFaqAnswer] OpenAI から空の応答が返りました", {
        model,
        finishReason: completion.choices[0]?.finish_reason,
      });
      return FALLBACK_ANSWER;
    }

    return parseAnswer(content);
  } catch (e) {
    // 握りつぶさず、原因をサーバーログへ。ユーザーには汎用文を返す。
    console.error("[generateFaqAnswer] 応答生成に失敗しました", e);
    return FALLBACK_ANSWER;
  }
}

/**
 * OpenAI が返した JSON 文字列を検証して FaqAnswer に変換する。
 * zod は入れず、3 フィールドを手書きで検証する。
 */
function parseAnswer(raw: string): FaqAnswer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[generateFaqAnswer] 応答が JSON として解釈できません", raw);
    return FALLBACK_ANSWER;
  }

  if (typeof parsed !== "object" || parsed === null) {
    console.error(
      "[generateFaqAnswer] 応答が JSON オブジェクトではありません",
      raw,
    );
    return FALLBACK_ANSWER;
  }

  const obj = parsed as Record<string, unknown>;

  const answer = typeof obj.answer === "string" ? obj.answer.trim() : "";
  if (answer === "") {
    console.error("[generateFaqAnswer] 応答に answer がありません", raw);
    return FALLBACK_ANSWER;
  }

  const needsHuman = obj.needs_human === true;

  // confidence は number 化してから 0〜1 にクランプ。壊れていれば needsHuman で補う。
  const rawConfidence =
    typeof obj.confidence === "number"
      ? obj.confidence
      : Number(obj.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : needsHuman
      ? 0.2
      : 0.5;

  return { answer, confidence, needsHuman };
}
