import { type Address } from "viem";

export type ActivityItem = {
  hash: string;
  from: Address;
  to: Address | null;
  value: string;
  blockNumber: number;
  timeStamp: number;
  isError: boolean;
  methodId?: string;
  functionName?: string;
};

/**
 * Recent activity is fetched from BaseScan's public API. Without an API key
 * BaseScan applies a strict rate limit, which is fine for a chat-driven UX
 * since these calls are infrequent and on demand.
 */
const BASESCAN_API = "https://api.basescan.org/api";

export async function getRecentActivity(
  account: Address,
  limit = 10
): Promise<ActivityItem[]> {
  const apiKey = process.env.BASESCAN_API_KEY ?? "";
  const params = new URLSearchParams({
    module: "account",
    action: "txlist",
    address: account,
    startblock: "0",
    endblock: "99999999",
    page: "1",
    offset: String(limit),
    sort: "desc",
    ...(apiKey ? { apikey: apiKey } : {}),
  });

  const res = await fetch(`${BASESCAN_API}?${params.toString()}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`BaseScan responded ${res.status}`);

  const json = (await res.json()) as {
    status: string;
    message: string;
    result: Array<{
      hash: string;
      from: string;
      to: string;
      value: string;
      blockNumber: string;
      timeStamp: string;
      isError: string;
      methodId: string;
      functionName: string;
    }>;
  };

  if (json.status !== "1" || !Array.isArray(json.result)) {
    return [];
  }

  return json.result.map((tx) => ({
    hash: tx.hash,
    from: tx.from as Address,
    to: tx.to ? (tx.to as Address) : null,
    value: tx.value,
    blockNumber: Number(tx.blockNumber),
    timeStamp: Number(tx.timeStamp),
    isError: tx.isError === "1",
    methodId: tx.methodId,
    functionName: tx.functionName,
  }));
}
