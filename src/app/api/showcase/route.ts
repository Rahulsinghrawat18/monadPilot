import { NextRequest, NextResponse } from "next/server";
import fs from "fs";

const LOCAL_FALLBACK_FILE = "/Users/rahulrawat/.gemini/antigravity-ide/brain/770e0a75-bcbd-453b-85bb-750248895f86/.system_generated/steps/25/content.md";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || "";
  const event = searchParams.get("event") || "";
  const category = searchParams.get("category") || "";
  const winners = searchParams.get("winners") || "";
  const limit = searchParams.get("limit") || "100";
  const offset = searchParams.get("offset") || "0";

  const targetUrl = new URL("https://blitz.devnads.com/api/showcase");
  if (search) targetUrl.searchParams.set("search", search);
  if (event) targetUrl.searchParams.set("event", event);
  if (category) targetUrl.searchParams.set("category", category);
  if (winners) targetUrl.searchParams.set("winners", winners);
  targetUrl.searchParams.set("limit", limit);
  targetUrl.searchParams.set("offset", offset);

  try {
    const apiRes = await fetch(targetUrl.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 } // Cache for 60s
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      return NextResponse.json(data);
    }
  } catch (e) {
    // API call failed, continue to fallback
  }

  // Fallback: Read local cached file
  try {
    if (fs.existsSync(LOCAL_FALLBACK_FILE)) {
      const content = fs.readFileSync(LOCAL_FALLBACK_FILE, "utf8");
      const jsonLine = content.split("\n").find(line => line.trim().startsWith('{"projects"'));
      if (jsonLine) {
        const fullData = JSON.parse(jsonLine);
        
        // Let's filter locally for fallback simulation!
        let filtered = fullData.projects || [];
        
        if (search) {
          const s = search.toLowerCase();
          filtered = filtered.filter((p: any) => 
            p.title?.toLowerCase().includes(s) || 
            p.description?.toLowerCase().includes(s)
          );
        }
        if (event) {
          filtered = filtered.filter((p: any) => p.event?.slug === event || p.event?.name === event);
        }
        if (category) {
          filtered = filtered.filter((p: any) => p.category?.toLowerCase() === category.toLowerCase());
        }
        if (winners === "true") {
          filtered = filtered.filter((p: any) => p.is_winner === true);
        }

        const count = filtered.length;
        const sliced = filtered.slice(Number(offset), Number(offset) + Number(limit));

        return NextResponse.json({
          projects: sliced,
          total: count
        });
      }
    }
  } catch (err) {
    // ignore
  }

  return NextResponse.json({ projects: [], total: 0 });
}
