import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  readUserMailSettings,
  writeUserMailSettings,
} from "@/lib/db/local";
import { getMailContactContext, resolveMailFromFields } from "@/lib/mail-contact";
import { testMailSettings } from "@/lib/mail";
import type { MailSettings } from "@/lib/db/types";

function buildSettings(
  userId: string,
  body: Record<string, unknown>,
  existing: MailSettings | null,
  userName: string,
): MailSettings {
  return resolveMailFromFields(
    userId,
    {
      server: String(body.server ?? existing?.server ?? "").trim(),
      port: Number(body.port ?? existing?.port ?? 465),
      user: String(body.user ?? existing?.user ?? "").trim(),
      pass: String(body.pass ?? "").trim() || (existing?.pass ?? ""),
      fromName: String(body.fromName ?? existing?.fromName ?? "").trim(),
      fromEmail: "",
    },
    userName,
  );
}

export async function GET() {
  const user = await requireUser();
  const settings = readUserMailSettings(user.id);
  const contact = getMailContactContext(user.id, settings, user.name);

  if (!settings) {
    return NextResponse.json({
      configured: false,
      contact,
      defaults: {
        fromName: contact.businessName,
        user: user.email,
        port: 465,
      },
    });
  }

  return NextResponse.json({
    configured: true,
    server: settings.server,
    port: settings.port,
    user: settings.user,
    fromName: settings.fromName || contact.businessName,
    contact,
    hasPassword: Boolean(settings.pass),
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json();
  const existing = readUserMailSettings(user.id);

  const settings = buildSettings(user.id, body, existing, user.name);

  if (!settings.server || !settings.user || !settings.pass) {
    return NextResponse.json(
      { error: "SMTP server, your email and password are required" },
      { status: 400 },
    );
  }

  if (body.test) {
    try {
      const pingTo = String(body.pingTo ?? settings.user).trim();
      const ping = await testMailSettings(settings, pingTo);
      writeUserMailSettings(user.id, settings);
      return NextResponse.json({
        ok: true,
        pingSent: true,
        to: ping.to,
        messageId: ping.messageId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "SMTP test failed";
      return NextResponse.json(
        { error: `${msg}. Check server, port, email and password.` },
        { status: 400 },
      );
    }
  }

  writeUserMailSettings(user.id, settings);
  return NextResponse.json({ ok: true });
}
