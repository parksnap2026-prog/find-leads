import path from "path";
import nodemailer from "nodemailer";
import { readUserLogoBuffer } from "@/lib/logo";
import { logoCidsInHtml } from "@/lib/logo-preview";
import {
  createMailTransport,
  smtpFromAddress,
  smtpFromHeader,
  smtpMessageDomain,
  smtpReplyTo,
} from "@/lib/mail-transport";
import { resolveMailFromFields } from "@/lib/mail-contact";
import type { MailSettings } from "@/lib/db/types";

function formatSmtpError(e: unknown): string {
  if (!(e instanceof Error)) return "Send failed";
  const err = e as Error & { response?: string };
  const parts = [err.message];
  if (err.response) parts.push(err.response);
  return parts.join(" — ");
}

export async function sendSmtpPing(settings: MailSettings, to?: string) {
  const transporter = createMailTransport(settings);
  const toAddr = (to || settings.user).trim();
  const fromAddr = smtpFromAddress(settings);
  const domain = smtpMessageDomain(settings);

  const info = await transporter.sendMail({
    from: smtpFromHeader(settings),
    to: toAddr,
    replyTo: smtpReplyTo(settings),
    envelope: {
      from: fromAddr,
      to: toAddr,
    },
    messageId: `<${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`,
    subject: "MyBusinessesLeads — SMTP test",
    text: "If you received this email, your MyBusinessesLeads mail settings are working correctly.",
    html: `<div style="font-family:Arial,sans-serif;padding:24px">
      <h2 style="color:#4f46e5;margin:0 0 12px">Mail settings OK</h2>
      <p>If you received this email, your <strong>MyBusinessesLeads</strong> SMTP settings are working.</p>
      <p style="color:#64748b;font-size:13px">Sent to ${toAddr}</p>
    </div>`,
  });

  return { to: toAddr, messageId: info.messageId };
}

export async function sendUserMail(
  userId: string,
  settings: MailSettings,
  input: {
    to: string[];
    subject: string;
    body: string;
  },
) {
  const resolved = resolveMailFromFields(userId, settings);
  const transporter = createMailTransport(resolved);
  const fromAddr = smtpFromAddress(resolved);

  const isHtml = input.body.trimStart().startsWith("<");
  const results: Record<string, string> = {};
  const logoAsset = readUserLogoBuffer(userId);

  const domain = smtpMessageDomain(resolved);

  for (const addr of input.to) {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: smtpFromHeader(resolved),
        to: addr,
        replyTo: smtpReplyTo(resolved),
        envelope: {
          from: fromAddr,
          to: addr,
        },
        messageId: `<${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`,
        subject: input.subject,
      };

      if (isHtml) {
        mailOptions.html = input.body;
        mailOptions.text = input.body.replace(/<[^>]+>/g, " ");
        if (logoAsset) {
          const ext = path.extname(logoAsset.filepath) || ".png";
          mailOptions.attachments = logoCidsInHtml(input.body).map((cid) => ({
            filename: `logo${ext}`,
            content: logoAsset.buffer,
            contentType: logoAsset.mime,
            cid,
            contentDisposition: "inline" as const,
          }));
        }
      } else {
        mailOptions.text = input.body;
      }

      await transporter.sendMail(mailOptions);
      results[addr] = "sent";
    } catch (e) {
      results[addr] = formatSmtpError(e);
    }
  }

  return results;
}

/** Flask logs in and sends — it does not call EHLO verify alone. */
export async function testMailSettings(settings: MailSettings, to?: string) {
  return sendSmtpPing(settings, to);
}
