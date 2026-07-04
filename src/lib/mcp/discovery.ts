/**
 * OAuth 2.1 discovery for the Base MCP server (mcp.base.org).
 *
 * Base MCP exposes a public-client OAuth flow with PKCE + dynamic client
 * registration (RFC 7591). We discover the endpoints once at module load
 * via the `.well-known/oauth-authorization-server` document, with a hard
 * fallback to the well-known endpoint values so the app keeps working even
 * if the discovery doc is briefly unreachable.
 */
export type AuthServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  scopes_supported: string[];
};

export const BASE_MCP_URL =
  process.env.NEXT_PUBLIC_BASE_MCP_URL?.replace(/\/$/, "") ??
  "https://mcp.base.org";

const FALLBACK: AuthServerMetadata = {
  issuer: BASE_MCP_URL,
  authorization_endpoint: `${BASE_MCP_URL}/authorize`,
  token_endpoint: `${BASE_MCP_URL}/token`,
  registration_endpoint: `${BASE_MCP_URL}/register`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  scopes_supported: ["agent_wallet:transact", "agent_wallet:escalate"],
};

let cache: { metadata: AuthServerMetadata; ts: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function getAuthServerMetadata(): Promise<AuthServerMetadata> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.metadata;
  try {
    const res = await fetch(`${BASE_MCP_URL}/.well-known/oauth-authorization-server`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const metadata = (await res.json()) as AuthServerMetadata;
      cache = { metadata, ts: Date.now() };
      return metadata;
    }
  } catch {
    /* fall through */
  }
  cache = { metadata: FALLBACK, ts: Date.now() };
  return FALLBACK;
}

export const DEFAULT_SCOPES = ["agent_wallet:transact"];
