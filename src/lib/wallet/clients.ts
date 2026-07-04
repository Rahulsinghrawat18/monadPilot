import { createPublicClient, http } from "viem";
import { base, baseSepolia, mainnet } from "viem/chains";

/**
 * Read-only Viem public clients used by APY discovery + the portfolio
 * endpoint. These never hold keys — every write goes through Base MCP.
 */
const baseRpc =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";
const baseSepoliaRpc =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
const mainnetRpc =
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? "https://eth.llamarpc.com";

export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(baseRpc, { batch: { batchSize: 100, wait: 16 } }),
});

export const baseSepoliaPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(baseSepoliaRpc),
});

/** Used purely for ENS reverse resolution. */
export const mainnetPublicClient = createPublicClient({
  chain: mainnet,
  transport: http(mainnetRpc),
});

export function getPublicClientForChainId(chainId: number) {
  if (chainId === base.id) return basePublicClient;
  if (chainId === baseSepolia.id) return baseSepoliaPublicClient;
  if (chainId === mainnet.id) return mainnetPublicClient;
  throw new Error(`Unsupported chainId: ${chainId}`);
}
