// FAQ 応答生成用の OpenAI クライアント。
//
// - 先頭の "server-only" により、クライアントコンポーネントから誤って import すると
//   ビルドが失敗する。OPENAI_API_KEY は旧 service_role 級の秘密情報なので、
//   ブラウザバンドルに絶対に載せない。
// - createClient と同じく、生成コストと接続設定の重複を避けるため
//   一度作ったインスタンスを使い回す（シングルトン）。

import "server-only";

import OpenAI from "openai";
import { getOpenAIEnv } from "@/lib/env";

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (cached) return cached;

  const { apiKey } = getOpenAIEnv();
  cached = new OpenAI({ apiKey });
  return cached;
}
