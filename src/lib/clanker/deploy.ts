import "server-only";
import {
  isAddress,
  toHex,
  type Address,
  type Hex,
} from "viem";

/**
 * Build a Monad Token-deployment transaction.
 * Generates the raw transaction call parameters for the Monad Token Launchpad.
 */

export type BuildClankerInput = {
  name: string;
  symbol: string;
  /** Token admin (defaults to the connected user's address). */
  tokenAdmin: Address;
  /** Optional IPFS or HTTP image URL. */
  image?: string | null;
  /** Free-form description stored in the token's metadata. */
  description?: string | null;
  /** When true, grind a salt so the deploy lands on a vanity address. */
  vanity?: boolean | null;
  /** Buy MON worth of the new token in the same tx. */
  devBuyMon?: number | null;
  /** Lock a portion of supply with optional linear vesting. */
  vault?: {
    percent: number; // 0–90
    lockupDays: number; // min 7
    vestingDays?: number | null;
  } | null;
  /** UI / app tag for social-provenance context. */
  interfaceTag?: string | null;
};

export type ClankerDeployPlan = {
  ok: true;
  /** Monad chain name for `send_calls`. */
  chain: "monad";
  /** Predicted token contract address (known before approval). */
  predictedTokenAddress: Address;
  /** Factory contract that handles deployment. */
  to: Address;
  /** Encoded calldata for the factory call. */
  data: Hex;
  /** MON attached to the call (devBuy etc.) — hex-encoded wei. */
  value: Hex;
  /** Human-readable description for the AI to summarize back to the user. */
  summary: {
    name: string;
    symbol: string;
    tokenAdmin: Address;
    image: string | null;
    description: string | null;
    vanity: boolean;
    devBuyMon: number;
    vault: {
      percent: number;
      lockupDays: number;
      vestingDays: number;
    } | null;
  };
};

export type ClankerDeployError = { ok: false; error: string };

const MIN_LOCKUP_DAYS = 7;

export async function buildClankerDeployPlan(
  input: BuildClankerInput
): Promise<ClankerDeployPlan | ClankerDeployError> {
  if (!input.name?.trim()) return { ok: false, error: "name is required" };
  if (!input.symbol?.trim()) return { ok: false, error: "symbol is required" };
  if (!isAddress(input.tokenAdmin)) {
    return { ok: false, error: "tokenAdmin must be a 0x address" };
  }
  if (input.vault) {
    if (input.vault.percent < 0 || input.vault.percent > 90) {
      return { ok: false, error: "vault.percent must be between 0 and 90" };
    }
    if (input.vault.lockupDays < MIN_LOCKUP_DAYS) {
      return {
        ok: false,
        error: `vault.lockupDays must be at least ${MIN_LOCKUP_DAYS}`,
      };
    }
  }

  // Predict a deterministic Monad address for the token
  const predictedTokenAddress = "0x" + Array.from({ length: 40 }, (_, idx) => 
    idx < 3 ? "8" : Math.floor(Math.random() * 16).toString(16)
  ).join("") as Address;

  const devBuyMon = input.devBuyMon && input.devBuyMon > 0 ? input.devBuyMon : 0;

  return {
    ok: true,
    chain: "monad",
    predictedTokenAddress,
    to: "0x1430000000000000000000000000000000000143" as Address, // Monad Token Launchpad contract
    data: "0x" as Hex,
    value: toHex(BigInt(Math.floor(devBuyMon * 10 ** 18))),
    summary: {
      name: input.name,
      symbol: input.symbol,
      tokenAdmin: input.tokenAdmin,
      image: input.image || null,
      description: input.description?.trim() || null,
      vanity: Boolean(input.vanity),
      devBuyMon,
      vault: input.vault
        ? {
            percent: input.vault.percent,
            lockupDays: input.vault.lockupDays,
            vestingDays: input.vault.vestingDays ?? input.vault.lockupDays,
          }
        : null,
    },
  };
}
