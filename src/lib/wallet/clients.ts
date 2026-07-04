import { createPublicClient, http, defineChain } from "viem";
import { mainnet } from "viem/chains";

export const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.monad.xyz"],
    },
    public: {
      http: ["https://rpc.monad.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "MonadVision",
      url: "https://monadvision.com",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
});

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://testnet-rpc.monad.xyz"],
    },
    public: {
      http: ["https://testnet-rpc.monad.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "MonadScan",
      url: "https://testnet.monadscan.com",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
});

const monadRpc =
  process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? "https://rpc.monad.xyz";
const monadTestnetRpc =
  process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const mainnetRpc =
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? "https://eth.llamarpc.com";

export const monadPublicClient = createPublicClient({
  chain: monad,
  transport: http(monadRpc, { batch: { batchSize: 100, wait: 16 } }),
});

export const monadTestnetPublicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(monadTestnetRpc),
});

/** Used purely for ENS reverse resolution. */
export const mainnetPublicClient = createPublicClient({
  chain: mainnet,
  transport: http(mainnetRpc),
});

export function getPublicClientForChainId(chainId: number) {
  if (chainId === monad.id) return monadPublicClient;
  if (chainId === monadTestnet.id) return monadTestnetPublicClient;
  if (chainId === mainnet.id) return mainnetPublicClient;
  // Fallback to monad for safety
  return monadPublicClient;
}
