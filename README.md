# basePilot

> **Talk to DeFi.** A voice-first AI copilot on Base, powered by [Base MCP](https://docs.base.org/ai-agents).

basePilot lets users send tokens, swap assets, find the best yields, and lend to Morpho — all in one sentence. It connects your AI assistant (OpenAI Responses API + Whisper) to your Base Account through the Base MCP server (`mcp.base.org`), so every write action is signed in your wallet with a one-click approval.

**Try saying:**

> "Send 5 USDC to jesse.base.eth"

> "Swap 0.05 ETH to USDC"

> "Find the best USDC yield on Base and deposit 100 USDC into the winner"

---

## Architecture

```
┌──────────────┐   voice/text   ┌──────────────────────┐
│   Browser    │ ────────────▶ │   /api/chat (SSE)    │
│  (Next.js)   │ ◀────────────  │   OpenAI Responses   │
└──────────────┘    stream      └──────────┬───────────┘
                                           │ MCP (oauth)
                                ┌──────────▼───────────┐
                                │   mcp.base.org       │
                                │  (Base Account)      │
                                └──────────┬───────────┘
                                  approval │ url
                                ┌──────────▼───────────┐
                                │   Base Account UI    │
                                │  (user approves tx)  │
                                └──────────────────────┘
```

- **Wallet & writes**: Base MCP. We never hold keys.
- **Chat orchestration**: OpenAI Responses API with Base MCP wired in as an `mcp` tool, plus local read-only function tools (`find_base_yield`, `read_portfolio`, `get_token_prices_usd`).
- **Yield discovery**: live DefiLlama yields, filtered to Base + Morpho/Moonwell/Aerodrome.
- **Voice**: browser MediaRecorder → OpenAI Whisper → autosend transcript.
- **Auth**: OAuth 2.1 + PKCE with Dynamic Client Registration against `mcp.base.org`. Tokens stored encrypted in an iron-session cookie.

---

## Quick start

```bash
git clone <this repo>
cd basepilot
npm install
cp .env.example .env.local
# fill in OPENAI_API_KEY and a SESSION_SECRET (32+ chars)
openssl rand -base64 48   # paste into SESSION_SECRET
npm run dev
```

Open <http://localhost:3000>, click **Connect Base Account**, approve in your Base Account, and start talking.

### Required env

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key — drives the chat + Whisper transcription. |
| `SESSION_SECRET` | 32+ char random string used to encrypt the session cookie. |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL (e.g. `http://localhost:3000` in dev). Used as the OAuth redirect target. |

See `.env.example` for the full set.

---

## Demo script

1. Land on `/`, click **Connect Base Account**.
2. Approve in your Base Account.
3. Land in `/app`. Say or type:
   - "Show me my wallets"
   - "What's my USDC balance?"
   - "Swap 0.05 ETH to USDC" → click **Approve Transaction**
   - "Find the best USDC yield" → basePilot scans Morpho + Moonwell + Aerodrome live
   - "Deposit 100 USDC into the winner" → Base MCP's Morpho plugin prepares the approve+deposit bundle → click **Approve Transaction**
4. Watch tx hashes light up in the chat with BaseScan links.

---

## Project layout

```
src/
  app/
    api/
      auth/         OAuth login, callback, logout, me
      chat/         SSE chat endpoint (agent loop + MCP)
      mcp/status/   Approval status polling
      voice/        Whisper transcription
      apy/          Live yields (DefiLlama)
      portfolio/    On-chain Base portfolio + USD valuations
    app/page.tsx    Authenticated chat workspace
    page.tsx        Landing
  components/
    chat/           ChatContainer, MessageBubble, ToolCallCard, ApprovalCard, VoiceButton
    ui/             shadcn-style primitives (Button, Card, Dialog, …)
    wallet/         ConnectButton (OAuth flow)
  hooks/
    use-chat-stream.ts   SSE consumer + chat dispatch
    use-voice-recorder.ts MediaRecorder + Whisper
  lib/
    ai/             OpenAI client, local function tools, output parsing
    apy/            DefiLlama integration
    constants/      Base tokens + protocol contracts
    mcp/            OAuth (PKCE/DCR) + lightweight JSON-RPC client
    wallet/         On-chain reads (balances, portfolio, prices)
    utils/          formatting, cn(), etc.
  prompts/system.ts  System prompt (tool routing, tone, safety)
  store/chat.ts     Zustand store for live chat state
```

---

## Security

- **No private keys in basePilot.** Writes are signed exclusively by Base Account via approval URLs.
- **No raw calldata from the LLM.** Every write goes through a Base MCP tool that validates the request.
- **OAuth tokens** are encrypted in the session cookie (iron-session) with `SESSION_SECRET`.
- **Voice transcription** is gated behind authentication so visitors can't burn your Whisper quota.

---

## Built with

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) (`mcp` + `function` tools)
- [Base MCP](https://docs.base.org/ai-agents) — `https://mcp.base.org`
- [Viem](https://viem.sh) for on-chain reads
- [DefiLlama yields](https://defillama.com/yields) for APY discovery
- shadcn-style UI, Tailwind v4, Framer Motion, Sonner

---

## License

MIT
