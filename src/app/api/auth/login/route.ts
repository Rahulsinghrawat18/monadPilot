import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/**
 * GET /api/auth/login?returnTo=/somewhere
 *
 * Mocks the authentication flow for monadPilot:
 *   Instantly grants a mock session with Monad parameters and redirects to /app.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/app";

  try {
    const session = await getSession();

    // Grant mock session for Monad mode!
    session.mcp = {
      accessToken: "mock-monad-mcp-token",
      refreshToken: "mock-monad-mcp-refresh",
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      scope: "agent_wallet:transact",
      clientId: "mock-monad-client-id",
    };

    const address = url.searchParams.get("address") || "0x836EFD0000000000000000000000000000000143";
    session.account = {
      address: address as `0x${string}`,
      chainId: 143, // Monad Mainnet ID
      label: "Monad Primary Wallet",
    };

    await session.save();

    if (url.searchParams.get("json") === "1") {
      return NextResponse.json({ authorizeUrl: returnTo });
    }
    return NextResponse.redirect(new URL(returnTo, url.origin));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to start Monad auth session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
