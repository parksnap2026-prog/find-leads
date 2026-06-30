import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readSearchHistory, appendSearchHistory } from "@/lib/db/user-activity";
import type { HistoryEntry } from "@/types";

export async function GET() {
  const user = await requireUser();
  const history = await readSearchHistory(user.id);
  return NextResponse.json(history);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    label: body.label ?? "Saved search",
    params: body.params ?? {},
    resultCount: body.resultCount ?? 0,
  };
  await appendSearchHistory(user.id, entry);
  return NextResponse.json(entry);
}
