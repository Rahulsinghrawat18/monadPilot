import { type Address, erc20Abi, formatUnits } from "viem";
import { monadPublicClient } from "./clients";
import { MONAD_TOKENS, TOKEN_LIST, type TokenInfo } from "@/lib/constants/tokens";

const ZERO = BigInt(0);

export type TokenBalance = {
  token: TokenInfo;
  raw: bigint;
  formatted: string;
  usd?: number;
  priceUsd?: number;
};

/**
 * Fetch a single token balance (native or ERC20) for `account`.
 */
export async function getTokenBalance(
  account: Address,
  token: TokenInfo
): Promise<TokenBalance> {
  if (token.isNative) {
    const raw = await monadPublicClient.getBalance({ address: account });
    return {
      token,
      raw,
      formatted: formatUnits(raw, token.decimals),
    };
  }
  const raw = (await monadPublicClient.readContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;
  return {
    token,
    raw,
    formatted: formatUnits(raw, token.decimals),
  };
}

/**
 * Multi-token balance fetch using a single multicall round-trip.
 * Returns balances for *all* registered tokens. Filtering / sorting is the
 * caller's responsibility.
 */
export async function getPortfolioBalances(
  account: Address,
  tokens: TokenInfo[] = TOKEN_LIST
): Promise<TokenBalance[]> {
  const erc20s = tokens.filter((t) => !t.isNative);
  const native = tokens.find((t) => t.isNative);

  const [erc20Results, nativeRaw] = await Promise.all([
    monadPublicClient.multicall({
      allowFailure: true,
      contracts: erc20s.map((t) => ({
        address: t.address,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [account] as const,
      })),
    }),
    native
      ? monadPublicClient.getBalance({ address: account })
      : Promise.resolve(ZERO),
  ]);

  const out: TokenBalance[] = [];

  if (native) {
    out.push({
      token: native,
      raw: nativeRaw,
      formatted: formatUnits(nativeRaw, native.decimals),
    });
  }

  erc20s.forEach((t, i) => {
    const res = erc20Results[i];
    const raw = res.status === "success" ? (res.result as bigint) : ZERO;
    out.push({
      token: t,
      raw,
      formatted: formatUnits(raw, t.decimals),
    });
  });

  return out;
}

/**
 * Convenience: parse a free-form symbol/address and return its balance.
 */
export async function getBalanceByQuery(
  account: Address,
  query: string
): Promise<TokenBalance> {
  const token =
    MONAD_TOKENS[query.toUpperCase()] ??
    TOKEN_LIST.find(
      (t) =>
        t.address.toLowerCase() === query.toLowerCase() ||
        t.symbol.toUpperCase() === query.toUpperCase()
    );
  if (!token) {
    throw new Error(`Unknown token: ${query}. Try one of: ${TOKEN_LIST.map((t) => t.symbol).join(", ")}.`);
  }
  return getTokenBalance(account, token);
}
