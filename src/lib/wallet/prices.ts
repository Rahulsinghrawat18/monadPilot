import { type Address } from "viem";
import { NATIVE_ETH_ADDRESS, TOKEN_LIST } from "@/lib/constants/tokens";

/**
 * DefiLlama spot pricing — free, keyless, and accurate enough for portfolio
 * displays. Prices are cached in-memory for 60s to keep page loads snappy.
 */
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { price: number; ts: number }>();

const LLAMA_BASE = "https://coins.llama.fi/prices/current";

type LlamaResponse = {
  coins: Record<string, { decimals: number; price: number; symbol: string; timestamp: number }>;
};

function key(address: Address) {
  return `base:${address.toLowerCase()}`;
}

export async function getTokenPriceUsd(
  address: Address
): Promise<number | undefined> {
  const k = key(address);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.price;

  const llamaKey =
    address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()
      ? "coingecko:ethereum"
      : `base:${address.toLowerCase()}`;

  try {
    const res = await fetch(`${LLAMA_BASE}/${llamaKey}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as LlamaResponse;
    const price = json.coins?.[llamaKey]?.price;
    if (typeof price === "number") {
      cache.set(k, { price, ts: Date.now() });
      return price;
    }
  } catch {
    /* ignore — price feeds are best-effort */
  }
  return undefined;
}

export async function getTokenPricesUsd(
  addresses: Address[]
): Promise<Record<string, number | undefined>> {
  if (addresses.length === 0) return {};

  const now = Date.now();
  const needFetch: Address[] = [];
  const out: Record<string, number | undefined> = {};

  for (const addr of addresses) {
    const hit = cache.get(key(addr));
    if (hit && now - hit.ts < CACHE_TTL_MS) {
      out[addr.toLowerCase()] = hit.price;
    } else {
      needFetch.push(addr);
    }
  }

  if (needFetch.length === 0) return out;

  const ids = needFetch
    .map((addr) =>
      addr.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()
        ? "coingecko:ethereum"
        : `base:${addr.toLowerCase()}`
    )
    .join(",");

  try {
    const res = await fetch(`${LLAMA_BASE}/${ids}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      for (const addr of needFetch) out[addr.toLowerCase()] = undefined;
      return out;
    }
    const json = (await res.json()) as LlamaResponse;
    for (const addr of needFetch) {
      const id =
        addr.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()
          ? "coingecko:ethereum"
          : `base:${addr.toLowerCase()}`;
      const price = json.coins?.[id]?.price;
      out[addr.toLowerCase()] = price;
      if (typeof price === "number") {
        cache.set(key(addr), { price, ts: now });
      }
    }
  } catch {
    for (const addr of needFetch) out[addr.toLowerCase()] = undefined;
  }

  return out;
}

export async function getAllRegisteredPricesUsd(): Promise<
  Record<string, number | undefined>
> {
  return getTokenPricesUsd(TOKEN_LIST.map((t) => t.address));
}
