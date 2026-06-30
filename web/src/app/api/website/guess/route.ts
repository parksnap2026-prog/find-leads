import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { guessWebsitesForBusinesses } from "@/lib/website-url";
import { MAX_ENRICHMENT_SELECTION } from "@/lib/constants";

export async function POST(req: Request) {
  await requireUser();
  const body = await req.json();
  const items = Array.isArray(body.items) ? body.items : [];

  const trimmed = items
    .slice(0, MAX_ENRICHMENT_SELECTION)
    .map((item: { id?: string; name?: string; city?: string }) => ({
      id: String(item.id ?? ""),
      name: String(item.name ?? "").trim(),
      city: String(item.city ?? "").trim(),
    }))
    .filter((item: { id: string; name: string }) => item.id && item.name);

  if (!trimmed.length) {
    return NextResponse.json({ websites: {} });
  }

  const websites = await guessWebsitesForBusinesses(trimmed, 4);
  return NextResponse.json({ websites });
}
