import "server-only";
import { BASE_MCP_URL } from "./discovery";

/**
 * Lightweight JSON-RPC 2.0 client for the Base MCP Streamable-HTTP transport.
 *
 * The MCP spec uses POST + Accept: application/json,text/event-stream. For
 * single-shot tool calls we just want the JSON response; the server happily
 * returns plain JSON when the response fits in a single payload.
 *
 * We keep this client small and dependency-free so it works in Edge & Node
 * runtimes alike. The `@modelcontextprotocol/sdk` is reserved for richer
 * streaming use-cases.
 */

export class McpError extends Error {
  code: number;
  data: unknown;
  status: number;
  constructor(message: string, opts: { code?: number; data?: unknown; status?: number } = {}) {
    super(message);
    this.name = "McpError";
    this.code = opts.code ?? -32000;
    this.data = opts.data;
    this.status = opts.status ?? 0;
  }
}

type JsonRpcResponse<T = unknown> =
  | { jsonrpc: "2.0"; id: string | number; result: T }
  | { jsonrpc: "2.0"; id: string | number; error: { code: number; message: string; data?: unknown } };

let counter = 0;
function nextId() {
  counter = (counter + 1) % 1_000_000;
  return counter;
}

async function rpc<T>(
  accessToken: string,
  method: string,
  params?: Record<string, unknown>,
  init: { sessionId?: string } = {}
): Promise<{ data: T; sessionId?: string }> {
  const body = {
    jsonrpc: "2.0" as const,
    id: nextId(),
    method,
    params,
  };
  const res = await fetch(BASE_MCP_URL + "/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      ...(init.sessionId ? { "Mcp-Session-Id": init.sessionId } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const sessionId = res.headers.get("Mcp-Session-Id") ?? undefined;

  if (res.status === 401) {
    throw new McpError("Base MCP session expired — please reconnect.", {
      status: 401,
    });
  }

  const text = await res.text();
  if (!res.ok) {
    throw new McpError(`Base MCP HTTP ${res.status}: ${text}`, {
      status: res.status,
    });
  }

  // SSE-style stream: each line begins with "data: ". Collapse to the
  // final non-empty data payload (single-shot responses always send one).
  let payloadText = text;
  if (text.startsWith("event:") || text.includes("\ndata:")) {
    const lines = text.split(/\r?\n/);
    const dataLines = lines
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    payloadText = dataLines[dataLines.length - 1] ?? "{}";
  }

  let parsed: JsonRpcResponse<T>;
  try {
    parsed = JSON.parse(payloadText) as JsonRpcResponse<T>;
  } catch {
    throw new McpError(`Invalid JSON from Base MCP: ${payloadText.slice(0, 200)}`);
  }

  if ("error" in parsed) {
    throw new McpError(parsed.error.message, {
      code: parsed.error.code,
      data: parsed.error.data,
    });
  }

  return { data: parsed.result, sessionId };
}

/* --------------------------------------------------------------------- *
 *  High-level helpers                                                    *
 * --------------------------------------------------------------------- */

let cachedSessionId: string | undefined;

export type McpInitializeResult = {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  serverInfo: { name: string; version: string };
  instructions?: string;
};

export async function initializeSession(accessToken: string) {
  const { data, sessionId } = await rpc<McpInitializeResult>(
    accessToken,
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: { roots: { listChanged: false } },
      clientInfo: { name: "basepilot", version: "0.1.0" },
    }
  );
  if (sessionId) cachedSessionId = sessionId;
  return data;
}

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export async function listTools(accessToken: string): Promise<McpTool[]> {
  if (!cachedSessionId) {
    await initializeSession(accessToken);
  }
  const { data } = await rpc<{ tools: McpTool[] }>(
    accessToken,
    "tools/list",
    {},
    { sessionId: cachedSessionId }
  );
  return data.tools;
}

export type McpToolResult = {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "resource"; resource: { uri: string; mimeType?: string; text?: string } }
  >;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

export async function callTool(
  accessToken: string,
  name: string,
  args: Record<string, unknown> = {}
): Promise<McpToolResult> {
  if (!cachedSessionId) {
    await initializeSession(accessToken);
  }
  const { data } = await rpc<McpToolResult>(
    accessToken,
    "tools/call",
    { name, arguments: args },
    { sessionId: cachedSessionId }
  );
  return data;
}

/**
 * Convenience: parse the textual content of a tool result as JSON if it
 * looks like JSON, else return the raw text.
 */
export function parseToolResult(
  result: McpToolResult
): { text: string; data?: unknown; isError: boolean } {
  const parts = result.content ?? [];
  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n")
    .trim();
  let data: unknown = result.structuredContent;
  if (data === undefined && text) {
    try {
      if (text.startsWith("{") || text.startsWith("[")) {
        data = JSON.parse(text);
      }
    } catch {
      /* not JSON — keep as text */
    }
  }
  return { text, data, isError: result.isError ?? false };
}
