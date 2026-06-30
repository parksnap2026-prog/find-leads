import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  readCallAudit,
  readEmailLogs,
  deleteCallAuditEntry,
  deleteEmailLogEntry,
} from "@/lib/db/user-activity";

export async function GET(req: Request) {
  const user = await requireUser();
  const type = new URL(req.url).searchParams.get("type") ?? "emails";

  if (type === "calls") {
    return NextResponse.json(await readCallAudit(user.id));
  }
  return NextResponse.json(await readEmailLogs(user.id));
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const type = String(body.type ?? "emails");
  const id = String(body.id ?? "");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (type === "calls") {
    await deleteCallAuditEntry(user.id, id);
  } else {
    await deleteEmailLogEntry(user.id, id);
  }

  return NextResponse.json({ ok: true });
}
