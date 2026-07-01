import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadUserTemplate, saveUserTemplate } from "@/lib/user-templates";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;
  const tpl = await loadUserTemplate(user.id, id);
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
    const updated = await saveUserTemplate(user.id, id, body);
    return NextResponse.json({ ok: true, template: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 404 },
    );
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Built-in templates cannot be deleted" },
    { status: 400 },
  );
}
