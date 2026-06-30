import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadUserTemplates } from "@/lib/user-templates";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json(loadUserTemplates(user.id));
}
