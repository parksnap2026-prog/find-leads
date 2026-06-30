import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { runSearch } from "@/lib/search";
import { searchListings } from "@/lib/listings";
import type { OsmTagPair } from "@/lib/search-scope";

function parseScopeTags(body: Record<string, unknown>): OsmTagPair[] {
  const raw = Array.isArray(body.scope_tags)
    ? body.scope_tags
    : Array.isArray(body.custom_tags)
      ? body.custom_tags
      : [];

  return raw
    .map((t: unknown) => {
      if (!Array.isArray(t) || t.length < 2) return null;
      const key = String(t[0] ?? "").trim();
      const value = String(t[1] ?? "").trim();
      return key && value ? ([key, value] as OsmTagPair) : null;
    })
    .filter(Boolean) as OsmTagPair[];
}

export async function POST(req: Request) {
  await requireUser();
  const body = await req.json();
  const country = String(body.country ?? "").trim();
  const city = String(body.city ?? "").trim();
  const business_type = String(body.business_type ?? "hair_salon");
  const radius = Number(body.radius ?? 5000);
  const scope_tags = parseScopeTags(body);

  if (!country || !city) {
    return NextResponse.json(
      { error: "country and city are required" },
      { status: 400 },
    );
  }

  const result = await runSearch({ country, city, business_type, radius, scope_tags });
  const listings = searchListings(country, city, business_type);
  const merged = [...listings, ...result.results];
  const seen = new Set<string>();
  const deduped = merged.filter((r) => {
    const key = `${r.name.toLowerCase()}|${r.address.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (result.error && !deduped.length) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ...result,
    results: deduped,
    total: deduped.length,
  });
}
