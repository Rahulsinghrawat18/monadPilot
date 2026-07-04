"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Send,
  Shuffle,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { CenterMic } from "./center-mic";
import { Mascot } from "@/components/mascot";
import { useChat } from "@/store/chat";
import { useChatStream } from "@/hooks/use-chat-stream";

const STARTERS = [
  {
    icon: Wallet,
    label: "Show me my wallets",
    sub: "WALLET · OVERVIEW",
    prompt: "Show me my wallets and balances on Base.",
  },
  {
    icon: Send,
    label: "Send 1 USDC to jesse.base.eth",
    sub: "TRANSFER · BASENAME",
    prompt: "Send 1 USDC to jesse.base.eth",
  },
  {
    icon: Shuffle,
    label: "Swap 0.05 ETH to USDC",
    sub: "SWAP · ON-CHAIN",
    prompt: "Swap 0.05 ETH to USDC on Base",
  },
  {
    icon: TrendingUp,
    label: "Best USDC yield, deposit 100",
    sub: "DEFI · MORPHO/MOONWELL",
    prompt:
      "Find the best USDC yield on Base, then deposit 100 USDC into the winner.",
  },
];

export function ChatContainer({
  isConnected,
  address,
}: {
  isConnected: boolean;
  address?: string | null;
}) {
  const messages = useChat((s) => s.messages);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { send } = useChatStream();

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        {messages.length === 0 ? (
          <EmptyState
            isConnected={isConnected}
            address={address}
            onPick={(p, opts) => send(p, opts)}
          />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-3xl">
          <ChatInput disabled={!isConnected} />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Every write requires approval in your Base Account. basePilot never
            holds your keys.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  isConnected,
  address,
  onPick,
}: {
  isConnected: boolean;
  address?: string | null;
  onPick: (prompt: string, opts?: { viaVoice?: boolean }) => void;
}) {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col justify-center gap-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl">
          <Mascot size={64} />
        </div>
        <h1 className="font-pixel-bold text-2xl tracking-[0.04em] sm:text-3xl">
          TALK TO DEFI.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          Voice-controlled DeFi on Base. Send, swap, farm yield, and manage
          positions in one sentence.
        </p>
        {isConnected && address && (
          <div className="font-pixel mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-[1px] bg-emerald-400" />
            CONNECTED · <span className="text-foreground">{shortAddr(address)}</span>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05, duration: 0.5, ease: "easeOut" }}
      >
        <CenterMic
          onTranscript={(t) => onPick(t, { viaVoice: true })}
          disabled={!isConnected}
        />
      </motion.div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {STARTERS.map((s, i) => (
          <motion.button
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
            disabled={!isConnected}
            onClick={() => onPick(s.prompt)}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left text-sm transition-all hover:border-primary/50 hover:bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] base-square text-white">
              <s.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{s.label}</div>
              <div className="font-pixel text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
                {s.sub}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </motion.button>
        ))}
      </div>

      {!isConnected && (
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-4 text-center text-sm">
          <p className="font-pixel-bold text-[11px] uppercase tracking-[0.15em] text-foreground">
            CONNECT BASE ACCOUNT
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            basePilot uses Base MCP to talk to your Base Account. You'll
            approve every write action in Base Account.
          </p>
        </div>
      )}
    </div>
  );
}

function shortAddr(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
