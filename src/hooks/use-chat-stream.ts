"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useChat, type ApprovalRef, type ChatMessage } from "@/store/chat";

function newId(prefix = "m") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

/**
 * Parses an SSE byte stream off the /api/chat endpoint and dispatches
 * each event into the chat store.
 */
export function useChatStream() {
  const store = useChat();
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    store.setPending(false);
  }, [store]);

  const send = useCallback(
    async (text: string, opts: { viaVoice?: boolean } = {}) => {
      const trimmed = text.trim();
      if (!trimmed || store.pending) return;
      store.setLastInputViaVoice(Boolean(opts.viaVoice));

      const userMsg: ChatMessage = {
        id: newId("u"),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      const assistantMsg: ChatMessage = {
        id: newId("a"),
        role: "assistant",
        content: "",
        streaming: true,
        toolCalls: [],
        approvals: [],
        createdAt: Date.now(),
      };

      store.add(userMsg);
      store.add(assistantMsg);
      store.setInput("");
      store.setPending(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              ...useChat
                .getState()
                .messages.filter((m) => m.id !== assistantMsg.id)
                .map((m) => ({ role: m.role, content: m.content })),
            ],
            previousResponseId: store.previousResponseId,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const body = await res.text().catch(() => "");
          throw new Error(`Chat failed (${res.status}) ${body}`);
        }

        await parseSSE(res.body, (event, data) =>
          handleEvent(assistantMsg.id, event, data, store)
        );

        store.patch(assistantMsg.id, { streaming: false });
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") {
          store.patch(assistantMsg.id, {
            streaming: false,
            content:
              useChat.getState().messages.find((m) => m.id === assistantMsg.id)
                ?.content ?? "" + "\n_Cancelled._",
          });
        } else {
          const message = err instanceof Error ? err.message : "Chat failed";
          store.patch(assistantMsg.id, {
            streaming: false,
            content: `_${message}_`,
          });
          toast.error(message);
        }
      } finally {
        store.setPending(false);
        abortRef.current = null;
      }
    },
    [store]
  );

  const pollApproval = useCallback(
    async (msgId: string, approval: ApprovalRef) => {
      if (!approval.requestId) return;
      try {
        const res = await fetch(
          `/api/mcp/status?requestId=${encodeURIComponent(approval.requestId)}`
        );
        if (!res.ok) throw new Error(`Status poll failed (${res.status})`);
        const json = (await res.json()) as {
          status?: unknown;
          text?: string;
        };
        const rawText = JSON.stringify(json).toLowerCase();
        const confirmed = /confirmed|success|completed|executed|broadcast/.test(
          rawText
        );
        const failed = /failed|rejected|cancell?ed|error/.test(rawText);
        const txMatch = JSON.stringify(json).match(/0x[a-fA-F0-9]{64}/);
        store.updateApproval(msgId, approval.requestId, {
          status: confirmed ? "confirmed" : failed ? "failed" : "pending",
          txHash: txMatch?.[0],
        });
        return { confirmed, failed };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Poll failed";
        toast.error(message);
      }
    },
    [store]
  );

  return { send, cancel, pollApproval };
}

/* --------------------------------------------------------------------- */

async function parseSSE(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: unknown) => void
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = chunk.split("\n");
      let event = "message";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) data += line.slice(6);
      }
      if (!data) continue;
      try {
        onEvent(event, JSON.parse(data));
      } catch {
        onEvent(event, data);
      }
    }
  }
}

type ChatStore = ReturnType<typeof useChat.getState>;

function handleEvent(
  msgId: string,
  event: string,
  data: unknown,
  store: ChatStore
) {
  const payload = data as Record<string, unknown>;
  switch (event) {
    case "delta": {
      const text = payload.text as string | undefined;
      if (text) store.appendText(msgId, text);
      return;
    }
    case "response": {
      const id = payload.id as string | undefined;
      if (id) store.setResponseId(id);
      return;
    }
    case "tool_start": {
      store.startToolCall(msgId, {
        id: (payload.id as string) ?? newId("t"),
        name: (payload.name as string) ?? "tool",
        server: (payload.server as string) ?? "base-mcp",
        status: "running",
        arguments: payload.args ?? payload.arguments,
        approvals: [],
      });
      return;
    }
    case "tool_end": {
      const approvals = (payload.approvals as ApprovalRef[]) ?? [];
      store.finishToolCall(msgId, payload.id as string, {
        status: payload.error ? "error" : "done",
        arguments: payload.arguments,
        output: payload.output as string,
        error: payload.error as string,
        approvals,
      });
      return;
    }
    case "approval": {
      store.addApprovalToMessage(msgId, payload as unknown as ApprovalRef);
      return;
    }
    case "tools_list": {
      // Could surface MCP tool catalog in a debug panel — quiet for now.
      return;
    }
    case "error": {
      toast.error((payload.message as string) ?? "Chat error");
      store.patch(msgId, { streaming: false });
      return;
    }
    case "done":
      store.patch(msgId, { streaming: false });
      return;
  }
}
