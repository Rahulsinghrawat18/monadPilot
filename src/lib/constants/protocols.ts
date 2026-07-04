import { type Address } from "viem";

/**
 * Verified protocol contracts on Base mainnet.
 */

export const MORPHO = {
  /** Morpho Blue singleton on Base */
  blue: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address,
  /** General Adapter for bundler v3 (multicall approve+supply) */
  generalAdapter: "0xb98c948CFA24072e58935BC004a8A7b376AE746A" as Address,
  /** Default MetaMorpho vaults (curated). */
  vaults: {
    /** Steakhouse USDC (high-yield, blue-chip risk) */
    steakhouseUSDC:
      "0xBEEFff209270748ddd194831b3fa287a5386f5bC" as Address,
    /** Moonwell Flagship USDC */
    moonwellUSDC:
      "0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca" as Address,
    /** Re7 Universal USDC */
    re7USDC: "0x12AFDeFb2237a5963e7BAb3e2D46ad0eee70406e" as Address,
    /** Moonwell Frontier ETH (cbETH/WETH collateral) */
    moonwellWETH:
      "0xa0E430870c4604CcfC7B38Ca7845B1FF653D0ff1" as Address,
  },
} as const;

export const AERODROME = {
  /** Aerodrome Universal Router */
  router: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43" as Address,
  /** Aerodrome Pool Factory (v2 style) */
  poolFactory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da" as Address,
  /** Voter contract (gauges / bribes) */
  voter: "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5" as Address,
  /** Slipstream NonfungiblePositionManager (concentrated liquidity) */
  positionManager: "0x827922686190790b37229fd06084350E74485b72" as Address,
} as const;

export const MOONWELL = {
  comptroller: "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C" as Address,
  /** Markets (mTokens) — Compound-fork lending pools */
  markets: {
    USDC: "0xEdc817A28E8B93B03976FBd4a3dDBc9f7D176c22" as Address,
    WETH: "0x628ff693426583D9a7FB391E54366292F509D457" as Address,
    DAI: "0x73b06D8d18De422E269645eaCe15400DE7462417" as Address,
    cbETH: "0x3bf93770f2d4a794c3d9EBEfBAeBAE2a8f09A5E5" as Address,
    USDbC: "0x703843C3379b52F9FF486c9f5892218d2a065cC8" as Address,
  },
} as const;

export const TOKENS = {
  /** Multicall3 (deployed at the same address on every EVM chain). */
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11" as Address,
} as const;

/** Permit2 — universal token approval contract used by 0x, Uniswap, etc. */
export const PERMIT2_ADDRESS =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;
