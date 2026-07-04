export type YieldOpportunity = {
  protocol: "ambient" | "kuru" | "morpho" | "moonwell" | "aerodrome" | "compound" | "aave" | "other";
  pool: string;
  asset: string;
  /** APY in percent (e.g. 7.42 means 7.42%). */
  apy: number;
  /** Base APY excluding rewards (when available). */
  apyBase?: number;
  apyReward?: number;
  /** TVL in USD. */
  tvlUsd: number;
  rewardTokens?: string[];
  /** Project-specific identifier (vault address, market address, etc.). */
  poolId?: string;
  url?: string;
  /** Risk hints (lower = safer). */
  ilRisk?: "no" | "yes";
  exposure?: "single" | "multi";
  /** Lock-up notes if any. */
  lockup?: string;
};
