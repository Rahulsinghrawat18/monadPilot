import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getOpenAI, TRANSCRIBE_MODEL } from "@/lib/ai/openai";
import { toFile } from "openai/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/voice/transcribe
 *
 * Receives a raw audio Blob (webm/opus by default from MediaRecorder),
 * forwards it to OpenAI Whisper, and returns the transcript.
 *
 * Voice transcription is gated on an authenticated session so an
 * unauthenticated visitor can't burn through your OpenAI quota.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.mcp) {
    return NextResponse.json(
      { error: "Please connect to Base first." },
      { status: 401 }
    );
  }

  const form = await req.formData();
  const audio = form.get("audio");
  const language = (form.get("language") as string | null) ?? undefined;
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "audio too large (>25MB)" }, { status: 413 });
  }

  try {
    const openai = getOpenAI();
    const filename =
      (audio as { name?: string }).name ?? `voice-${Date.now()}.webm`;
    const file = await toFile(audio, filename);
    const out = await openai.audio.transcriptions.create({
      file,
      model: TRANSCRIBE_MODEL,
      language,
      response_format: "json",
      temperature: 0,
      prompt:
        "User is speaking to a Monad DeFi assistant. Likely vocabulary: Monad, USDC, MON, WMON, CHOG, Ambient, Kuru, Uniswap, swap, send, deposit, nadname, ENS, keone.nad, yield, APY, vault.",
    });

    const text = (out as { text?: string }).text ?? "";
    return NextResponse.json({ text: text.trim() });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
