"use client";

import { create } from "zustand";

export type ToolCall = {
  id: string;
  name: string;
  server: string;
  status: "running" | "done" | "error";
  arguments?: unknown;
  output?: string;
  error?: string;
  approvals: ApprovalRef[];
};

export type ApprovalRef = {
  approvalUrl: string;
  requestId?: string;
  /** Set once the user has clicked "Approve Transaction". */
  acknowledged?: boolean;
  /** Cached status from /api/mcp/status polling. */
  status?: "pending" | "confirmed" | "failed";
  /** Onchain tx hash (when available). */
  txHash?: string;
  /** CREATE2-predicted Clanker token contract address. */
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  toolCalls?: ToolCall[];
  approvals?: ApprovalRef[];
  /** When true, the assistant is still streaming this message. */
  streaming?: boolean;
};

type ChatState = {
  messages: ChatMessage[];
  pending: boolean;
  previousResponseId: string | null;
  inputDraft: string;
  voiceState: "idle" | "recording" | "transcribing";
  /** True when the latest user turn was spoken (not typed). Used to
   * decide whether to auto-play the assistant's reply through TTS. */
  lastInputViaVoice: boolean;
  /** Whether TTS auto-play is enabled at all (user-toggleable). */
  speechEnabled: boolean;
  add: (m: ChatMessage) => void;
  patch: (id: string, p: Partial<ChatMessage>) => void;
  appendText: (id: string, delta: string) => void;
  startToolCall: (msgId: string, tc: ToolCall) => void;
  finishToolCall: (
    msgId: string,
    toolId: string,
    update: Partial<ToolCall>
  ) => void;
  addApprovalToMessage: (msgId: string, approval: ApprovalRef) => void;
  updateApproval: (msgId: string, requestId: string, patch: Partial<ApprovalRef>) => void;
  setInput: (s: string) => void;
  setPending: (b: boolean) => void;
  setResponseId: (id: string | null) => void;
  setVoiceState: (s: ChatState["voiceState"]) => void;
  setLastInputViaVoice: (b: boolean) => void;
  setSpeechEnabled: (b: boolean) => void;
  reset: () => void;
};

export const useChat = create<ChatState>((set) => ({
  messages: [],
  pending: false,
  previousResponseId: null,
  inputDraft: "",
  voiceState: "idle",
  lastInputViaVoice: false,
  speechEnabled: true,
  add: (m) => set((s) => ({ messages: [...s.messages, m] })),
  patch: (id, p) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...p } : m)),
    })),
  appendText: (id, delta) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + delta } : m
      ),
    })),
  startToolCall: (msgId, tc) =>
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== msgId) return m;
        const existing = m.toolCalls ?? [];
        // Idempotent: if the same tool id already exists, keep it (the
        // upstream stream sometimes re-announces tool calls and we don't
        // want React key collisions).
        if (existing.some((t) => t.id === tc.id)) return m;
        return { ...m, toolCalls: [...existing, tc] };
      }),
    })),
  finishToolCall: (msgId, toolId, update) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === msgId
          ? {
              ...m,
              toolCalls: (m.toolCalls ?? []).map((t) =>
                t.id === toolId ? { ...t, ...update } : t
              ),
            }
          : m
      ),
    })),
  addApprovalToMessage: (msgId, approval) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === msgId
          ? {
              ...m,
              approvals: dedupe([...(m.approvals ?? []), approval]),
            }
          : m
      ),
    })),
  updateApproval: (msgId, requestId, patch) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === msgId
          ? {
              ...m,
              approvals: (m.approvals ?? []).map((a) =>
                a.requestId === requestId ? { ...a, ...patch } : a
              ),
            }
          : m
      ),
    })),
  setInput: (inputDraft) => set({ inputDraft }),
  setPending: (pending) => set({ pending }),
  setResponseId: (previousResponseId) => set({ previousResponseId }),
  setVoiceState: (voiceState) => set({ voiceState }),
  setLastInputViaVoice: (lastInputViaVoice) => set({ lastInputViaVoice }),
  setSpeechEnabled: (speechEnabled) => set({ speechEnabled }),
  reset: () =>
    set({
      messages: [],
      pending: false,
      previousResponseId: null,
      inputDraft: "",
      voiceState: "idle",
      lastInputViaVoice: false,
    }),
}));

function dedupe(list: ApprovalRef[]): ApprovalRef[] {
  const seen = new Set<string>();
  const out: ApprovalRef[] = [];
  for (const a of list) {
    if (seen.has(a.approvalUrl)) continue;
    seen.add(a.approvalUrl);
    out.push(a);
  }
  return out;
}
