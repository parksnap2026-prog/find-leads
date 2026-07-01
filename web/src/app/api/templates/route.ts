import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadUserTemplates } from "@/lib/user-templates";

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

export async function POST() {
  return NextResponse.json(
    { error: "Only built-in templates are available" },
    { status: 400 },
  );
}
