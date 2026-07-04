import { type Address } from "viem";

/**
 * Canonical token registry for Base mainnet.
 * Addresses are official, verified contracts. The native ETH "address" is set
 * to the 0xEeee... sentinel used by 0x / Aerodrome to represent native ETH.
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

export const NATIVE_ETH_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address;

export const BASE_TOKENS: Record<string, TokenInfo> = {
  ETH: {
    symbol: "ETH",
    name: "Ether",
    address: NATIVE_ETH_ADDRESS,
    decimals: 18,
    isNative: true,
    coingeckoId: "ethereum",
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  },
  WETH: {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    coingeckoId: "weth",
    logoURI: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    isStable: true,
    coingeckoId: "usd-coin",
    logoURI:
      "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  },
  USDbC: {
    symbol: "USDbC",
    name: "USD Base Coin (bridged)",
    address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    decimals: 6,
    isStable: true,
    coingeckoId: "bridged-usd-coin-base",
  },
  DAI: {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    decimals: 18,
    isStable: true,
    coingeckoId: "dai",
    logoURI: "https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png",
  },
  cbETH: {
    symbol: "cbETH",
    name: "Coinbase Wrapped Staked ETH",
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    decimals: 18,
    coingeckoId: "coinbase-wrapped-staked-eth",
  },
  cbBTC: {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    decimals: 8,
    coingeckoId: "coinbase-wrapped-btc",
  },
  AERO: {
    symbol: "AERO",
    name: "Aerodrome",
    address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    decimals: 18,
    coingeckoId: "aerodrome-finance",
  },
  DEGEN: {
    symbol: "DEGEN",
    name: "Degen",
    address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    decimals: 18,
    coingeckoId: "degen-base",
  },
  WELL: {
    symbol: "WELL",
    name: "Moonwell",
    address: "0xA88594D404727625A9437C3f886C7643872296AE",
    decimals: 18,
    coingeckoId: "moonwell-artemis",
  },
};

export const TOKEN_LIST: TokenInfo[] = Object.values(BASE_TOKENS);

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
  return BASE_TOKENS[upper] ??
    TOKEN_LIST.find((t) => t.symbol.toUpperCase() === upper) ??
    TOKEN_LIST.find((t) => t.name.toLowerCase() === q.toLowerCase());
}

export function getTokenByAddress(address: string): TokenInfo | undefined {
  if (!address) return undefined;
  const lower = address.toLowerCase();
  return TOKEN_LIST.find((t) => t.address.toLowerCase() === lower);
}
