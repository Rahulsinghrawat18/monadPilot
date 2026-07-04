import { NextResponse } from "next/server";
import { getSession, getValidAccessToken } from "@/lib/session";
import { callTool, parseToolResult } from "@/lib/mcp/client";

/**
 * GET /api/auth/me — returns the current session info, including a
 * best-effort wallet snapshot (the user's primary wallet across chains).
 */
export async function GET() {
  const session = await getSession();
  if (!session.mcp) {
    return NextResponse.json({ authenticated: false });
  }

  let wallets: unknown = null;
  let primaryAddress: string | undefined;
  try {
    const token = await getValidAccessToken();
    const result = await callTool(token, "get_wallets", {});
    const parsed = parseToolResult(result);
    wallets = parsed.data ?? parsed.text;
    // Best-effort extraction of an EVM address.
    const stringified = JSON.stringify(parsed.data ?? parsed.text);
    const match = stringified.match(/0x[a-fA-F0-9]{40}/);
    if (match) primaryAddress = match[0];

    if (primaryAddress && !session.account) {
      session.account = { address: primaryAddress as `0x${string}` };
      await session.save();
    }
  } catch (e) {
    // If get_wallets fails (e.g., tool renamed), we still report authenticated.
    return NextResponse.json({
      authenticated: true,
      address: session.account?.address,
      wallets: null,
      warning: e instanceof Error ? e.message : "Could not load wallets",
    });
  }

  return NextResponse.json({
    authenticated: true,
    address: primaryAddress ?? session.account?.address,
    scope: session.mcp.scope,
    wallets,
  });
}
