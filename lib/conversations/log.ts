// LINE の会話（受信メッセージと bot 応答）を conversations テーブルへ記録する。
//
// 目的は「あとで応答品質を分析する」こと。返信より優先度は低いので、
// 保存に失敗しても throw しない（webhook 全体を落とさない）。失敗は
// console.error に残して次に活かす（＝握りつぶさない）。
//
// conversations は RLS ポリシー無し（= anon からは不可）。secret キーの
// サーバークライアント経由でのみ読み書きする。

import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";

export type ConversationLog = {
  /** LINE Messaging API の userId。 */
  lineUserId: string;
  /** ユーザーから受信した本文。 */
  receivedMessage: string;
  /**
   * bot が生成した回答文。generateFaqAnswer() は例外時も FALLBACK_ANSWER を
   * 返す設計で null にはならないため、実質的に常に string が入る
   * （型を string | null のままにしているのは、将来 生成そのものを
   * スキップするケースが出た場合の余地として）。
   *
   * 注意: これは「生成した文面」であって「LINE に実際に届いた文面」ではない。
   * replyText() が失敗（invalid reply token 等）してもこの値はそのまま記録される。
   * 配信の成否を区別したい場合は、conversations にカラムを追加する
   * スキーマ変更が必要（次フェーズの検討事項）。
   */
  botResponse: string | null;
  /** 応答の確信度 0〜1。壊れている場合は null。 */
  confidence: number | null;
};

/**
 * 会話を 1 件記録する。失敗しても throw せず、ログだけ残す。
 */
export async function logConversation(entry: ConversationLog): Promise<void> {
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("conversations").insert({
      line_user_id: entry.lineUserId,
      received_message: entry.receivedMessage,
      bot_response: entry.botResponse,
      confidence: entry.confidence,
    });
    if (error) throw error;
  } catch (e) {
    console.error("[logConversation] 会話ログの保存に失敗しました", e);
  }
}
