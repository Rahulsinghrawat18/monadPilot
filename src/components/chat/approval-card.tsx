"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Lock,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { ApprovalRef } from "@/store/chat";

export function ApprovalCard({
  approval,
  onPoll,
}: {
  approval: ApprovalRef;
  onPoll?: () => Promise<{ confirmed: boolean; failed: boolean } | undefined>;
}) {
  const [opened, setOpened] = useState(Boolean(approval.acknowledged));
  const [polling, setPolling] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = null;
    setPolling(false);
  }, []);

  const startPolling = useCallback(() => {
    if (!onPoll || pollIntervalRef.current) return;
    setPolling(true);
    pollIntervalRef.current = setInterval(async () => {
      const res = await onPoll();
      if (res?.confirmed || res?.failed) stopPolling();
    }, 3000);
  }, [onPoll, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    if (approval.status === "confirmed" || approval.status === "failed") {
      stopPolling();
    }
  }, [approval.status, stopPolling]);

  const handleOpen = () => {
    setOpened(true);
    startPolling();
  };

  const variant = approval.status ?? "pending";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "my-3 overflow-hidden rounded-2xl border bg-card",
        variant === "confirmed"
          ? "border-emerald-500/40 bg-emerald-500/[0.04]"
          : variant === "failed"
            ? "border-destructive/40 bg-destructive/[0.04]"
            : "border-primary/40 bg-primary/[0.04]"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            variant === "confirmed"
              ? "bg-emerald-500/15 text-emerald-400"
              : variant === "failed"
                ? "bg-destructive/15 text-destructive"
                : "bg-primary/15 text-primary"
          )}
        >
          {variant === "confirmed" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : variant === "failed" ? (
            <XCircle className="h-5 w-5" />
          ) : (
            <Lock className="h-5 w-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              {variant === "confirmed"
                ? "Transaction confirmed"
                : variant === "failed"
                  ? "Transaction failed"
                  : opened
                    ? "Waiting for approval…"
                    : "Approval required"}
            </div>
            {polling && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Polling…
              </div>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {variant === "confirmed"
              ? approval.tokenAddress
                ? "Your token is live on Base."
                : "Your Base Account broadcasted this transaction."
              : variant === "failed"
                ? "Base Account reported this request as rejected or failed."
                : approval.tokenAddress
                  ? "Approve in Base Account — your token address is already set (CREATE2)."
                  : "Open Base Account to review and approve."}
          </div>
          {approval.tokenAddress && (
            <TokenAddressBlock
              address={approval.tokenAddress}
              name={approval.tokenName}
              symbol={approval.tokenSymbol}
              confirmed={variant === "confirmed"}
            />
          )}
          {approval.txHash && (
            <a
              href={`https://basescan.org/tx/${approval.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View on BaseScan ({approval.txHash.slice(0, 10)}…)
            </a>
          )}
          {!approval.txHash && variant === "pending" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="default">
                <a
                  href={approval.approvalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleOpen}
                >
                  Approve Transaction
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </Button>
              {approval.requestId && opened && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!onPoll) return;
                    setPolling(true);
                    await onPoll();
                    setPolling(false);
                  }}
                >
                  I approved — check status
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TokenAddressBlock({
  address,
  name,
  symbol,
  confirmed,
}: {
  address: string;
  name?: string;
  symbol?: string;
  confirmed: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const label =
    name && symbol
      ? `${name} (${symbol})`
      : symbol
        ? symbol
        : "Token contract";

  return (
    <div
      className={cn(
        "mt-3 rounded-xl border p-3",
        confirmed
          ? "border-emerald-500/30 bg-emerald-500/[0.06]"
          : "border-primary/25 bg-primary/[0.04]"
      )}
    >
      <div className="font-pixel text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {confirmed ? "CONTRACT ADDRESS · LIVE" : "CONTRACT ADDRESS · PREVIEW"}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{label}</div>
      <div className="mt-2 flex items-start gap-2">
        <code className="flex-1 break-all font-mono text-[11px] leading-relaxed text-foreground/90">
          {address}
        </code>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 shrink-0 px-2"
          onClick={() => void copy()}
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="sr-only">Copy address</span>
        </Button>
      </div>
      {copied && (
        <p className="mt-1 text-[10px] text-emerald-400">Copied to clipboard</p>
      )}
      <div className="mt-2 flex flex-wrap gap-3">
        <a
          href={`https://basescan.org/token/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          BaseScan
        </a>
        <a
          href={`https://clanker.world/clanker/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Clanker
        </a>
      </div>
    </div>
  );
}
