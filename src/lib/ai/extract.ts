/**
 * Pull out approval URLs and request IDs from Base MCP tool outputs.
 *
 * Base MCP returns approval-mode payloads of the rough shape
 *   { approvalUrl: "https://...", requestId: "req_..." }
 * but the exact field name may vary by tool/plugin. This helper greps
 * the text/JSON for anything that looks like an approval link and a
 * companion request ID.
 */
export type ApprovalRef = {
  approvalUrl: string;
  requestId?: string;
  /** CREATE2-predicted Clanker token address (available before tx confirms). */
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
};

const URL_RE = /(https?:\/\/[^\s"'<>)]+)/g;
const REQUEST_ID_RE = /"?(?:request[_]?id|requestId|id)"?\s*[:=]\s*"([^"\s]+)"/i;

const APPROVAL_HOST_HINTS = [
  "account.base.org",
  "wallet.coinbase.com",
  "base.org/account",
  "approve",
  "/sign",
  "/confirm",
];

function isApprovalUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return APPROVAL_HOST_HINTS.some((h) => lower.includes(h));
}

export function extractApprovals(text: string): ApprovalRef[] {
  if (!text) return [];

  const out: ApprovalRef[] = [];
  const seenUrls = new Set<string>();
  const seenIds = new Set<string>();

  // 1) Try to parse JSON blocks first — gives us structured approvalUrl + requestId.
  for (const match of text.matchAll(/\{[\s\S]*?\}/g)) {
    try {
      const obj = JSON.parse(match[0]) as Record<string, unknown>;
      const url = pickString(obj, ["approvalUrl", "approval_url", "url", "link"]);
      const id = pickString(obj, [
        "requestId",
        "request_id",
        "id",
        "callId",
        "call_id",
      ]);
      if (url && isApprovalUrl(url)) {
        const normUrl = url.replace(/\\/g, "");
        const isDuplicate = seenUrls.has(normUrl) || (id && seenIds.has(id));
        if (!isDuplicate) {
          out.push({ approvalUrl: normUrl, requestId: id });
          seenUrls.add(normUrl);
          if (id) seenIds.add(id);
        }
      }
    } catch {
      /* not a JSON block — fine */
    }
  }

  // 2) Fallback regex sweep — picks up loose links in plain text.
  let m: RegExpExecArray | null;
  while ((m = URL_RE.exec(text)) !== null) {
    const url = m[1].replace(/[.,;!?]+$/, "");
    if (isApprovalUrl(url)) {
      const normUrl = url.replace(/\\/g, "");
      const idMatch = text.match(REQUEST_ID_RE);
      const id = idMatch?.[1];
      const isDuplicate = seenUrls.has(normUrl) || (id && seenIds.has(id));
      if (!isDuplicate) {
        out.push({
          approvalUrl: normUrl,
          requestId: id,
        });
        seenUrls.add(normUrl);
        if (id) seenIds.add(id);
      }
    }
  }

  return out;
}

/** Attach Clanker token metadata from prepare_clanker_token output to approvals. */
export function enrichApprovalsFromClankerOutput(
  output: string,
  approvals: ApprovalRef[]
): ApprovalRef[] {
  if (!approvals.length) return approvals;
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(output) as Record<string, unknown>;
  } catch {
    return approvals;
  }
  if (!parsed?.ok || parsed.protocol !== "clanker_v4") return approvals;

  const addr = pickString(parsed, [
    "predictedTokenAddress",
    "tokenAddress",
    "contractAddress",
  ]);

  const summary = parsed.summary as Record<string, unknown> | undefined;
  const name = typeof summary?.name === "string" ? summary.name : undefined;
  const symbol =
    typeof summary?.symbol === "string" ? summary.symbol : undefined;

  if (!addr && !name && !symbol) return approvals;

  return approvals.map((a) => ({
    ...a,
    tokenAddress: a.tokenAddress ?? addr,
    tokenName: a.tokenName ?? name,
    tokenSymbol: a.tokenSymbol ?? symbol,
  }));
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  // Recurse one level deep — Base MCP often nests under "result" or "data".
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = pickString(v as Record<string, unknown>, keys);
      if (inner) return inner;
    }
  }
  return undefined;
}
