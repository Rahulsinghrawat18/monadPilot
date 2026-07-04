"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Global TTS player. Only one piece of audio is allowed to play at a time
 * across the whole app — starting a new playback always stops the
 * previous one so two assistant replies never speak over each other.
 */
type GlobalPlayer = {
  audio: HTMLAudioElement | null;
  url: string | null;
  currentId: string | null;
  listeners: Set<(id: string | null) => void>;
};

const globalRef: { current: GlobalPlayer | null } = { current: null };

function getGlobal(): GlobalPlayer {
  if (!globalRef.current) {
    globalRef.current = {
      audio: null,
      url: null,
      currentId: null,
      listeners: new Set(),
    };
  }
  return globalRef.current;
}

function notify(id: string | null) {
  for (const l of getGlobal().listeners) l(id);
}

function stopGlobal() {
  const g = getGlobal();
  if (g.audio) {
    g.audio.pause();
    g.audio.src = "";
    g.audio = null;
  }
  if (g.url) {
    URL.revokeObjectURL(g.url);
    g.url = null;
  }
  g.currentId = null;
  notify(null);
}

async function playGlobal(id: string, blob: Blob) {
  const g = getGlobal();
  stopGlobal();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preload = "auto";
  g.audio = audio;
  g.url = url;
  g.currentId = id;
  notify(id);
  audio.addEventListener("ended", () => {
    if (g.currentId === id) stopGlobal();
  });
  audio.addEventListener("error", () => {
    if (g.currentId === id) stopGlobal();
  });
  try {
    await audio.play();
  } catch (e) {
    if (g.currentId === id) stopGlobal();
    throw e;
  }
}

/**
 * useSpeech — `speak(id, text)` fetches /api/voice/speak and plays the
 * audio. `stop()` halts whichever clip is currently playing. The hook
 * also exposes `playingId` so a UI can highlight the speaking bubble.
 */
export function useSpeech() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const lastReqRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const g = getGlobal();
    const onChange = (id: string | null) => setPlayingId(id);
    g.listeners.add(onChange);
    setPlayingId(g.currentId);
    return () => {
      g.listeners.delete(onChange);
    };
  }, []);

  const speak = useCallback(async (id: string, text: string) => {
    if (!text?.trim()) return;
    lastReqRef.current?.abort();
    const controller = new AbortController();
    lastReqRef.current = controller;

    setLoadingId(id);
    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `TTS failed (${res.status})`);
      }
      const blob = await res.blob();
      await playGlobal(id, blob);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      const message = e instanceof Error ? e.message : "Could not speak";
      toast.error(message);
    } finally {
      if (lastReqRef.current === controller) {
        lastReqRef.current = null;
        setLoadingId((cur) => (cur === id ? null : cur));
      }
    }
  }, []);

  const stop = useCallback(() => {
    lastReqRef.current?.abort();
    lastReqRef.current = null;
    setLoadingId(null);
    stopGlobal();
  }, []);

  return { speak, stop, playingId, loadingId };
}
