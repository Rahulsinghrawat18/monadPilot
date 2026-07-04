import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const REQUESTS_FILE = "/Users/rahulrawat/.gemini/antigravity-ide/brain/770e0a75-bcbd-453b-85bb-750248895f86/scratch/mcp_requests.json";

export async function POST(req: NextRequest) {
  try {
    const { requestId, txHash: customTxHash } = await req.json();
    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    if (!fs.existsSync(REQUESTS_FILE)) {
      return NextResponse.json({ error: "No requests found" }, { status: 404 });
    }

    const reqs = JSON.parse(fs.readFileSync(REQUESTS_FILE, "utf8"));
    if (!reqs[requestId]) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Use custom transaction hash if provided; otherwise generate a random one
    const txHash = customTxHash || ("0x" + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join(""));

    reqs[requestId].status = "completed";
    reqs[requestId].txHash = txHash;
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(reqs, null, 2));

    return NextResponse.json({ ok: true, txHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
