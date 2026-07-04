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

  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDirectApprove = async () => {
    if (!approval.requestId) return;
    setApproving(true);
    setError(null);
    try {
      // 1) Fetch target transaction details from local MCP server
      const detailsRes = await fetch(`/api/mcp/request-details?requestId=${encodeURIComponent(approval.requestId)}`);
      if (!detailsRes.ok) throw new Error("Transaction details not found.");
      const details = await detailsRes.json();

      let customTxHash: string | null = null;
      const eth = (window as any).ethereum;

      if (eth) {
        // 2) switch / add Monad Mainnet
        const chainId = await eth.request({ method: "eth_chainId" });
        if (chainId !== "0x8f") {
          try {
            await eth.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x8f" }],
            });
          } catch (switchError: any) {
            if (switchError.code === 4902) {
              try {
                await eth.request({
                  method: "wallet_addEthereumChain",
                  params: [
                    {
                      chainId: "0x8f",
                      chainName: "Monad Mainnet",
                      nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
                      rpcUrls: ["https://rpc.monad.xyz"],
                      blockExplorerUrls: ["https://monadvision.xyz"],
                    },
                  ],
                });
              } catch (addError) {
                console.error("Failed to add Monad chain", addError);
              }
            }
          }
        }

        // 3) Request account connection
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        if (accounts && accounts.length > 0) {
          let txParams: any = null;

          const isValidAddress = (addr: string) => {
            if (!addr) return false;
            return /^0x[a-fA-F0-9]{40}$/.test(addr);
          };

          if (details?.tool === "send_tokens") {
            const amountFloat = parseFloat(details?.details?.amount || "0") || 0;
            const valueHex = "0x" + BigInt(Math.floor(amountFloat * 1e18)).toString(16);
            txParams = {
              from: accounts[0],
              to: isValidAddress(details?.details?.to) ? details.details.to : accounts[0],
              value: valueHex,
            };
          } else if (details?.tool === "deposit") {
            const amountFloat = parseFloat(details?.details?.amount || "0") || 0;
            const valueHex = "0x" + BigInt(Math.floor(amountFloat * 1e18)).toString(16);
            txParams = {
              from: accounts[0],
              to: isValidAddress(details?.details?.poolId)
                ? details.details.poolId
                : "0x1111111111111111111111111111111111111111",
              value: valueHex,
            };
          } else if (details?.tool === "swap_tokens") {
            const amountFloat = parseFloat(details?.details?.amount || "0") || 0;
            const valueHex = "0x" + BigInt(Math.floor(amountFloat * 1e18)).toString(16);
            txParams = {
              from: accounts[0],
              to: accounts[0],
              value: valueHex,
              data: "0x" + Array.from(new TextEncoder().encode("Swap " + details?.details?.amount + " " + details?.details?.from + " to " + details?.details?.to)).map(b => b.toString(16).padStart(2, '0')).join(""),
            };
          } else if (details?.tool === "send_calls") {
            const firstCall = details?.details?.calls?.[0];
            let callValueHex = "0x0";
            if (firstCall?.value) {
              if (firstCall.value.startsWith("0x")) {
                callValueHex = firstCall.value;
              } else {
                try {
                  callValueHex = "0x" + BigInt(firstCall.value).toString(16);
                } catch {
                  callValueHex = "0x0";
                }
              }
            }
            txParams = {
              from: accounts[0],
              to: isValidAddress(firstCall?.to) ? firstCall.to : accounts[0],
              value: callValueHex,
              data: firstCall?.data || "0x",
            };
          }

          if (txParams) {
            customTxHash = await eth.request({
              method: "eth_sendTransaction",
              params: [txParams],
            });
          }
        }
      }

      // 4) Submit approval confirmation back to mock server
      const submitRes = await fetch("/api/mcp/approve-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: approval.requestId, txHash: customTxHash || undefined }),
      });
      if (!submitRes.ok) throw new Error("Approval confirmation failed.");
      const data = await submitRes.json();
      if (data.ok) {
        setOpened(true);
        startPolling();
      } else {
        throw new Error(data.error || "Approval confirmation failed.");
      }
    } catch (err: any) {
      console.warn("Direct wallet signing failed:", err?.message || (typeof err === "object" ? JSON.stringify(err) : err));
      const errorMsg = (err?.message || "").toLowerCase();
      if (
        err?.code === 4001 ||
        errorMsg.includes("rejected") ||
        errorMsg.includes("denied") ||
        errorMsg.includes("user denied")
      ) {
        window.alert("Transaction rejected in wallet.");
        setError("Transaction rejected in wallet.");
      } else {
        window.alert(err?.message || "Approval signing failed.");
        setError(err?.message || "Approval signing failed.");
      }
    } finally {
      setApproving(false);
    }
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
                ? "Your token is live on Monad."
                : "Your Monad Wallet broadcasted this transaction."
              : variant === "failed"
                ? "Monad Wallet reported this request as rejected or failed."
                : approval.tokenAddress
                  ? "Approve in Monad Wallet — your token address is already set (CREATE2)."
                  : "Open Monad Wallet to review and approve."}
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
              href={`https://monadvision.com/tx/${approval.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View on MonadVision ({approval.txHash.slice(0, 10)}…)
            </a>
          )}
          {!approval.txHash && variant === "pending" && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleDirectApprove}
                  disabled={approving}
                >
                  {approving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Approving…
                    </>
                  ) : (
                    <>
                      Approve Transaction
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </>
                  )}
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
              {error && (
                <div className="text-[11.5px] font-semibold text-destructive mt-1">
                  {error}
                </div>
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
          href={`https://monadvision.com/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          MonadVision
        </a>
      </div>
    </div>
  );
}
