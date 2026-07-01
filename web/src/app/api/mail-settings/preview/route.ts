import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getMailSettings } from "@/lib/db/user-mail";
import { composeMessage } from "@/lib/compose";
import { getMailContactContext } from "@/lib/mail-contact";

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const template_id = String(body.template_id ?? "").trim();
  if (!template_id) {
    return NextResponse.json({ error: "template_id required" }, { status: 400 });
  }

  const mail = await getMailSettings(user.id);
  const ctx = await getMailContactContext(user.id, mail, user.name);

  try {
    const result = await composeMessage(
      user.id,
      {
        template_id,
        name: String(body.sample_name ?? "Sample Business"),
        business_type: String(body.business_type ?? ctx.businessType),
        city: String(body.city ?? ctx.city),
      },
      mail,
      user.id,
      user.name,
    );
    return NextResponse.json({
      ...result,
      contact: ctx,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Preview failed" },
      { status: 400 },
    );
  }
}
