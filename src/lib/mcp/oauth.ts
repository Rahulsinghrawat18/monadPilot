import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { getAuthServerMetadata, DEFAULT_SCOPES } from "./discovery";

/**
 * OAuth 2.1 PKCE client for the Base MCP server (mcp.base.org).
 *
 * Base MCP is a *public* OAuth client (no client secret) supporting only
 * the S256 code-challenge method. We use RFC 7591 Dynamic Client
 * Registration to grab a per-deployment `client_id`, then run the standard
 * authorization-code-with-PKCE flow.
 */

export type ClientRegistration = {
  client_id: string;
  client_id_issued_at?: number;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  grant_types: string[];
  response_types: string[];
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

export type PendingAuth = {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  scope: string;
  createdAt: number;
};

/** Helper: cryptographically random URL-safe string of N bytes. */
export function randomUrlSafe(bytes = 32): string {
  return randomBytes(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function pkceChallengeFor(verifier: string): string {
  return createHash("sha256")
    .update(verifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Register this app as a dynamic OAuth client with Base MCP. Cached
 * per-deployment to avoid hitting `/register` on every login.
 */
let cachedClient: ClientRegistration | null = null;

export async function registerOrGetClient(
  redirectUri: string
): Promise<ClientRegistration> {
  if (cachedClient && cachedClient.redirect_uris.includes(redirectUri)) {
    return cachedClient;
  }

  // Allow pinning a pre-registered client_id via env to skip DCR.
  const pinned = process.env.BASE_MCP_CLIENT_ID;
  if (pinned) {
    cachedClient = {
      client_id: pinned,
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    };
    return cachedClient;
  }

  const meta = await getAuthServerMetadata();
  const res = await fetch(meta.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_name:
        process.env.NEXT_PUBLIC_APP_NAME ?? "basePilot — voice DeFi copilot",
      client_uri:
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      scope: DEFAULT_SCOPES.join(" "),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Base MCP client registration failed (${res.status}): ${text}`);
  }
  cachedClient = (await res.json()) as ClientRegistration;
  return cachedClient;
}

export type AuthorizationStart = {
  authorizeUrl: string;
  pending: PendingAuth;
};

export async function startAuthorization(
  redirectUri: string,
  scopes: string[] = DEFAULT_SCOPES
): Promise<AuthorizationStart> {
  const meta = await getAuthServerMetadata();
  const client = await registerOrGetClient(redirectUri);

  const state = randomUrlSafe(24);
  const codeVerifier = randomUrlSafe(48);
  const codeChallenge = pkceChallengeFor(codeVerifier);
  const scope = scopes.join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return {
    authorizeUrl: `${meta.authorization_endpoint}?${params.toString()}`,
    pending: {
      state,
      codeVerifier,
      redirectUri,
      clientId: client.client_id,
      scope,
      createdAt: Date.now(),
    },
  };
}

export async function exchangeAuthorizationCode(
  code: string,
  pending: PendingAuth
): Promise<TokenResponse> {
  const meta = await getAuthServerMetadata();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: pending.redirectUri,
    client_id: pending.clientId,
    code_verifier: pending.codeVerifier,
  });
  const res = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string
): Promise<TokenResponse> {
  const meta = await getAuthServerMetadata();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  const res = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

export function buildRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/auth/callback`;
}
