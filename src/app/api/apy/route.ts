import { NextRequest, NextResponse } from "next/server";
import { findYieldOpportunities } from "@/lib/apy/llama";

export const runtime = "nodejs";

/**
 * GET /api/apy?asset=USDC&protocols=morpho,moonwell&minTvlUsd=1000000
 *
 * Lists the best APY opportunities on Base for a given asset.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const asset = sp.get("asset");
  if (!asset) {
    return NextResponse.json({ error: "asset is required" }, { status: 400 });
  }
  const protocols = sp.get("protocols")?.split(",").filter(Boolean) as
    | Array<"morpho" | "moonwell" | "aerodrome">
    | undefined;
  const minTvlUsd = sp.get("minTvlUsd") ? Number(sp.get("minTvlUsd")) : undefined;
  const limit = sp.get("limit") ? Number(sp.get("limit")) : undefined;
  const singleSidedOnly = sp.get("single") === "1";

  try {
    const data = await findYieldOpportunities({
      asset,
      protocols,
      minTvlUsd,
      limit,
      singleSidedOnly,
    });
    return NextResponse.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
