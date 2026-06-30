import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  readCallLogState,
  writeCallLogState,
  prependCallAudit,
} from "@/lib/db/user-activity";
import type { CallLogEntry } from "@/lib/db/types";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json(await readCallLogState(user.id));
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const bizId = String(body.id ?? "").trim();
  if (!bizId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const called = Boolean(body.called);
  const state = await readCallLogState(user.id);

  if (called) {
    state[bizId] = {
      called: true,
      calledAt: String(body.calledAt ?? new Date().toISOString()),
      name: String(body.name ?? ""),
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      website: String(body.website ?? ""),
      city: String(body.city ?? ""),
      country: String(body.country ?? ""),
      businessType: String(body.businessType ?? ""),
    };
  } else {
    delete state[bizId];
  }
  await writeCallLogState(user.id, state);

  const entry: CallLogEntry = {
    id: crypto.randomUUID(),
    calledAt: new Date().toISOString(),
    action: called ? "Called" : "Uncalled",
    businessName: String(body.name ?? ""),
    businessId: bizId,
    phone: String(body.phone ?? ""),
    city: String(body.city ?? ""),
    country: String(body.country ?? ""),
  };
  await prependCallAudit(user.id, entry);

  return NextResponse.json({ ok: true });
}
