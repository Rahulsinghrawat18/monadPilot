"use client";

import { useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useChat } from "@/store/chat";
import { useSpeech } from "@/hooks/use-speech";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "basepilot.speechEnabled";

/**
 * Header toggle that controls whether assistant replies are automatically
 * read aloud after a voice command. Persisted to localStorage so the
 * preference survives page reloads.
 */
export function SpeechToggle() {
  const enabled = useChat((s) => s.speechEnabled);
  const setEnabled = useChat((s) => s.setSpeechEnabled);
  const { stop } = useSpeech();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setEnabled(stored === "1");
    } catch {
      // ignore storage errors
    }
  }, [setEnabled]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
    if (!next) stop();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Disable voice replies" : "Enable voice replies"}
      title={
        enabled
          ? "Voice replies on — click to mute"
          : "Voice replies muted — click to enable"
      }
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border border-border bg-secondary px-3 text-[10px] font-pixel uppercase tracking-[0.18em] transition-colors",
        enabled
          ? "text-foreground hover:border-primary/50"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {enabled ? (
        <Volume2 className="h-3.5 w-3.5 text-primary" />
      ) : (
        <VolumeX className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{enabled ? "VOICE ON" : "MUTED"}</span>
    </button>
  );
}
