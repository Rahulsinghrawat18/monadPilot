import "server-only";
import type {
  FunctionTool,
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import { findYieldOpportunities } from "@/lib/apy/llama";
import { getTokenPricesUsd } from "@/lib/wallet/prices";
import { getPortfolio } from "@/lib/wallet/portfolio";
import { findToken, TOKEN_LIST } from "@/lib/constants/tokens";
import { buildClankerDeployPlan } from "@/lib/clanker/deploy";
import { callTool, parseToolResult } from "@/lib/mcp/client";
import { isAddress, type Address } from "viem";

/** Context handed to every local tool by the chat route. */
export type LocalToolContext = {
  /** Currently connected user address (from Base MCP session), if known. */
  userAddress?: Address | null;
  /** Valid Base MCP OAuth access token. Required for tools that proxy
   *  through Base MCP server-side (e.g. send_calls relay). */
  accessToken?: string | null;
};

/**
 * Local function tools we expose to the model alongside Base MCP.
 *
 * These are read-only and live on top of Llama / on-chain RPCs. The model
 * uses them for things that Base MCP doesn't cover natively (cross-protocol
 * APY scans, spot price lookups, portfolio USD valuations).
 *
 * Writes are still routed exclusively through Base MCP — these tools never
 * sign anything.
 */

export const LOCAL_TOOLS: FunctionTool[] = [
  {
    type: "function",
    name: "find_base_yield",
    description:
      "Find the highest APY opportunities on Monad for a given asset across Ambient, Kuru, etc. Returns a ranked list with protocol, pool/vault name, APY, TVL, and reward tokens. Powered by DefiLlama yields.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        asset: {
          type: "string",
          description: "Asset symbol (e.g. USDC, MON, WMON, CHOG).",
        },
        protocols: {
          type: ["array", "null"],
          description:
            "Optional restriction. If omitted, includes ambient + kuru.",
          items: { type: "string", enum: ["ambient", "kuru"] },
        },
        minTvlUsd: {
          type: ["number", "null"],
          description:
            "Minimum TVL in USD. Defaults to 1,000,000 for high-quality results.",
        },
        singleSidedOnly: {
          type: ["boolean", "null"],
          description:
            "If true, exclude LP/IL-exposed pools. Use this for lend-only requests like 'where should I park USDC'.",
        },
        limit: {
          type: ["number", "null"],
          description: "Max results to return (default 6, max 15).",
        },
      },
      required: [
        "asset",
        "protocols",
        "minTvlUsd",
        "singleSidedOnly",
        "limit",
      ],
    },
  },
  {
    type: "function",
    name: "get_token_prices_usd",
    description:
      "Look up live USD spot prices for Monad tokens. Use this to compute USD values, slippage, or to convert between assets.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        tokens: {
          type: "array",
          description:
            "Token symbols or addresses on Monad (e.g. ['USDC','MON','CHOG']).",
          items: { type: "string" },
        },
      },
      required: ["tokens"],
    },
  },
  {
    type: "function",
    name: "read_portfolio",
    description:
      "Read the user's full Monad portfolio (token balances + USD valuations) for a given address. Use this when the user asks for a portfolio overview or 'what do I have'.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        address: {
          type: "string",
          description:
            "Base EVM address (0x…). Required — the model should already have it from Base MCP's get_wallets.",
        },
      },
      required: ["address"],
    },
  },
  {
    type: "function",
    name: "prepare_clanker_token",
    description:
      "Build a Clanker v4 ERC-20 deployment on Base (token + Uniswap V4 pool + optional vault + optional dev-buy). Returns a Base MCP send_calls payload ready to be approved by the user. Use this whenever the user asks to deploy/launch/create a token or coin via Clanker. Never claim the token is live until send_calls is approved on-chain.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: {
          type: "string",
          description: "Token name, e.g. 'BasePilot Token'.",
        },
        symbol: {
          type: "string",
          description: "Token symbol, 2-12 uppercase chars, e.g. 'PILOT'.",
        },
        image: {
          type: ["string", "null"],
          description:
            "Optional token image URL (ipfs://… or https://…).",
        },
        description: {
          type: ["string", "null"],
          description: "Optional short description embedded in metadata.",
        },
        tokenAdmin: {
          type: ["string", "null"],
          description:
            "Token admin 0x address. Omit (or pass null) to default to the connected user's wallet.",
        },
        vanity: {
          type: ["boolean", "null"],
          description:
            "Whether to grind a vanity 0x…b07 suffix address. Adds a few seconds. Default false.",
        },
        devBuyMon: {
          type: ["number", "null"],
          description:
            "Optional MON to spend buying the new token in the same transaction (e.g. 0.01).",
        },
        vaultPercent: {
          type: ["number", "null"],
          description:
            "Optional supply percentage to lock in the vault (0-90). Requires lockupDays.",
        },
        lockupDays: {
          type: ["number", "null"],
          description:
            "Vault lockup in days. Minimum 7. Required when vaultPercent > 0.",
        },
        vestingDays: {
          type: ["number", "null"],
          description:
            "Optional linear vesting in days after lockup. Defaults to lockupDays.",
        },
      },
      required: [
        "name",
        "symbol",
        "image",
        "description",
        "tokenAdmin",
        "vanity",
        "devBuyMon",
        "vaultPercent",
        "lockupDays",
        "vestingDays",
      ],
    },
  },
];

type FindBaseYieldArgs = {
  asset: string;
  protocols?: Array<"ambient" | "kuru"> | null;
  minTvlUsd?: number | null;
  singleSidedOnly?: boolean | null;
  limit?: number | null;
};
type GetPricesArgs = { tokens: string[] };
type ReadPortfolioArgs = { address: string };
type PrepareClankerArgs = {
  name: string;
  symbol: string;
  image?: string | null;
  description?: string | null;
  tokenAdmin?: string | null;
  vanity?: boolean | null;
  devBuyMon?: number | null;
  vaultPercent?: number | null;
  lockupDays?: number | null;
  vestingDays?: number | null;
};

export async function runLocalTool(
  name: string,
  rawArgs: unknown,
  ctx: LocalToolContext = {}
): Promise<string> {
  const args = (rawArgs ?? {}) as Record<string, unknown>;
  switch (name) {
    case "find_base_yield": {
      const a = args as FindBaseYieldArgs;
      const data = await findYieldOpportunities({
        asset: a.asset,
        protocols: a.protocols ?? undefined,
        minTvlUsd: a.minTvlUsd ?? 1_000_000,
        singleSidedOnly: a.singleSidedOnly ?? undefined,
        limit: Math.min(a.limit ?? 6, 15),
      });
      return JSON.stringify({ ok: true, results: data });
    }
    case "get_token_prices_usd": {
      const a = args as GetPricesArgs;
      const addresses: Address[] = [];
      const resolved: Array<{ symbol?: string; input: string; address: Address }> = [];
      for (const t of a.tokens ?? []) {
        const token = findToken(t);
        if (token) {
          addresses.push(token.address);
          resolved.push({ input: t, symbol: token.symbol, address: token.address });
        }
      }
      const prices = await getTokenPricesUsd(addresses);
      const out = resolved.map((r) => ({
        symbol: r.symbol,
        address: r.address,
        priceUsd: prices[r.address.toLowerCase()],
      }));
      return JSON.stringify({ ok: true, prices: out });
    }
    case "read_portfolio": {
      const a = args as ReadPortfolioArgs;
      let targetAddr = a.address;
      if (!targetAddr || !targetAddr.startsWith("0x") || targetAddr.toLowerCase().includes("yourmonadaddress")) {
        if (ctx.userAddress) {
          targetAddr = ctx.userAddress;
        } else {
          return JSON.stringify({
            ok: false,
            error: "Invalid address. Pass the user's 0x… address from get_wallets.",
          });
        }
      }
      const data = await getPortfolio(targetAddr as Address);
      return JSON.stringify({
        ok: true,
        account: data.account,
        totalUsd: data.totalUsd,
        balances: data.balances
          .filter((b) => Number(b.formatted) > 0)
          .map((b) => ({
            symbol: b.token.symbol,
            amount: b.formatted,
            usd: b.usd,
            priceUsd: b.priceUsd,
          })),
      });
    }
    case "prepare_clanker_token": {
      const a = args as PrepareClankerArgs;
      // Only accept a valid 0x address from the model; anything else
      // (empty string, "default", placeholder, etc.) falls back to the
      // connected user's address from the session.
      const adminInput =
        typeof a.tokenAdmin === "string" && isAddress(a.tokenAdmin.trim())
          ? (a.tokenAdmin.trim() as Address)
          : null;
      const tokenAdmin = adminInput ?? ctx.userAddress ?? null;
      if (!tokenAdmin || !isAddress(tokenAdmin)) {
        return JSON.stringify({
          ok: false,
          error:
            "No tokenAdmin available. Call Base MCP get_wallets first, then retry prepare_clanker_token passing that 0x address as tokenAdmin.",
        });
      }

      const vault =
        a.vaultPercent && a.vaultPercent > 0
          ? {
              percent: a.vaultPercent,
              lockupDays: Math.max(7, a.lockupDays ?? 7),
              vestingDays: a.vestingDays ?? a.lockupDays ?? 7,
            }
          : null;

      const plan = await buildClankerDeployPlan({
        name: a.name,
        symbol: a.symbol,
        tokenAdmin: tokenAdmin as Address,
        image: a.image ?? null,
        description: a.description ?? null,
        vanity: a.vanity ?? false,
        devBuyMon: a.devBuyMon ?? null,
        vault,
      });

      if (!plan.ok) return JSON.stringify(plan);

      // CRITICAL: forward send_calls to Base MCP server-side instead of
      // asking the model to copy ~6KB of calldata through a tool argument
      // (the model truncates large hex strings, causing "data failed
      // validation"). The AI just sees an approvalUrl in the response.
      if (!ctx.accessToken) {
        return JSON.stringify({
          ok: false,
          error:
            "Session is not authenticated — cannot relay send_calls to Base MCP.",
        });
      }

      const sendCallsPayload = {
        chain: plan.chain,
        calls: [{ to: plan.to, value: plan.value, data: plan.data }],
      };

      try {
        const rpcResult = await callTool(
          ctx.accessToken,
          "send_calls",
          sendCallsPayload
        );
        const parsed = parseToolResult(rpcResult);
        const text =
          typeof parsed.text === "string" ? parsed.text : JSON.stringify(parsed.data ?? "");
        const data = parsed.data ?? safeJsonParse(text);

        return JSON.stringify({
          ok: true,
          protocol: "clanker_v4",
          predictedTokenAddress: plan.predictedTokenAddress,
          summary: plan.summary,
          mcp: {
            tool: "send_calls",
            chain: plan.chain,
            call_count: 1,
            // Forwarded payload — extractApprovals on the chat-route side
            // will pull approvalUrl/requestId out of this for the UI.
            response: data,
            response_text: text,
          },
          instructions: [
            "Tell the user the token deployment is ready: surface the approval link with the phrase 'Approve Transaction'.",
            `The contract address (CA) is already known via CREATE2: ${plan.predictedTokenAddress}. Share this full address with the user immediately — they can copy it before approving.`,
            "After approval confirms, remind them the same CA is now live on Base. Link: https://clanker.world/clanker/" +
              plan.predictedTokenAddress,
          ].join(" "),
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Base MCP send_calls failed";
        return JSON.stringify({
          ok: false,
          error: `send_calls relay failed: ${message}`,
          payloadSent: {
            chain: sendCallsPayload.chain,
            callCount: sendCallsPayload.calls.length,
            firstCallTo: sendCallsPayload.calls[0].to,
            firstCallValue: sendCallsPayload.calls[0].value,
            firstCallDataPrefix: sendCallsPayload.calls[0].data.slice(0, 24),
            firstCallDataLen: sendCallsPayload.calls[0].data.length,
          },
        });
      }
    }
    default:
      return JSON.stringify({
        ok: false,
        error: `Unknown local tool: ${name}`,
      });
  }
}

export function buildFunctionCallOutput(
  call: ResponseFunctionToolCall,
  output: string
): ResponseInputItem {
  return {
    type: "function_call_output",
    call_id: (call.call_id || call.id || "") as string,
    output,
  };
}

function safeJsonParse(s: string): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export const KNOWN_TOKENS_HINT = TOKEN_LIST.map((t) => t.symbol).join(", ");
