import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { scrapeWebsite } from "@/lib/scrape";
import { MAX_ENRICHMENT_SELECTION } from "@/lib/constants";

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export async function POST(req: Request) {
  await requireUser();
  const body = await req.json();
  const urls = (body.urls as string[]) ?? [];
  if (!urls.length) {
    return NextResponse.json({ error: "urls required — pass selected row websites only" }, { status: 400 });
  }

  const unique = [...new Set(urls.filter(Boolean))].slice(0, MAX_ENRICHMENT_SELECTION);
  const out: Record<string, Awaited<ReturnType<typeof scrapeWebsite>>> = {};

  const pairs = await mapWithConcurrency(unique, 2, async (url) => {
    const result = await scrapeWebsite(url);
    return { url, result };
  });

  for (const { url, result } of pairs) {
    out[url] = result;
  }

  return NextResponse.json(out);
}
