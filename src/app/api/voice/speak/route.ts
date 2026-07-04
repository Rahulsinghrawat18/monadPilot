import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getOpenAI } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "tts-1";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE ?? "nova"; // alloy|echo|fable|onyx|nova|shimmer

/**
 * POST /api/voice/speak
 *
 * Generates spoken audio for an assistant message using OpenAI TTS and
 * streams it back as audio/mpeg. Gated on an authenticated session so an
 * anonymous visitor can't burn your quota.
 *
 * Input: { text: string, voice?: string }
 * Output: audio/mpeg byte stream
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.mcp) {
    return NextResponse.json(
      { error: "Please connect to Base first." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    voice?: string;
  };
  const raw = (body.text ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const text = sanitizeForTTS(raw).slice(0, 4096);
  if (!text) {
    return NextResponse.json({ error: "empty after sanitize" }, { status: 400 });
  }

  const voice = body.voice ?? TTS_VOICE;

  try {
    const openai = getOpenAI();
    const speech = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice,
      input: text,
      response_format: "mp3",
      speed: 1.05,
    });

    return new Response(speech.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Make assistant text speakable: strip markdown formatting, code fences,
 * URLs, and table pipes that would otherwise sound like noise.
 */
function sanitizeForTTS(input: string): string {
  return input
    // Code blocks
    .replace(/```[\s\S]*?```/g, " ")
    // Inline code
    .replace(/`([^`]+)`/g, "$1")
    // Bold/italic markers
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    // Headings & bullets
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    // Markdown links [text](url) → text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    // Raw URLs
    .replace(/https?:\/\/\S+/g, "")
    // Tables: keep cell text, drop pipes & alignment rows
    .replace(/^\s*\|?\s*[:-]+\s*(\|\s*[:-]+\s*)+\|?\s*$/gm, "")
    .replace(/\|/g, ", ")
    // 0x addresses → "an address"
    .replace(/0x[a-fA-F0-9]{8,}/g, "an address")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}
