"use client";

import { useCallback, useState } from "react";
import { Loader2, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export type ConnectButtonProps = {
  isConnected: boolean;
  address?: string | null;
  variant?: "default" | "gradient";
};

export function ConnectButton({
  isConnected,
  address,
  variant = "gradient",
}: ConnectButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleConnect = useCallback(async () => {
    setPending(true);
    try {
      if (typeof window === "undefined") return;
      const provider = (window as any).ethereum;
      if (!provider) {
        // Fallback if MetaMask is not found
        alert("MetaMask or compatible Web3 wallet not found in browser. Proceeding with simulated account.");
        window.location.href = "/api/auth/login?returnTo=/app";
        return;
      }

      const accounts = await provider.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        window.location.href = `/api/auth/login?returnTo=/app&address=${encodeURIComponent(address)}`;
      } else {
        setPending(false);
      }
    } catch (e: any) {
      console.error("MetaMask connection failed", e);
      setPending(false);
      alert(e.message || "Failed to connect wallet.");
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }, [router]);

  if (!isConnected) {
    return (
      <Button
        type="button"
        variant={variant}
        size="lg"
        onClick={handleConnect}
        disabled={pending}
        className="font-pixel-bold text-[11px] uppercase tracking-[0.12em]"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        CONNECT MONAD WALLET
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-1.5 text-sm">
      <span className="h-1.5 w-1.5 rounded-[1px] bg-emerald-400" />
      <span className="font-mono text-xs">
        {address ? short(address) : "Connected"}
      </span>
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={pending}
        title="Disconnect"
        className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LogOut className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function short(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
