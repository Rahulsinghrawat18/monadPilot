"use client";

import Link from "next/link";
import { ConnectButton } from "./wallet/connect-button";
import { Mascot } from "./mascot";
import { SpeechToggle } from "./chat/speech-toggle";

export function SiteHeader({
  isConnected,
  address,
}: {
  isConnected: boolean;
  address?: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg">
            <Mascot size={36} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-pixel-bold text-[12px] text-foreground">
              basePilot
            </span>
            <span className="font-pixel hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              VOICE · DEFI · BASE
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <a
            href="https://docs.base.org/ai-agents/index"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden font-pixel text-[10px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            POWERED BY BASE MCP
          </a>
          <SpeechToggle />
          <ConnectButton isConnected={isConnected} address={address} />
        </div>
      </div>
    </header>
  );
}
