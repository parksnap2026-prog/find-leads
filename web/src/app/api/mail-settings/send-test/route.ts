import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readUserEmailLogs, readUserMailSettings, writeUserEmailLogs } from "@/lib/db/local";
import { composeMessage } from "@/lib/compose";
import { getMailContactContext, resolveMailFromFields } from "@/lib/mail-contact";
import { sendSmtpPing, sendUserMail } from "@/lib/mail";

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const existing = readUserMailSettings(user.id);

  const settings = resolveMailFromFields(
    user.id,
    {
      server: String(body.server ?? existing?.server ?? "").trim(),
      port: Number(body.port ?? existing?.port ?? 465),
      user: String(body.user ?? existing?.user ?? "").trim(),
      pass: String(body.pass ?? "").trim() || (existing?.pass ?? ""),
      fromName: String(body.fromName ?? existing?.fromName ?? "").trim(),
      fromEmail: "",
    },
    user.name,
  );

  if (!settings.server || !settings.user || !settings.pass) {
    return NextResponse.json(
      { error: "SMTP server, your email and password are required — save settings first" },
      { status: 400 },
    );
  }

  const mode = String(body.mode ?? "template");

  if (mode === "ping") {
    try {
      const to = String(body.to ?? settings.user).trim();
      const ping = await sendSmtpPing(settings, to);
      return NextResponse.json({ ok: true, to: ping.to, messageId: ping.messageId, mode: "ping" });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Ping send failed" },
        { status: 400 },
      );
    }
  }

  const template_id = String(body.template_id ?? "").trim();
  const to = String(body.to ?? settings.user).trim();
  if (!template_id) {
    return NextResponse.json({ error: "Pick a template" }, { status: 400 });
  }
  if (!to) {
    return NextResponse.json({ error: "Test recipient email required" }, { status: 400 });
  }

  const ctx = getMailContactContext(user.id, settings, user.name);

  try {
    const composed = composeMessage(
      user.id,
      {
        template_id,
        name: String(body.sample_name ?? "Sample Business"),
        business_type: String(body.business_type ?? ctx.businessType),
        city: String(body.city ?? ctx.city),
      },
      settings,
      user.id,
      user.name,
    );

    const results = await sendUserMail(user.id, settings, {
      to: [to],
      subject: `[TEST] ${composed.subject}`,
      body: composed.body,
    });

    const status = results[to];
    if (status !== "sent") {
      return NextResponse.json({ error: status || "Send failed" }, { status: 400 });
    }

    const logs = readUserEmailLogs(user.id);
    logs.unshift({
      id: crypto.randomUUID(),
      sentAt: new Date().toISOString(),
      businessName: "Test email",
      emailAddress: to,
      template: template_id,
      subject: composed.subject,
      city: ctx.city,
      country: "",
      businessType: ctx.businessType,
      testReal: "Test",
    });
    writeUserEmailLogs(user.id, logs.slice(0, 500));

    return NextResponse.json({ ok: true, to, subject: composed.subject });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Test send failed" },
      { status: 400 },
    );
  }
}
