import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  deleteUserTemplate,
  loadUserTemplate,
  saveUserTemplate,
} from "@/lib/user-templates";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;
  const tpl = loadUserTemplate(user.id, id);
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tpl);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;
  const body = await req.json();
  try {
    const updated = saveUserTemplate(user.id, id, body);
    return NextResponse.json({ ok: true, template: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 404 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;
  try {
    deleteUserTemplate(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 404 },
    );
  }
}
