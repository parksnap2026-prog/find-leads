import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readUserMailSettings } from "@/lib/db/local";
import { composeMessage } from "@/lib/compose";

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const template_id = String(body.template_id ?? "");
  const name = String(body.name ?? "");
  const business_type = String(body.business_type ?? "");
  const city = String(body.city ?? "");

  if (!template_id) {
    return NextResponse.json({ error: "template_id required" }, { status: 400 });
  }

  try {
    const mail = readUserMailSettings(user.id);
    const result = composeMessage(
      user.id,
      { template_id, name, business_type, city },
      mail,
      user.id,
      user.name,
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Compose failed" },
      { status: 404 },
    );
  }
}
