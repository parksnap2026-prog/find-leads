import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { setGoogleApiKey } from "@/lib/google-key";

export async function POST(req: Request) {
  await requireUser();
  const body = await req.json();
  const key = String(body.api_key ?? "").trim();
  if (!key) {
    return NextResponse.json({ error: "Empty key" }, { status: 400 });
  }
  setGoogleApiKey(key);
  return NextResponse.json({ ok: true });
}
