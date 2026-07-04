import "server-only";
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Set it in your env.");
  }
  client = new OpenAI({ apiKey });
  return client;
}

export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o";
export const TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1";
