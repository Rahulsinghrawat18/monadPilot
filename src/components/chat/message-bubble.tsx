"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Square, User, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { MarkdownContent } from "./markdown";
import { ToolCallCard } from "./tool-call-card";
import { ApprovalCard } from "./approval-card";
import { Mascot } from "@/components/mascot";
import { useChat, type ChatMessage } from "@/store/chat";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useSpeech } from "@/hooks/use-speech";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { pollApproval } = useChatStream();
  const { speak, stop, playingId, loadingId } = useSpeech();
  const speechEnabled = useChat((s) => s.speechEnabled);
  const lastInputViaVoice = useChat((s) => s.lastInputViaVoice);
  const setLastInputViaVoice = useChat((s) => s.setLastInputViaVoice);
  const autoSpokeRef = useRef(false);

  // Auto-speak the very first time an assistant message finishes streaming,
  // but only when the most recent user turn was spoken via voice. Consume
  // the flag immediately so we never accidentally double-narrate.
  useEffect(() => {
    if (message.role !== "assistant") return;
    if (autoSpokeRef.current) return;
    if (!speechEnabled || !lastInputViaVoice) return;
    if (message.streaming) return;
    const text = (message.content ?? "").trim();
    if (!text) return;
    autoSpokeRef.current = true;
    setLastInputViaVoice(false);
    void speak(message.id, text);
  }, [
    message.role,
    message.id,
    message.streaming,
    message.content,
    speechEnabled,
    lastInputViaVoice,
    setLastInputViaVoice,
    speak,
  ]);

  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end gap-3"
      >
        <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-[0_4px_24px_-8px_rgba(0,82,255,0.5)]">
          {message.content}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        <Mascot size={36} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {message.toolCalls?.map((tc) => (
          <ToolCallCard key={tc.id} tool={tc} />
        ))}

        {(message.content || message.streaming) && (
          <div className="group relative rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3">
            {message.content ? (
              <MarkdownContent>{message.content}</MarkdownContent>
            ) : (
              <TypingIndicator />
            )}
            {message.streaming && message.content && (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary align-middle" />
            )}
            {!message.streaming && message.content && (
              <SpeakButton
                isPlaying={playingId === message.id}
                isLoading={loadingId === message.id}
                onPlay={() => speak(message.id, message.content)}
                onStop={stop}
              />
            )}
          </div>
        )}

        {message.approvals?.map((a, i) => (
          <ApprovalCard
            key={a.requestId ?? a.approvalUrl ?? i}
            approval={a}
            onPoll={() => pollApproval(message.id, a)}
          />
        ))}
      </div>
    </motion.div>
  );
}

function SpeakButton({
  isPlaying,
  isLoading,
  onPlay,
  onStop,
}: {
  isPlaying: boolean;
  isLoading: boolean;
  onPlay: () => void;
  onStop: () => void;
}) {
  const active = isPlaying || isLoading;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (active) onStop();
        else onPlay();
      }}
      aria-label={isPlaying ? "Stop speaking" : "Listen to this reply"}
      className={cn(
        "absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-all",
        "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        active && "opacity-100 border-primary/50 text-primary",
      )}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isPlaying ? (
        <Square className="h-3 w-3 fill-current" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span
        className={cn(
          "typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground"
        )}
      />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
    </div>
  );
}
