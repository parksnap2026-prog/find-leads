import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readUserMailSettings } from "@/lib/db/local";
import { prependEmailLogs } from "@/lib/db/user-activity";
import { sendUserMail } from "@/lib/mail";
import type { EmailLogEntry } from "@/lib/db/types";

export async function POST(req: Request) {
  const user = await requireUser();
  const settings = readUserMailSettings(user.id);
  if (!settings) {
    return NextResponse.json(
      { error: "Configure your mail settings first in Settings" },
      { status: 400 },
    );
  }

  const form = await req.formData();
  const toRaw = String(form.get("to") ?? "").trim();
  const subject = String(form.get("subject") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const bizName = String(form.get("biz_name") ?? "").trim();
  const template = String(form.get("template") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const country = String(form.get("country") ?? "").trim();
  const bizType = String(form.get("biz_type") ?? "").trim();
  const isTest = String(form.get("is_test") ?? "false") === "true";

  if (!toRaw || !subject || !body) {
    return NextResponse.json({ error: "to, subject and body are required" }, { status: 400 });
  }

  const recipients = toRaw.split(/[,;\n]+/).map((e) => e.trim()).filter(Boolean);
  if (!recipients.length) {
    return NextResponse.json({ error: "No valid recipients" }, { status: 400 });
  }

  const results = await sendUserMail(user.id, settings, { to: recipients, subject, body });
  const now = new Date().toISOString();
  const newLogs: EmailLogEntry[] = [];

  for (const addr of recipients) {
    if (results[addr] === "sent") {
      newLogs.push({
        id: crypto.randomUUID(),
        sentAt: now,
        businessName: bizName,
        emailAddress: addr,
        template,
        subject,
        city,
        country,
        businessType: bizType,
        testReal: isTest ? "Test" : "Real",
      });
    }
  }

  await prependEmailLogs(user.id, newLogs);
  return NextResponse.json({ ok: true, results });
}
