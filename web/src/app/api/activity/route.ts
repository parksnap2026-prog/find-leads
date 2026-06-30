import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  readUserCallAudit,
  readUserEmailLogs,
  writeUserCallAudit,
  writeUserEmailLogs,
} from "@/lib/db/local";

export async function GET(req: Request) {
  const user = await requireUser();
  const type = new URL(req.url).searchParams.get("type") ?? "emails";

  if (type === "calls") {
    return NextResponse.json(readUserCallAudit(user.id));
  }
  return NextResponse.json(readUserEmailLogs(user.id));
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const type = String(body.type ?? "emails");
  const id = String(body.id ?? "");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (type === "calls") {
    const logs = readUserCallAudit(user.id).filter((l) => l.id !== id);
    writeUserCallAudit(user.id, logs);
  } else {
    const logs = readUserEmailLogs(user.id).filter((l) => l.id !== id);
    writeUserEmailLogs(user.id, logs);
  }

  return NextResponse.json({ ok: true });
}
