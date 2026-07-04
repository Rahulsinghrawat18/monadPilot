import { redirect } from "next/navigation";
import { getSession, getValidAccessToken } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { ChatContainer } from "@/components/chat/chat-container";
import { callTool, parseToolResult } from "@/lib/mcp/client";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const session = await getSession();
  if (!session.mcp) {
    redirect("/?auth_error=not_connected");
  }

  // Best-effort wallet snapshot for the header. We don't block the chat on
  // this — if it fails we still render and the user can ask via chat.
  let address = session.account?.address ?? null;
  if (!address) {
    try {
      const token = await getValidAccessToken();
      const result = await callTool(token, "get_wallets", {});
      const parsed = parseToolResult(result);
      const stringified = JSON.stringify(parsed.data ?? parsed.text ?? "");
      const match = stringified.match(/0x[a-fA-F0-9]{40}/);
      if (match) {
        address = match[0] as `0x${string}`;
        session.account = { address };
        await session.save();
      }
    } catch {
      /* Non-fatal */
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <SiteHeader isConnected address={address} />
      <main className="flex-1 min-h-0">
        <ChatContainer isConnected address={address} />
      </main>
    </div>
  );
}
