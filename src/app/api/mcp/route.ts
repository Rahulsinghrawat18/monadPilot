import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const REQUESTS_FILE = "/Users/rahulrawat/.gemini/antigravity-ide/brain/770e0a75-bcbd-453b-85bb-750248895f86/scratch/mcp_requests.json";

function getRequests() {
  try {
    if (!fs.existsSync(REQUESTS_FILE)) {
      fs.mkdirSync(path.dirname(REQUESTS_FILE), { recursive: true });
      fs.writeFileSync(REQUESTS_FILE, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(REQUESTS_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function saveRequest(requestId: string, data: any) {
  const reqs = getRequests();
  reqs[requestId] = { ...reqs[requestId], ...data };
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(reqs, null, 2));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, params, id } = body;

    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-06-18",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "monad-mcp-mock",
            version: "0.1.0"
          }
        }
      });
    }

    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "get_wallets",
              description: "Retrieve the list of wallets associated with the user's account.",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_balances",
              description: "Retrieve token balances for the user's account.",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "send_tokens",
              description: "Send MON or ERC-20 tokens to a recipient address on Monad.",
              inputSchema: {
                type: "object",
                properties: {
                  to: { type: "string", description: "Recipient address (0x...)" },
                  amount: { type: "string", description: "Amount to send as a decimal string" },
                  tokenAddress: { type: "string", description: "Token contract address or '0xEeee...'" },
                  symbol: { type: "string", description: "Token symbol" }
                },
                required: ["to", "amount"]
              }
            },
            {
              name: "swap_tokens",
              description: "Swap tokens on Monad.",
              inputSchema: {
                type: "object",
                properties: {
                  from: { type: "string", description: "Source token symbol or address" },
                  to: { type: "string", description: "Destination token symbol or address" },
                  amount: { type: "string", description: "Amount of source token to swap" }
                },
                required: ["from", "to", "amount"]
              }
            },
            {
              name: "send_calls",
              description: "Batch multiple contract calls together in a single transaction bundle.",
              inputSchema: {
                type: "object",
                properties: {
                  calls: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        to: { type: "string" },
                        value: { type: "string" },
                        data: { type: "string" }
                      },
                      required: ["to", "value", "data"]
                    }
                  },
                  chain: { type: "string" }
                },
                required: ["calls", "chain"]
              }
            },
            {
              name: "deposit",
              description: "Deposit tokens into a yield vault or liquidity pool on Monad.",
              inputSchema: {
                type: "object",
                properties: {
                  amount: { type: "string", description: "Amount to deposit as a decimal string" },
                  tokenAddress: { type: "string", description: "Token contract address or '0xEeee...'" },
                  poolId: { type: "string", description: "Target yield vault or pool contract address (0x...)" },
                  chain: { type: "string", description: "Chain name (default: monad)" }
                },
                required: ["amount", "poolId"]
              }
            },
            {
              name: "get_request_status",
              description: "Check the status of a pending transaction request.",
              inputSchema: {
                type: "object",
                properties: {
                  requestId: { type: "string" }
                },
                required: ["requestId"]
              }
            }
          ]
        }
      });
    }

    if (method === "tools/call") {
      const toolName = params.name;
      const toolArgs = params.arguments || {};

      if (toolName === "get_wallets") {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify([
                  {
                    name: "Monad Primary Wallet",
                    address: "0x836EFD0000000000000000000000000000000143",
                    chainId: 143
                  }
                ])
              }
            ]
          }
        });
      }

      if (toolName === "get_balances") {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify([
                  { symbol: "MON", balance: "150.0", usdValue: "$150.00", isNative: true },
                  { symbol: "WMON", balance: "500.0", usdValue: "$500.00" },
                  { symbol: "USDC", balance: "250.0", usdValue: "$250.00" },
                  { symbol: "CHOG", balance: "1000.0", usdValue: "$35.00" }
                ])
              }
            ]
          }
        });
      }

      if (toolName === "send_tokens" || toolName === "swap_tokens" || toolName === "send_calls" || toolName === "deposit") {
        const requestId = "req_" + Math.random().toString(36).substring(2, 15);
        saveRequest(requestId, {
          status: "pending",
          details: toolArgs,
          tool: toolName,
          createdAt: Date.now()
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const approvalUrl = `${appUrl}/mcp/approve?requestId=${requestId}`;

        const resultJson = {
          approvalUrl,
          requestId
        };

        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(resultJson)
              }
            ]
          }
        });
      }

      if (toolName === "get_request_status") {
        const reqs = getRequests();
        const reqId = toolArgs.requestId;
        const record = reqs[reqId] || { status: "pending" };

        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: record.status,
                  transactionHash: record.txHash || null
                })
              }
            ]
          }
        });
      }
    }

    return NextResponse.json(
      { error: `Method ${method} not supported` },
      { status: 404 }
    );
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "MCP server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
