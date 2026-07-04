"use client";

import { useCallback, useRef } from "react";
import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { cn } from "@/lib/utils/cn";

/**
 * Push-to-talk button with a CSS-variable driven audio meter.
 *
 * The level is written straight to a `--mic-level` custom property on the
 * button DOM node — so even though it animates at 60Hz, React never
 * re-renders and the rest of the chat input stays still.
 */
export function VoiceButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (t: string) => void;
  disabled?: boolean;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const onLevel = useCallback((level: number) => {
    const node = buttonRef.current;
    if (!node) return;
    node.style.setProperty("--mic-level", level.toFixed(3));
  }, []);

  const recorder = useVoiceRecorder({
    onTranscript,
    maxDurationMs: 30_000,
    onLevel,
  });

  if (!recorder.supported) {
    return (
      <button
        type="button"
        disabled
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground"
        title="Voice input unsupported in this browser"
      >
        <MicOff className="h-4 w-4" />
      </button>
    );
  }

  const isRecording = recorder.state === "recording";
  const isTranscribing = recorder.state === "transcribing";

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={isRecording ? "Stop recording" : "Start recording"}
      onClick={recorder.toggle}
      disabled={disabled || isTranscribing}
      style={{ "--mic-level": "0" } as React.CSSProperties}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center rounded-xl border transition-colors",
        isRecording
          ? "border-destructive/60 bg-destructive/15 text-destructive"
          : "border-border bg-secondary hover:bg-accent text-foreground",
        isTranscribing && "opacity-70 cursor-wait"
      )}
    >
      {isRecording && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl border-2 border-destructive"
          style={{
            opacity: "calc(0.2 + var(--mic-level, 0) * 0.55)",
            transform: "scale(calc(1 + var(--mic-level, 0) * 0.12))",
            transition: "opacity 80ms linear, transform 80ms linear",
          }}
        />
      )}
      {isTranscribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <Square className="h-4 w-4 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}
