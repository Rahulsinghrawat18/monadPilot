"use client";

import { useCallback, useRef } from "react";
import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { motion } from "framer-motion";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { cn } from "@/lib/utils/cn";

/**
 * Big, breathing center mic — the focal point of the empty chat screen.
 *
 * - Idle: a Base-blue radial glow breathes behind the button on a calm
 *   2.4s loop, hinting at push-to-talk.
 * - Recording: the glow's intensity tracks the live audio RMS via a
 *   `--mic-level` CSS variable, so the breathing morphs into a real-time
 *   reactive aura without re-rendering React on every frame.
 *
 * Designed to sit dead-center on the chat empty state. On wide screens
 * the glow extends ~360px; on mobile it gracefully scales down.
 */
export function CenterMic({
  onTranscript,
  disabled,
}: {
  onTranscript: (t: string) => void;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const onLevel = useCallback((level: number) => {
    const node = wrapRef.current;
    if (!node) return;
    node.style.setProperty("--mic-level", level.toFixed(3));
  }, []);

  const recorder = useVoiceRecorder({
    onTranscript,
    maxDurationMs: 30_000,
    onLevel,
  });

  const unsupported = !recorder.supported;
  const isRecording = recorder.state === "recording";
  const isTranscribing = recorder.state === "transcribing";

  return (
    <div className="relative my-2 flex flex-col items-center">
      <div
        ref={wrapRef}
        style={{ "--mic-level": "0" } as React.CSSProperties}
        className="relative flex items-center justify-center"
      >
        {/* Outer aura — radial-gradient that breathes when idle, reacts to
            audio level when recording. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute h-[360px] w-[360px] rounded-full",
            isRecording ? "mic-aura mic-aura-live" : "mic-aura mic-aura-idle"
          )}
        />

        {/* Inner ring(s) */}
        {isRecording && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute h-32 w-32 rounded-full border border-primary/50"
              style={{
                opacity: "calc(0.35 + var(--mic-level, 0) * 0.55)",
                transform: "scale(calc(1 + var(--mic-level, 0) * 0.3))",
                transition: "opacity 80ms linear, transform 80ms linear",
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute h-40 w-40 rounded-full border border-primary/30"
              style={{
                opacity: "calc(0.2 + var(--mic-level, 0) * 0.45)",
                transform: "scale(calc(1 + var(--mic-level, 0) * 0.55))",
                transition: "opacity 120ms linear, transform 120ms linear",
              }}
            />
          </>
        )}
        {!isRecording && !isTranscribing && (
          <span
            aria-hidden
            className="mic-halo-idle pointer-events-none absolute h-28 w-28 rounded-full"
          />
        )}

        {/* The button itself */}
        <motion.button
          type="button"
          disabled={disabled || isTranscribing || unsupported}
          onClick={recorder.toggle}
          aria-label={isRecording ? "Stop recording" : "Start voice command"}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.02 }}
          className={cn(
            "relative flex h-24 w-24 items-center justify-center rounded-full border text-white transition-colors",
            "shadow-[0_0_50px_-6px_rgba(76,140,255,0.55),inset_0_0_0_1px_rgba(255,255,255,0.18)]",
            isRecording
              ? "border-destructive/70 bg-[linear-gradient(180deg,#ef4444,#b91c1c)]"
              : "border-primary/60 bg-[linear-gradient(180deg,#1a6bff,#0052ff)] hover:brightness-110",
            (disabled || unsupported) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isTranscribing ? (
            <Loader2 className="h-9 w-9 animate-spin" />
          ) : isRecording ? (
            <Square className="h-9 w-9 fill-current" />
          ) : unsupported ? (
            <MicOff className="h-9 w-9" />
          ) : (
            <Mic className="h-9 w-9" />
          )}
        </motion.button>
      </div>

      <div className="font-pixel mt-4 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {unsupported
          ? "VOICE UNAVAILABLE IN THIS BROWSER"
          : isTranscribing
            ? "TRANSCRIBING…"
            : isRecording
              ? "LISTENING · TAP TO STOP"
              : "TAP TO TALK"}
      </div>
    </div>
  );
}
