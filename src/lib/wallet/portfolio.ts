import { type Address } from "viem";
import { getPortfolioBalances, type TokenBalance } from "./balance";
import { getTokenPricesUsd } from "./prices";
import { TOKEN_LIST } from "@/lib/constants/tokens";

export type Portfolio = {
  account: Address;
  totalUsd: number;
  balances: TokenBalance[];
};

export async function getPortfolio(account: Address): Promise<Portfolio> {
  const [balances, prices] = await Promise.all([
    getPortfolioBalances(account, TOKEN_LIST),
    getTokenPricesUsd(TOKEN_LIST.map((t) => t.address)),
  ]);

  let totalUsd = 0;
  for (const b of balances) {
    const price = prices[b.token.address.toLowerCase()];
    b.priceUsd = price;
    if (typeof price === "number") {
      const amount = Number(b.formatted);
      b.usd = amount * price;
      if (Number.isFinite(b.usd)) totalUsd += b.usd;
    }
  }

  balances.sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0));
  return { account, totalUsd, balances };
}
