import "server-only";
import {
  encodeFunctionData,
  isAddress,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";

/**
 * Build a Clanker v4 token-deployment transaction *without ever holding a
 * private key*. We call the SDK's `getDeployTransaction` (which is pure —
 * it doesn't hit the chain, it just runs the Zod schema + CREATE2 salt
 * resolution) to obtain the abi-typed call config, then encode it into
 * raw calldata so the user can approve the deploy through Base MCP
 * `send_calls`.
 *
 * basePilot never signs or broadcasts — the user is always the signer.
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
  /** When true, grind a salt so the deploy lands on a `0xb07`-suffix address. */
  vanity?: boolean | null;
  /** Buy ETH worth of the new token in the same tx. */
  devBuyEth?: number | null;
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
  /** Base MCP chain name for `send_calls`. */
  chain: "base";
  /** CREATE2-predicted token contract address (known before approval). */
  predictedTokenAddress: Address;
  /** Factory contract that handles `deployToken`. */
  to: Address;
  /** Encoded calldata for the factory call. */
  data: Hex;
  /** ETH attached to the call (devBuy etc.) — hex-encoded wei, e.g. `0x0`. */
  value: Hex;
  /** Human-readable description for the AI to summarize back to the user. */
  summary: {
    name: string;
    symbol: string;
    tokenAdmin: Address;
    image: string | null;
    description: string | null;
    vanity: boolean;
    devBuyEth: number;
    vault: {
      percent: number;
      lockupDays: number;
      vestingDays: number;
    } | null;
  };
};

export type ClankerDeployError = { ok: false; error: string };

const ONE_DAY = 86_400;
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
  // basePilot is Base-mainnet only.
  const chainId = base.id;

  // Lazy-load the SDK so its multi-MB ABI bundle stays out of the cold
  // path for users who never deploy a token.
  const { Clanker } = await import("clanker-sdk/v4");

  const vault = input.vault
    ? {
        percentage: input.vault.percent,
        lockupDuration: input.vault.lockupDays * ONE_DAY,
        vestingDuration:
          (input.vault.vestingDays ?? input.vault.lockupDays) * ONE_DAY,
        recipient: input.tokenAdmin,
      }
    : undefined;

  const devBuyEth =
    input.devBuyEth && input.devBuyEth > 0 ? input.devBuyEth : 0;
  const devBuy =
    devBuyEth > 0
      ? { ethAmount: devBuyEth, recipient: input.tokenAdmin }
      : undefined;

  const tokenConfig = {
    chainId,
    name: input.name.trim(),
    symbol: input.symbol.trim(),
    tokenAdmin: input.tokenAdmin,
    image: (input.image ?? "").trim(),
    metadata: input.description?.trim()
      ? { description: input.description.trim() }
      : undefined,
    vanity: Boolean(input.vanity),
    context: {
      interface: input.interfaceTag?.trim() || "basePilot",
      platform: "basepilot",
    },
    vault,
    devBuy,
  };

  try {
    const clanker = new Clanker({});
    // SDK's input shape is a Zod schema that we partially satisfy; the
    // converter applies defaults at runtime. A targeted cast lets us
    // share one type definition between the tool and the SDK.
    const tx = await clanker.getDeployTransaction(
      tokenConfig as Parameters<typeof clanker.getDeployTransaction>[0]
    );

    const data = encodeFunctionData({
      abi: tx.abi,
      functionName: tx.functionName,
      args: tx.args,
    });

    const predictedTokenAddress = await resolvePredictedTokenAddress(
      tx.args,
      chainId,
      input.tokenAdmin
    );

    return {
      ok: true,
      chain: "base",
      predictedTokenAddress,
      to: tx.address as Address,
      data,
      value: toHex(tx.value ?? 0n),
      summary: {
        name: tokenConfig.name,
        symbol: tokenConfig.symbol,
        tokenAdmin: input.tokenAdmin,
        image: tokenConfig.image || null,
        description: input.description?.trim() || null,
        vanity: tokenConfig.vanity,
        devBuyEth,
        vault: input.vault
          ? {
              percent: input.vault.percent,
              lockupDays: input.vault.lockupDays,
              vestingDays: input.vault.vestingDays ?? input.vault.lockupDays,
            }
          : null,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to build deploy";
    return { ok: false, error: message };
  }
}

type DeployTokenArgs = {
  tokenConfig: {
    name: string;
    symbol: string;
    salt: Hex;
    tokenAdmin: Address;
    image?: string;
    metadata?: string;
    context?: string;
    originatingChainId?: bigint;
  };
};

/**
 * Clanker v4 deploys via CREATE2 — the token address is deterministic from
 * the salt + factory. Recover it from the abi-typed deploy args so we can
 * show the CA to the user before they even approve.
 */
async function resolvePredictedTokenAddress(
  args: readonly unknown[],
  chainId: number,
  tokenAdmin: Address
): Promise<Address> {
  const deployArgs = args[0] as DeployTokenArgs | undefined;
  const tc = deployArgs?.tokenConfig;
  if (!tc?.salt || !tc.name || !tc.symbol) {
    throw new Error("Could not read tokenConfig from Clanker deploy args");
  }

  const { predictTokenAddressV4, clankerConfigFor, DEFAULT_SUPPLY } =
    await import("clanker-sdk");

  const clankerConfig = clankerConfigFor(base.id, "clanker_v4");
  if (!clankerConfig) {
    throw new Error(`No Clanker v4 config for chain ${chainId}`);
  }

  const tokenArgs = [
    tc.name,
    tc.symbol,
    DEFAULT_SUPPLY,
    tokenAdmin,
    tc.image ?? "",
    tc.metadata ?? "",
    tc.context ?? "",
    BigInt(chainId),
  ] as const;

  return predictTokenAddressV4(
    tokenArgs,
    clankerConfig,
    tc.salt,
    tokenAdmin
  ) as Address;
}
