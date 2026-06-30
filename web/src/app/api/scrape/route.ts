import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { scrapeWebsite } from "@/lib/scrape";

export async function POST(req: Request) {
  await requireUser();
  const body = await req.json();
  const url = String(body.url ?? "").trim();
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  const result = await scrapeWebsite(url);
  return NextResponse.json(result);
}
