import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  createUserTemplate,
  duplicateUserTemplate,
  loadUserTemplates,
} from "@/lib/user-templates";

export async function GET() {
  const user = await requireUser();
  const templates = loadUserTemplates(user.id);
  return NextResponse.json(
    templates.map(({ id, label, description, color }) => ({
      id,
      label,
      description,
      color,
    })),
  );
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  try {
    if (body.duplicateFrom) {
      const duplicated = duplicateUserTemplate(
        user.id,
        String(body.duplicateFrom),
        body.label ? String(body.label) : undefined,
      );
      return NextResponse.json({ ok: true, template: duplicated });
    }
    const created = createUserTemplate(user.id, {
      label: String(body.label ?? ""),
      description: body.description ? String(body.description) : undefined,
      color: body.color ? String(body.color) : undefined,
    });
    return NextResponse.json({ ok: true, template: created });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create template" },
      { status: 400 },
    );
  }
}
