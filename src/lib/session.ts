import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type IronSessionData, type SessionOptions } from "iron-session";
import { refreshAccessToken, type PendingAuth } from "./mcp/oauth";

export type SessionShape = {
  /** Active Base MCP OAuth credentials (encrypted in the cookie). */
  mcp?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number; // ms epoch
    scope: string;
    clientId: string;
  };
  /** Cached address & profile once known. */
  account?: {
    address: `0x${string}`;
    chainId?: number;
    label?: string;
  };
  /** In-flight OAuth state (cleared on callback). */
  pendingAuth?: PendingAuth & { returnTo?: string };
};

declare module "iron-session" {
  interface IronSessionData extends SessionShape {}
}

const sessionPassword = process.env.SESSION_SECRET;
if (!sessionPassword || sessionPassword.length < 32) {
  // eslint-disable-next-line no-console
  console.warn(
    "[basepilot] SESSION_SECRET is missing or shorter than 32 chars — generate one with `openssl rand -base64 48`."
  );
}

export const sessionOptions: SessionOptions = {
  password:
    sessionPassword && sessionPassword.length >= 32
      ? sessionPassword
      : "basepilot-dev-only-replace-me-with-a-real-secret-please-32+chars",
  cookieName: "basepilot.sid",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  },
};

export async function getSession() {
  const c = await cookies();
  return getIronSession<IronSessionData>(c, sessionOptions);
}

/**
 * Returns a fresh access token, refreshing transparently if the cached
 * token is expired (or expiring within 60s). Throws if the session is
 * not authenticated or refresh fails.
 */
export async function getValidAccessToken(): Promise<string> {
  const session = await getSession();
  const mcp = session.mcp;
  if (!mcp) throw new Error("Not authenticated with Base MCP");

  const expiresSoon = mcp.expiresAt - Date.now() < 60 * 1000;
  if (!expiresSoon) return mcp.accessToken;

  if (!mcp.refreshToken) {
    // No refresh token — caller will see a 401 from MCP and trigger re-auth.
    return mcp.accessToken;
  }
  const refreshed = await refreshAccessToken(mcp.refreshToken, mcp.clientId);
  const newExpiry =
    Date.now() + (refreshed.expires_in ? refreshed.expires_in * 1000 : 60 * 60 * 1000);
  session.mcp = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? mcp.refreshToken,
    expiresAt: newExpiry,
    scope: refreshed.scope ?? mcp.scope,
    clientId: mcp.clientId,
  };
  await session.save();
  return refreshed.access_token;
}
