"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { Button } from "@/components/ui/button";
import { useChat } from "@/store/chat";
import { useChatStream } from "@/hooks/use-chat-stream";
import { VoiceButton } from "./voice-button";

export function ChatInput({ disabled }: { disabled?: boolean }) {
  const inputDraft = useChat((s) => s.inputDraft);
  const setInput = useChat((s) => s.setInput);
  const pending = useChat((s) => s.pending);
  const { send, cancel } = useChatStream();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputDraft.trim() || disabled) return;
    send(inputDraft);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.4)]"
    >
      <VoiceButton
        onTranscript={(t) => {
          setInput(t);
          // Auto-send the transcript so voice → action stays seamless.
          requestAnimationFrame(() => send(t, { viaVoice: true }));
        }}
        disabled={disabled || pending}
      />
      <TextareaAutosize
        ref={textareaRef}
        value={inputDraft}
        onChange={(e) => setInput(e.target.value)}
        placeholder={
          disabled
            ? "Connect Base Account to start chatting…"
            : "Ask anything. Try: ‘Find the best USDC yield and deposit 100’"
        }
        disabled={disabled}
        minRows={1}
        maxRows={6}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="flex-1 resize-none bg-transparent px-2 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
      />
      {pending ? (
        <Button
          type="button"
          onClick={cancel}
          variant="secondary"
          size="icon"
          className="h-11 w-11"
          aria-label="Stop generation"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </Button>
      ) : (
        <Button
          type="submit"
          variant="gradient"
          size="icon"
          className="h-11 w-11"
          disabled={!inputDraft.trim() || disabled}
          aria-label="Send"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
