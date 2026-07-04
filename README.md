# monadPilot

> **Talk to DeFi.** A voice-first AI copilot on Monad, powered by [Monad MCP](https://docs.monad.xyz).

monadPilot lets users send tokens, swap assets, find the best yields, and deploy custom tokens — all in one sentence. It connects your AI assistant (OpenAI Responses API + Whisper) to your Monad Wallet through a local Monad MCP server, so every write action is signed in your wallet with a one-click MetaMask approval.

**Try saying:**

> "Send 5 MON to 0xYourMonadAddress"

> "Swap 0.05 MON to USDT"

> "Find the best MON yield on Monad and deposit 1 MON into the Ambient pool"

---

## Architecture

```
┌──────────────┐   voice/text   ┌──────────────────────┐
│   Browser    │ ────────────▶ │   /api/chat (SSE)    │
│  (Next.js)   │ ◀────────────  │   OpenAI Responses   │
└──────────────┘    stream      └──────────┬───────────┘
                                           │ local MCP (route)
                                ┌──────────▼───────────┐
                                │   Local MCP Server   │
                                │  (Monad Account)     │
                                └──────────┬───────────┘
                                  approval │ url / MetaMask
                                ┌──────────▼───────────┐
                                │  MetaMask Interface  │
                                │  (user approves tx)  │
                                └──────────────────────┘
```

- **Wallet & writes**: Inline MetaMask transaction triggers on Monad Mainnet. We never hold keys.
- **Chat orchestration**: OpenAI Responses API with Local Monad MCP server integration, plus local read-only function tools (`find_base_yield`, `read_portfolio`, `get_token_prices_usd`).
- **Yield discovery**: Live DefiLlama yields, filtered to Monad (Ambient/Kuru).
- **Voice**: Browser MediaRecorder → OpenAI Whisper → autosend transcript.
- **Auth**: Simple mock login/session provider for developer convenience. Session tokens stored encrypted in an iron-session cookie.

---

## Quick start

```bash
git clone <this repo>
cd monadpilot
npm install
cp .env.example .env.local
# fill in OPENAI_API_KEY and a SESSION_SECRET (32+ chars)
openssl rand -base64 48   # paste into SESSION_SECRET
npm run dev
```

Open <http://localhost:3000>, click **Connect Wallet**, log in, and start talking.

### Required env

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key — drives the chat + Whisper transcription. |
| `SESSION_SECRET` | 32+ char random string used to encrypt the session cookie. |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL (e.g. `http://localhost:3000` in dev). Used as the redirect target. |

See `.env.example` for the full set.

---

## Demo script

1. Land on `/`, click **Connect Wallet**.
2. Connect your browser wallet (MetaMask) and log in.
3. Land in `/app`. Say or type:
   - "Show me my wallets"
   - "What's my MON balance?"
   - "Swap 0.05 MON to USDT" → click **Approve Transaction** inline
   - "Find the best MON yield" → monadPilot scans Ambient and Kuru yields live
   - "Deposit 1 MON into Ambient" → click **Approve Transaction** in chat to trigger MetaMask
   - "Launch a token named Baby Monad with symbol BMOD" → click **Approve Transaction** to deploy
4. Watch tx hashes light up in the chat with MonadVision links.

---

## Project layout

```
src/
  app/
    api/
      auth/         Mock login, callback, logout, me
      chat/         SSE chat endpoint (agent loop + MCP)
      mcp/status/   Approval status polling
      voice/        Whisper transcription
      apy/          Live yields (DefiLlama)
      portfolio/    On-chain Monad portfolio + USD valuations
    app/page.tsx    Authenticated chat workspace
    page.tsx        Landing
  components/
    chat/           ChatContainer, MessageBubble, ToolCallCard, ApprovalCard, VoiceButton
    ui/             shadcn-style primitives (Button, Card, Dialog, …)
    wallet/         ConnectButton (MetaMask integration)
  hooks/
    use-chat-stream.ts   SSE consumer + chat dispatch
    use-voice-recorder.ts MediaRecorder + Whisper
  lib/
    ai/             OpenAI client, local function tools, output parsing
    apy/            DefiLlama yields integration (Ambient/Kuru)
    constants/      Monad tokens + protocol contracts
    mcp/            Local Mock JSON-RPC MCP server
    wallet/         On-chain reads (balances, portfolio, prices)
    utils/          formatting, cn(), etc.
  prompts/system.ts  System prompt (tool routing, tone, safety)
  store/chat.ts     Zustand store for live chat state
```

---

## Security

- **No private keys in monadPilot.** Writes are signed exclusively by you via MetaMask window.ethereum triggers.
- **No raw calldata from the LLM.** Every write goes through a Monad MCP tool that validates parameters.
- **Session tokens** are encrypted in the session cookie (iron-session) with `SESSION_SECRET`.
- **Voice transcription** is gated behind authentication so visitors can't burn your Whisper quota.

---

## Built with

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [OpenAI Responses API](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) (`mcp` + `function` tools)
- [Monad EVM](https://docs.monad.xyz) (Chain ID 143)
- [Viem](https://viem.sh) for on-chain reads
- [DefiLlama yields](https://defillama.com/yields) for APY discovery
- shadcn-style UI, Tailwind v4, Framer Motion, Sonner

---

## License

MIT
