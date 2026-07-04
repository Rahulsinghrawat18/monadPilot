import { NextRequest } from "next/server";
import type {
  ResponseCreateParamsStreaming,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseStreamEvent,
  Tool,
} from "openai/resources/responses/responses";
import { getSession, getValidAccessToken } from "@/lib/session";
import { getOpenAI, CHAT_MODEL } from "@/lib/ai/openai";
import { SYSTEM_PROMPT } from "@/prompts/system";
import { BASE_MCP_URL } from "@/lib/mcp/discovery";
import {
  enrichApprovalsFromClankerOutput,
  extractApprovals,
} from "@/lib/ai/extract";
import { LOCAL_TOOLS, runLocalTool, buildFunctionCallOutput } from "@/lib/ai/local-tools";
import { callTool, parseToolResult } from "@/lib/mcp/client";
import type { Address } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ClientMessage = { role: "user" | "assistant"; content: string };
type ChatBody = {
  messages: ClientMessage[];
  previousResponseId?: string | null;
};

const MAX_TOOL_LOOPS = 6;

/**
 * POST /api/chat — streams a single conversational turn.
 *
 * Wire-format: SSE. See `useChatStream` on the client for the consumer.
 *
 * The route runs a server-side agent loop: when the model emits a local
 * function-tool call (e.g. find_base_yield), we execute it, append a
 * function_call_output to the next request, and resume streaming. Base
 * MCP tools are handled inline by OpenAI's MCP integration.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.mcp) {
    return new Response(
      JSON.stringify({ error: "Not connected to Base MCP. Please sign in." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = (await req.json()) as ChatBody;
  if (!body.messages?.length) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const accessToken = await getValidAccessToken();
  const openai = getOpenAI();

  // Eagerly resolve the user's primary EVM address. Local tools like
  // prepare_clanker_token need it as a default and we don't want the
  // model to have to round-trip through `get_wallets` just to fill in
  // `tokenAdmin`. We cache it on the session so subsequent turns are
  // free.
  let userAddress: Address | null = session.account?.address ?? null;
  if (!userAddress) {
    try {
      const result = await callTool(accessToken, "get_wallets", {});
      const parsed = parseToolResult(result);
      const stringified = JSON.stringify(parsed.data ?? parsed.text);
      const match = stringified.match(/0x[a-fA-F0-9]{40}/);
      if (match) {
        userAddress = match[0] as Address;
        session.account = { address: userAddress };
        await session.save();
      }
    } catch {
      // Non-fatal — the local tool will surface a clear error if the
      // address is genuinely unavailable.
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const tools: Tool[] = [
        {
          type: "mcp",
          server_label: "base-mcp",
          server_description:
            "Base Account: wallets, sends, swaps, sign, x402 payments, batched contract calls, tx history. Plus partner plugins (Morpho, Moonwell, Uniswap, Aerodrome).",
          server_url: BASE_MCP_URL,
          authorization: accessToken,
          require_approval: "never",
        },
        ...LOCAL_TOOLS,
      ];

      try {
        let nextInput: ResponseCreateParamsStreaming["input"] | undefined =
          body.previousResponseId
            ? [toResponsesInput(body.messages[body.messages.length - 1])]
            : body.messages.map(toResponsesInput);
        let prevResponseId: string | null = body.previousResponseId ?? null;
        let iteration = 0;

        while (iteration < MAX_TOOL_LOOPS) {
          iteration += 1;
          const pendingCalls: ResponseFunctionToolCall[] = [];

          const events = await openai.responses.create({
            model: CHAT_MODEL,
            stream: true,
            instructions: SYSTEM_PROMPT,
            previous_response_id: prevResponseId ?? undefined,
            input: nextInput!,
            tools,
          });

          for await (const event of events) {
            handleEvent(event as ResponseStreamEvent, send, pendingCalls);
            const id = pickResponseId(event as ResponseStreamEvent);
            if (id) prevResponseId = id;
          }

          if (pendingCalls.length === 0) break;

          // Execute the pending local function calls in parallel. The
          // tool cards already exist in the UI (we sent tool_start when
          // the model emitted the function_call item), so here we only
          // need to send the final tool_end with the resolved output.
          const outputs = await Promise.all(
            pendingCalls.map(async (call) => {
              try {
                const output = await runLocalTool(
                  call.name,
                  safeJson(call.arguments),
                  { userAddress, accessToken }
                );
                // Local tools that proxy through Base MCP (e.g.
                // prepare_clanker_token relaying send_calls) embed an MCP
                // response containing an approval URL. Pull it out so the
                // UI surfaces an "Approve Transaction" card just like a
                // direct MCP write would.
                let approvals = extractApprovals(output);
                if (call.name === "prepare_clanker_token") {
                  approvals = enrichApprovalsFromClankerOutput(output, approvals);
                }
                send("tool_end", {
                  id: call.id,
                  name: call.name,
                  arguments: safeJson(call.arguments),
                  output,
                  approvals,
                });
                for (const a of approvals) send("approval", a);
                return buildFunctionCallOutput(call, output);
              } catch (e) {
                const message =
                  e instanceof Error ? e.message : "local tool failed";
                send("tool_end", {
                  id: call.id,
                  name: call.name,
                  arguments: safeJson(call.arguments),
                  output: "",
                  error: message,
                  approvals: [],
                });
                return buildFunctionCallOutput(
                  call,
                  JSON.stringify({ ok: false, error: message })
                );
              }
            })
          );

          nextInput = outputs;
        }

        send("done", {});
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/* --------------------------------------------------------------------- */

function toResponsesInput(m: ClientMessage): ResponseInputItem {
  if (m.role === "user") {
    return {
      role: "user",
      content: [{ type: "input_text", text: m.content }],
    };
  }
  return {
    role: "assistant",
    content: [{ type: "output_text", text: m.content, annotations: [] }],
  } as unknown as ResponseInputItem;
}

function pickResponseId(event: ResponseStreamEvent): string | undefined {
  const ev = event as ResponseStreamEvent & Record<string, unknown>;
  const r = ev.response as { id?: string } | undefined;
  return r?.id;
}

function handleEvent(
  event: ResponseStreamEvent,
  send: (event: string, data: unknown) => void,
  pendingCalls: ResponseFunctionToolCall[]
): void {
  const ev = event as ResponseStreamEvent & Record<string, unknown>;
  switch (ev.type) {
    case "response.created":
    case "response.in_progress": {
      const r = ev.response as { id?: string } | undefined;
      if (r?.id) send("response", { id: r.id });
      return;
    }
    case "response.output_text.delta": {
      const delta = ev.delta as string | undefined;
      if (delta) send("delta", { text: delta });
      return;
    }
    case "response.output_text.done":
      return;
    case "response.output_item.added": {
      const item = ev.item as {
        type?: string;
        id?: string;
        name?: string;
      };
      if (item?.type === "mcp_call") {
        send("tool_start", {
          id: item.id,
          name: item.name,
          server: "base-mcp",
        });
      } else if (item?.type === "function_call") {
        send("tool_start", {
          id: item.id,
          name: item.name,
          server: "basepilot",
        });
      } else if (item?.type === "mcp_approval_request") {
        send("approval_required", { id: item.id, name: item.name });
      }
      return;
    }
    case "response.output_item.done": {
      const item = ev.item as {
        type?: string;
        id?: string;
        call_id?: string;
        name?: string;
        arguments?: string;
        output?: string;
        error?: string;
        tools?: Array<{ name: string; description?: string }>;
      };
      if (item?.type === "mcp_call") {
        const output = item.output ?? "";
        const approvals = extractApprovals(output);
        send("tool_end", {
          id: item.id,
          name: item.name,
          arguments: safeJson(item.arguments),
          output,
          error: item.error,
          approvals,
        });
        for (const a of approvals) send("approval", a);
      } else if (item?.type === "function_call") {
        // Queue it for our local executor; the actual run happens after the
        // stream closes so we can send the function_call_output back as a
        // single chained Responses-API call.
        pendingCalls.push({
          type: "function_call",
          id: item.id!,
          call_id: item.call_id!,
          name: item.name!,
          arguments: item.arguments ?? "{}",
          status: "completed",
        } as ResponseFunctionToolCall);
      } else if (item?.type === "mcp_list_tools" && item.tools) {
        send("tools_list", { tools: item.tools });
      }
      return;
    }
    case "response.completed": {
      const r = ev.response as unknown as { id?: string } | undefined;
      if (r?.id) send("response", { id: r.id });
      return;
    }
    case "response.failed":
    case "error": {
      const errObj = ev.error as { message?: string } | undefined;
      const message = errObj?.message ?? (ev.message as string | undefined);
      send("error", { message: message ?? "Stream error" });
      return;
    }
    default:
      return;
  }
}

function safeJson(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
