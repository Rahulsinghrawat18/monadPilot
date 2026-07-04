"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  AlertCircle,
  Loader2,
  Wrench,
} from "lucide-react";
import type { ToolCall } from "@/store/chat";
import { cn } from "@/lib/utils/cn";

const TOOL_LABELS: Record<string, string> = {
  get_wallets: "Loading wallets",
  get_balance: "Checking balance",
  get_portfolio: "Loading portfolio",
  get_history: "Fetching history",
  get_transaction_history: "Fetching history",
  send: "Preparing send",
  swap: "Quoting swap",
  sign: "Signing message",
  send_calls: "Preparing transaction bundle",
  get_request_status: "Polling status",
};

export function ToolCallCard({ tool }: { tool: ToolCall }) {
  const [open, setOpen] = useState(false);
  const label = TOOL_LABELS[tool.name] ?? humanize(tool.name);

  const Icon =
    tool.status === "running"
      ? Loader2
      : tool.status === "error"
        ? AlertCircle
        : Check;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-2 rounded-xl border border-border bg-secondary/60 text-xs"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            tool.status === "running" && "animate-spin text-primary",
            tool.status === "done" && "text-emerald-400",
            tool.status === "error" && "text-destructive"
          )}
        />
        <span className="flex-1 truncate font-mono text-[12px] text-foreground/80">
          <span className="text-primary">{tool.server}</span>
          <span className="text-muted-foreground"> · </span>
          <span>{label}</span>
          {tool.status === "running" && (
            <span className="text-muted-foreground"> …</span>
          )}
        </span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border/60 px-3 py-2 space-y-2">
          {tool.arguments !== undefined && (
            <Block
              label="Arguments"
              value={prettyJson(tool.arguments)}
            />
          )}
          {tool.output && (
            <Block label="Result" value={truncate(tool.output, 1200)} />
          )}
          {tool.error && (
            <Block label="Error" value={tool.error} variant="error" />
          )}
        </div>
      )}
    </motion.div>
  );
}

function Block({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "default" | "error";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Wrench className="h-3 w-3" />
        {label}
      </div>
      <pre
        className={cn(
          "max-h-48 overflow-auto rounded-md bg-background/60 border border-border p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words",
          variant === "error" && "text-destructive"
        )}
      >
        {value}
      </pre>
    </div>
  );
}

function prettyJson(v: unknown) {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function humanize(name: string) {
  return name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}
