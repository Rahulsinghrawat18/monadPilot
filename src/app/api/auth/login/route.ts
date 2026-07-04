import { NextRequest, NextResponse } from "next/server";
import { buildRedirectUri, startAuthorization } from "@/lib/mcp/oauth";
import { getSession } from "@/lib/session";

/**
 * GET /api/auth/login?returnTo=/somewhere
 *
 * Starts the Base MCP OAuth flow:
 *   1. Generates PKCE verifier + state, stored encrypted in the session.
 *   2. Returns (or redirects to) the authorize URL on mcp.base.org.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? url.origin;
  const redirectUri = buildRedirectUri(origin);
  const returnTo = url.searchParams.get("returnTo") ?? "/app";

  try {
    const { authorizeUrl, pending } = await startAuthorization(redirectUri);
    const session = await getSession();
    session.pendingAuth = { ...pending, returnTo };
    await session.save();

    if (url.searchParams.get("json") === "1") {
      return NextResponse.json({ authorizeUrl });
    }
    return NextResponse.redirect(authorizeUrl);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to start OAuth.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
