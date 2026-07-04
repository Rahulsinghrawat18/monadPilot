import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Mic,
  Shield,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { ConnectButton } from "@/components/wallet/connect-button";
import { Mascot, MascotBanner } from "@/components/mascot";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string; auth_message?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const isConnected = Boolean(session.mcp);
  const address = session.account?.address ?? null;

  if (isConnected) redirect("/app");

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader isConnected={isConnected} address={address} />

      <main className="relative flex-1 overflow-hidden">
        <div className="gradient-mesh absolute inset-0 -z-20 opacity-80" />
        <div className="pixel-grid absolute inset-0 -z-10 opacity-60" />

        <section className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-20">
          {/* Top tag */}
          <div className="font-pixel inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/[0.08] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
            <span className="pixel-pulse inline-block h-1.5 w-1.5 rounded-[1px] bg-primary" />
          LIVE
          </div>

          {/* Mascot hero banner */}
          <div className="scanlines relative mt-8 w-full max-w-3xl">
            <MascotBanner />
          </div>

          {/* Headline — pixel/dot-matrix */}
          <h1 className="font-pixel-bold mt-10 text-[28px] leading-[1.15] tracking-[0.04em] sm:text-[42px]">
            TALK TO DEFI.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground sm:text-base">
            Voice-controlled DeFi on Base. Send, swap, farm yield, and manage
            positions —{" "}
            <span className="text-foreground">in one sentence.</span>
          </p>

          {sp.auth_error && (
            <div className="font-pixel mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-[11px] uppercase tracking-wider text-destructive">
              {sp.auth_message ??
                `AUTH FAILED: ${sp.auth_error}. PLEASE TRY AGAIN.`}
            </div>
          )}

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <ConnectButton isConnected={false} variant="gradient" />
            <Link
              href="#how"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              See how it works <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <ExamplePrompts />
        </section>

        {/* Feature grid */}
        <section
          id="how"
          className="relative mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 pb-20 sm:grid-cols-3 sm:px-6"
        >
          <FeatureCard
            icon={Mic}
            title="PUSH-TO-TALK"
            body="Hold the mic. Speak naturally. Whisper transcribes, GPT-4 orchestrates, Base MCP executes."
          />
          <FeatureCard
            icon={Shield}
            title="EVERY WRITE APPROVED"
            body="No keys leave Base Account. Each transaction returns a one-click approval link. You're in control."
          />
          <FeatureCard
            icon={Zap}
            title="DEFI-NATIVE"
            body="Morpho, Moonwell, Aerodrome, Uniswap — discover yields, deposit, swap, LP. All in one sentence."
          />
        </section>

        {/* Capabilities strip */}
        <section className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-[2px] bg-[#ed6a5e]" />
                <span className="h-2 w-2 rounded-[2px] bg-[#f5bf4f]" />
                <span className="h-2 w-2 rounded-[2px] bg-[#61c554]" />
              </div>
              <span className="font-pixel text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                BASEPILOT TERMINAL
              </span>
              <span className="font-pixel text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                BASE MAINNET
              </span>
            </div>
            <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-5">
                <Capability
                  icon={Wallet}
                  label="WALLET"
                  prompt='"Show me my wallets and balances"'
                />
                <Capability
                  icon={ArrowRight}
                  label="TRANSFER"
                  prompt='"Send 5 USDC to jesse.base.eth"'
                />
                <Capability
                  icon={Sparkles}
                  label="SWAP"
                  prompt='"Swap 0.05 ETH to USDC"'
                />
              </div>
              <div className="p-5">
                <Capability
                  icon={TrendingUp}
                  label="DISCOVER"
                  prompt='"Find the best USDC yield on Base"'
                />
                <Capability
                  icon={Shield}
                  label="DEPOSIT"
                  prompt='"Deposit 100 USDC into the winner"'
                />
                <Capability
                  icon={Mic}
                  label="VOICE"
                  prompt='Hold the mic and say it.'
                />
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-border py-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Mascot size={28} />
              <span className="font-pixel text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                BASEPILOT · TALK TO DEFI
              </span>
            </div>
            <a
              href="https://docs.base.org/ai-agents"
              target="_blank"
              rel="noopener noreferrer"
              className="font-pixel text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              POWERED BY BASE MCP →
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Mic;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card/70 p-5 backdrop-blur transition-colors hover:border-primary/40">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg base-square">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <h3 className="font-pixel-bold text-[11px] uppercase tracking-[0.15em]">
        {title}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Capability({
  icon: Icon,
  label,
  prompt,
}: {
  icon: typeof Mic;
  label: string;
  prompt: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-[4px] bg-secondary text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-pixel text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <div className="text-sm text-foreground/90 truncate">{prompt}</div>
      </div>
    </div>
  );
}

const PROMPTS = [
  "SEND 5 USDC TO JESSE.BASE.ETH",
  "SWAP 0.05 ETH → USDC",
  "FIND BEST USDC YIELD",
  "DEPOSIT 100 USDC INTO MORPHO",
];

function ExamplePrompts() {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {PROMPTS.map((p) => (
        <span
          key={p}
          className="font-pixel rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {p}
        </span>
      ))}
    </div>
  );
}
