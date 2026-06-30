import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { findWebsiteByQuery } from "@/lib/find-query";

export async function POST(req: Request) {
  await requireUser();
  const body = await req.json();
  const query = String(body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const result = await findWebsiteByQuery(query, googleKey || undefined);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    website: result.website,
    name: result.name,
    phone: result.phone,
    email: result.email,
    agent_data: result.scraped,
  });
}
