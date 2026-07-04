import { NextResponse } from "next/server";
import type { Address } from "viem";
import { getSession } from "@/lib/session";
import { getPortfolio } from "@/lib/wallet/portfolio";

export const runtime = "nodejs";

/**
 * GET /api/portfolio
 *
 * Returns the user's Base mainnet portfolio (balances + USD valuations).
 * Reads on-chain directly (so it works for any address surfaced by Base
 * MCP) and merges in DefiLlama prices.
 */
export async function GET() {
  const session = await getSession();
  const account = session.account?.address;
  if (!account) {
    return NextResponse.json(
      { error: "No address on file. Connect Base MCP first." },
      { status: 401 }
    );
  }

  try {
    const portfolio = await getPortfolio(account as Address);
    return NextResponse.json({
      account,
      totalUsd: portfolio.totalUsd,
      balances: portfolio.balances.map((b) => ({
        symbol: b.token.symbol,
        name: b.token.name,
        address: b.token.address,
        decimals: b.token.decimals,
        amount: b.formatted,
        usd: b.usd,
        priceUsd: b.priceUsd,
        logoURI: b.token.logoURI,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load portfolio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
