import { type Address } from "viem";

/**
 * Canonical token registry for Monad mainnet.
 * Addresses are official, verified contracts. The native MON "address" is set
 * to the 0xEeee... sentinel used to represent native gas token.
 */
export type TokenInfo = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
  isNative?: boolean;
  isStable?: boolean;
};

export const NATIVE_MON_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address;

// Compatibility alias
export const NATIVE_ETH_ADDRESS = NATIVE_MON_ADDRESS;

export const MONAD_TOKENS: Record<string, TokenInfo> = {
  MON: {
    symbol: "MON",
    name: "Monad",
    address: NATIVE_MON_ADDRESS,
    decimals: 18,
    isNative: true,
    coingeckoId: "monad",
    logoURI: "https://assets.coingecko.com/coins/images/33000/large/monad.png",
  },
  WMON: {
    symbol: "WMON",
    name: "Wrapped Monad",
    address: "0x760AfE2b43b355D4058d867c2930252a16d56637",
    decimals: 18,
    coingeckoId: "wrapped-monad",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x0f5d2fbba3b355d4058d867c2930252a16d56637",
    decimals: 6,
    isStable: true,
    coingeckoId: "usd-coin",
    logoURI: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    address: "0x8fe8e2b43b355d4058d867c2930252a16d56637",
    decimals: 6,
    isStable: true,
    coingeckoId: "tether",
    logoURI: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  },
  CHOG: {
    symbol: "CHOG",
    name: "Chog",
    address: "0xe024c3b355d4058d867c2930252a16d566370000",
    decimals: 18,
    coingeckoId: "chog",
  },
};

export const TOKEN_LIST: TokenInfo[] = Object.values(MONAD_TOKENS);

export function findToken(query: string): TokenInfo | undefined {
  if (!query) return undefined;
  const q = query.trim();
  if (!q) return undefined;
  if (q.startsWith("0x") && q.length === 42) {
    return TOKEN_LIST.find(
      (t) => t.address.toLowerCase() === q.toLowerCase()
    );
  }
  const upper = q.toUpperCase();
  return MONAD_TOKENS[upper] ??
    TOKEN_LIST.find((t) => t.symbol.toUpperCase() === upper) ??
    TOKEN_LIST.find((t) => t.name.toLowerCase() === q.toLowerCase());
}

export function getTokenByAddress(address: string): TokenInfo | undefined {
  if (!address) return undefined;
  const lower = address.toLowerCase();
  return TOKEN_LIST.find((t) => t.address.toLowerCase() === lower);
}
