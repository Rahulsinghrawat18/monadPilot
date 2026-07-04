import { NextRequest, NextResponse } from "next/server";
import { getSession, getValidAccessToken } from "@/lib/session";
import { callTool, parseToolResult } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mcp/status?requestId=...
 *
 * Calls the Base MCP `get_request_status` tool to check whether an
 * approval-mode write call has been confirmed by the user. The agent
 * only calls this once per click; the UI may poll once after the user
 * clicks "Approve Transaction" and closes Base Account.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.mcp) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const requestId = req.nextUrl.searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json(
      { error: "requestId is required" },
      { status: 400 }
    );
  }

  try {
    const token = await getValidAccessToken();
    const result = await callTool(token, "get_request_status", { requestId });
    const parsed = parseToolResult(result);
    return NextResponse.json({
      status: parsed.data ?? parsed.text,
      text: parsed.text,
      isError: parsed.isError,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to poll status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
