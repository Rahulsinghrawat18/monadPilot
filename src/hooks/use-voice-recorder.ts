"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type VoiceState = "idle" | "recording" | "transcribing";

export type UseVoiceRecorderOptions = {
  /** Max recording length in ms. Defaults to 30s. */
  maxDurationMs?: number;
  /** Hold-to-talk vs press-to-toggle behaviour. */
  mode?: "hold" | "toggle";
  onTranscript?: (text: string) => void;
  language?: string;
  /**
   * Optional callback fired on every audio level sample (60Hz). Useful for
   * driving a DOM-level animation off a ref to avoid React re-renders.
   */
  onLevel?: (level: number) => void;
};

/**
 * Push-to-talk voice recorder backed by MediaRecorder + OpenAI Whisper.
 *
 * Produces webm/opus blobs (the browser's default), which Whisper accepts
 * directly. The audio meter is exposed via `onLevel(0..1)` so callers can
 * drive a CSS-variable animation without re-rendering React on every frame.
 */
export function useVoiceRecorder(opts: UseVoiceRecorderOptions = {}) {
  const {
    maxDurationMs = 30_000,
    mode = "hold",
    onTranscript,
    language,
    onLevel,
  } = opts;

  const [state, setState] = useState<VoiceState>("idle");
  const [supported, setSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLevelRef = useRef<typeof onLevel>(onLevel);
  onLevelRef.current = onLevel;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported(
      typeof window.MediaRecorder !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia
    );
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    onLevelRef.current?.(0);
  }, []);

  const stop = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanup();
      setState("idle");
      return;
    }

    await new Promise<void>((resolve) => {
      recorder.addEventListener(
        "stop",
        () => {
          resolve();
        },
        { once: true }
      );
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });

    const blob = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    });
    cleanup();

    if (blob.size === 0) {
      setState("idle");
      return;
    }

    setState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", blob, "voice.webm");
      if (language) form.append("language", language);
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Transcription failed (${res.status})`);
      }
      const { text } = (await res.json()) as { text: string };
      if (text) onTranscript?.(text);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not transcribe audio";
      toast.error(message);
    } finally {
      setState("idle");
    }
  }, [cleanup, language, onTranscript]);

  const start = useCallback(async () => {
    if (!supported) {
      toast.error("Voice input not supported in this browser.");
      return;
    }
    if (state !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64_000,
      });
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      });
      recorder.start(250);
      mediaRecorderRef.current = recorder;

      // Level meter — pushed out via the onLevel callback (ref-driven by
      // the caller) so the React tree doesn't re-render every frame.
      const AudioCtx =
        (window as unknown as { AudioContext?: typeof AudioContext })
          .AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx && onLevelRef.current) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;
        source.connect(analyser);
        analyserRef.current = analyser;
        const data = new Uint8Array(analyser.frequencyBinCount);
        let smooth = 0;
        const loop = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const raw = Math.min(1, Math.sqrt(sum / data.length) * 2.2);
          smooth = smooth * 0.7 + raw * 0.3;
          onLevelRef.current?.(smooth);
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
      }

      setState("recording");

      timeoutRef.current = setTimeout(() => {
        stop();
      }, maxDurationMs);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Microphone access denied";
      toast.error(message);
      cleanup();
      setState("idle");
    }
  }, [cleanup, maxDurationMs, state, stop, supported]);

  const toggle = useCallback(() => {
    if (state === "recording") return stop();
    if (state === "idle") return start();
  }, [start, state, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    supported,
    start,
    stop,
    toggle,
    mode,
  };
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "";
}
