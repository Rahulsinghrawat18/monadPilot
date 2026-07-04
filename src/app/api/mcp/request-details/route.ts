import { NextRequest, NextResponse } from "next/server";
import fs from "fs";

const REQUESTS_FILE = "/Users/rahulrawat/.gemini/antigravity-ide/brain/770e0a75-bcbd-453b-85bb-750248895f86/scratch/mcp_requests.json";

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
  }

  if (!fs.existsSync(REQUESTS_FILE)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const reqs = JSON.parse(fs.readFileSync(REQUESTS_FILE, "utf8"));
  const record = reqs[requestId];
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(record);
}
