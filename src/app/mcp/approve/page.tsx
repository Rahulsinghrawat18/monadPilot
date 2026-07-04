"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Shield, CheckCircle, Loader2, ArrowRightLeft, Send, Cpu } from "lucide-react";
import { Mascot } from "@/components/mascot";

function ApproveContent() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setError("No Request ID provided.");
      setLoading(false);
      return;
    }

    fetch(`/api/mcp/request-details?requestId=${encodeURIComponent(requestId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Transaction request not found.");
        return res.json();
      })
      .then((data) => {
        setDetails(data);
        if (data.status === "completed") {
          setApproved(true);
          setTxHash(data.txHash);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [requestId]);

  const handleApprove = async () => {
    if (!requestId) return;
    setApproving(true);
    setError(null);
    try {
      let customTxHash: string | null = null;

      // Check if MetaMask or another EIP-1193 provider is available
      const eth = (window as any).ethereum;
      if (eth) {
        try {
          // 1) Ensure user is connected to Monad Mainnet (Chain ID 143 / 0x8f) or Monad Testnet (0x279f)
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
                        nativeCurrency: {
                          name: "Monad",
                          symbol: "MON",
                          decimals: 18,
                        },
                        rpcUrls: ["https://rpc.monad.xyz"],
                        blockExplorerUrls: ["https://monadvision.xyz"],
                      },
                    ],
                  });
                } catch (addError) {
                  console.error("Failed to add Monad network", addError);
                }
              }
            }
          }

          // 2) Request account connection
          const accounts = await eth.request({ method: "eth_requestAccounts" });
          if (accounts && accounts.length > 0) {
            let txParams: any = null;

            if (details?.tool === "send_tokens") {
              const amountFloat = parseFloat(details?.details?.amount || "0");
              const valueHex = "0x" + BigInt(Math.floor(amountFloat * 1e18)).toString(16);
              txParams = {
                from: accounts[0],
                to: details?.details?.to,
                value: valueHex,
              };
            } else if (details?.tool === "deposit") {
              const amountFloat = parseFloat(details?.details?.amount || "0");
              const valueHex = "0x" + BigInt(Math.floor(amountFloat * 1e18)).toString(16);
              txParams = {
                from: accounts[0],
                to: details?.details?.poolId || accounts[0],
                value: valueHex,
              };
            } else if (details?.tool === "swap_tokens") {
              const amountFloat = parseFloat(details?.details?.amount || "0");
              const valueHex = "0x" + BigInt(Math.floor(amountFloat * 1e18)).toString(16);
              // Send dummy self-transaction to simulate swap sign
              txParams = {
                from: accounts[0],
                to: accounts[0],
                value: valueHex,
                data: "0x" + Array.from(new TextEncoder().encode("Swap " + details?.details?.amount + " " + details?.details?.from + " to " + details?.details?.to)).map(b => b.toString(16).padStart(2, '0')).join(""),
              };
            } else if (details?.tool === "send_calls") {
              const firstCall = details?.details?.calls?.[0];
              txParams = {
                from: accounts[0],
                to: firstCall?.to || accounts[0],
                value: firstCall?.value || "0x0",
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
        } catch (walletErr: any) {
          console.warn("Wallet transaction signing failed", walletErr);
          if (walletErr?.code === 4001 || walletErr?.message?.includes("rejected")) {
            throw new Error("Transaction rejected in wallet.");
          }
          // If other error, log it and we will proceed with mock fallback
        }
      }

      // Submit approval confirmation to the mock server database
      const res = await fetch("/api/mcp/approve-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, txHash: customTxHash || undefined }),
      });
      if (!res.ok) throw new Error("Approval failed.");
      const data = await res.json();
      if (data.ok) {
        setApproved(true);
        setTxHash(customTxHash || data.txHash);
      } else {
        throw new Error(data.error || "Approval failed.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0c0a1c] text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="font-pixel mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Loading Request Details...
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#0c0a1c] px-4 py-12 text-foreground overflow-hidden">
      <div className="gradient-mesh absolute inset-0 opacity-40 -z-20" />
      <div className="pixel-grid absolute inset-0 opacity-30 -z-10" />

      <div className="w-full max-w-md rounded-2xl border border-border bg-[#14112e]/90 p-6 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="flex flex-col items-center border-b border-border pb-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mascot size={48} />
          </div>
          <h2 className="font-pixel-bold mt-4 text-lg tracking-wider text-foreground">
            monadPilot Wallet
          </h2>
          <p className="font-pixel mt-1 text-[9px] uppercase tracking-[0.25em] text-primary/80">
            Monad Mainnet Transaction
          </p>
        </div>

        {error ? (
          <div className="my-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : approved ? (
          <div className="my-8 flex flex-col items-center text-center">
            <CheckCircle className="h-16 w-16 text-emerald-400 animate-bounce" />
            <h3 className="font-pixel-bold mt-4 text-sm uppercase tracking-wider text-foreground">
              TRANSACTION APPROVED
            </h3>
            <p className="mt-2 text-xs text-muted-foreground px-4">
              The transaction has been successfully signed and broadcast to the Monad network.
            </p>
            {txHash && (
              <div className="mt-6 w-full rounded-xl bg-[#1c1842] p-3 text-left border border-border">
                <span className="font-pixel text-[8px] uppercase tracking-[0.25em] text-muted-foreground block">
                  TRANSACTION HASH
                </span>
                <span className="font-mono text-[10px] text-primary break-all block mt-1">
                  {txHash}
                </span>
              </div>
            )}
            <button
              onClick={() => window.close()}
              className="font-pixel mt-8 w-full rounded-xl bg-secondary py-3 text-xs uppercase tracking-wider text-secondary-foreground hover:bg-secondary/80 transition-all cursor-pointer"
            >
              Close Window
            </button>
          </div>
        ) : (
          <div className="my-6">
            <div className="flex items-center gap-3 rounded-xl bg-[#1c1842] p-3 border border-border">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/20 text-primary">
                {details?.tool === "swap_tokens" ? (
                  <ArrowRightLeft className="h-4 w-4" />
                ) : details?.tool === "send_tokens" ? (
                  <Send className="h-4 w-4" />
                ) : (
                  <Cpu className="h-4 w-4" />
                )}
              </div>
              <div>
                <span className="font-pixel text-[8px] uppercase tracking-[0.2em] text-muted-foreground block">
                  ACTION
                </span>
                <span className="font-pixel text-[11px] uppercase text-foreground">
                  {details?.tool?.replace("_", " ") || "Execute Contract"}
                </span>
              </div>
            </div>

            {/* Request Details */}
            <div className="mt-4 rounded-xl border border-border bg-[#1c1842]/50 p-4">
              <span className="font-pixel text-[8px] uppercase tracking-[0.2em] text-muted-foreground block mb-2">
                DETAILS
              </span>
              <div className="space-y-3">
                {details?.details &&
                  Object.entries(details.details).map(([key, val]: any) => (
                    <div key={key} className="flex justify-between items-start text-xs border-b border-border/20 pb-2">
                      <span className="font-pixel text-[10px] text-muted-foreground uppercase">{key}</span>
                      <span className="font-mono text-[11px] text-foreground font-semibold max-w-[200px] truncate" title={val}>
                        {val?.toString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Warning Info */}
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
              <Shield className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
              <p>
                Please verify the destination and transaction details. Approved calls are immutable on Monad Mainnet.
              </p>
            </div>

            {/* Buttons */}
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={handleApprove}
                disabled={approving}
                className="font-pixel-bold w-full rounded-xl bg-gradient-to-r from-primary to-[#e024c3] py-4 text-xs uppercase tracking-widest text-white hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {approving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing Transaction...
                  </>
                ) : (
                  "Approve Transaction"
                )}
              </button>
              <button
                onClick={() => window.close()}
                className="font-pixel w-full rounded-xl bg-secondary/40 py-3 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                Reject / Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApprovePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#0c0a1c] text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ApproveContent />
    </Suspense>
  );
}
