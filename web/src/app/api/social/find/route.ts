import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { findSocialByQuery } from "@/lib/find-query";
import { scrapeWebsite } from "@/lib/scrape";

const MAX_ITEMS = 20;

export async function POST(req: Request) {
  await requireUser();
  const body = await req.json();
  const items = Array.isArray(body.items) ? body.items : [];
  const scrape = body.scrape !== false;

  const trimmed = items
    .slice(0, MAX_ITEMS)
    .map((item: { id?: string; name?: string; city?: string; country?: string; social?: string }) => ({
      id: String(item.id ?? ""),
      name: String(item.name ?? "").trim(),
      city: String(item.city ?? "").trim(),
      country: String(item.country ?? "").trim(),
      social: String(item.social ?? "").trim(),
    }))
    .filter((item: { id: string; name: string }) => item.id && item.name);

  const social: Record<string, string> = {};
  const scraped: Record<string, Awaited<ReturnType<typeof scrapeWebsite>>> = {};

  for (const item of trimmed) {
    const url = item.social || (await findSocialByQuery(item.name, item.city, item.country));
    if (url) {
      social[item.id] = url;
      if (scrape) {
        scraped[url] = await scrapeWebsite(url);
      }
    }
  }

  return NextResponse.json({ social, scraped });
}
