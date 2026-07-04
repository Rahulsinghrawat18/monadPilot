import { formatUnits } from "viem";

/**
 * Format a token balance from its raw bigint representation into a
 * user-friendly string with adaptive precision.
 */
export function formatTokenAmount(
  raw: bigint | string | number,
  decimals: number,
  options: { maxFractionDigits?: number; compact?: boolean } = {}
): string {
  const { maxFractionDigits, compact } = options;
  const value = typeof raw === "bigint" ? raw : BigInt(raw);
  const asFloat = Number(formatUnits(value, decimals));
  if (!Number.isFinite(asFloat)) return "0";

  if (compact && asFloat >= 1_000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(asFloat);
  }

  let digits = maxFractionDigits;
  if (digits === undefined) {
    if (asFloat === 0) digits = 0;
    else if (asFloat >= 1_000) digits = 2;
    else if (asFloat >= 1) digits = 4;
    else if (asFloat >= 0.0001) digits = 6;
    else digits = 8;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(asFloat);
}

export function formatUsd(value: number | undefined | null, opts: { compact?: boolean } = {}) {
  if (value === undefined || value === null || !Number.isFinite(value)) return "$0.00";
  if (opts.compact && Math.abs(value) >= 1_000) {
    return (
      "$" +
      new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(value)
    );
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number | undefined | null, fractionDigits = 2) {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

export function shortAddress(address?: string | null, chars = 4) {
  if (!address) return "";
  if (address.length < 2 * chars + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function timeAgo(ts: number | Date): string {
  const date = ts instanceof Date ? ts : new Date(ts);
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
