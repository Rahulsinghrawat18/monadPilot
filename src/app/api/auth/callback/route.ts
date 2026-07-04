import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode } from "@/lib/mcp/oauth";
import { getSession } from "@/lib/session";
import { initializeSession } from "@/lib/mcp/client";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const session = await getSession();
  const pending = session.pendingAuth;

  if (err) {
    session.pendingAuth = undefined;
    await session.save();
    return redirectWithError(url, err);
  }
  if (!pending || !code || !state) {
    return redirectWithError(url, "missing_state");
  }
  if (state !== pending.state) {
    session.pendingAuth = undefined;
    await session.save();
    return redirectWithError(url, "state_mismatch");
  }

  try {
    const tokens = await exchangeAuthorizationCode(code, pending);
    const expiresAt =
      Date.now() + (tokens.expires_in ? tokens.expires_in * 1000 : 60 * 60 * 1000);

    session.mcp = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope ?? pending.scope,
      clientId: pending.clientId,
    };
    session.pendingAuth = undefined;
    await session.save();

    // Warm the MCP session so the first chat call is fast.
    initializeSession(tokens.access_token).catch(() => {});

    const dest = pending.returnTo ?? "/app";
    return NextResponse.redirect(new URL(dest, url.origin));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Token exchange failed";
    return redirectWithError(url, "exchange_failed", message);
  }
}

function redirectWithError(url: URL, code: string, message?: string) {
  const dest = new URL("/", url.origin);
  dest.searchParams.set("auth_error", code);
  if (message) dest.searchParams.set("auth_message", message);
  return NextResponse.redirect(dest);
}
