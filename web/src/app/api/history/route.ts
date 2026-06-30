import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readUserJson, writeUserJson } from "@/lib/db/local";
import type { HistoryEntry } from "@/types";

export async function GET() {
  const user = await requireUser();
  const history = readUserJson<HistoryEntry[]>(user.id, "history.json", []);
  return NextResponse.json(history);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const history = readUserJson<HistoryEntry[]>(user.id, "history.json", []);
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    label: body.label ?? "Saved search",
    params: body.params ?? {},
    resultCount: body.resultCount ?? 0,
  };
  history.unshift(entry);
  writeUserJson(user.id, "history.json", history.slice(0, 100));
  return NextResponse.json(entry);
}
