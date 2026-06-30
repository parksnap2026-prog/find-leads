import nodemailer from "nodemailer";
import type { MailSettings } from "@/lib/db/types";

function isGmailHost(server: string) {
  const host = server.trim().toLowerCase();
  return host.includes("gmail.com") || host.includes("googlemail.com");
}

export function smtpMessageDomain(settings: MailSettings) {
  const userDomain = settings.user.trim().split("@")[1]?.toLowerCase();
  if (userDomain) return userDomain;
  return settings.server.trim().replace(/^mail\./i, "").toLowerCase() || "localhost";
}

export function smtpReplyTo(settings: MailSettings) {
  return settings.user.trim();
}

export function createMailTransport(settings: MailSettings) {
  const host = settings.server.trim();
  const port = settings.port || 465;
  const auth = {
    user: settings.user.trim(),
    pass: settings.pass,
  };

  if (isGmailHost(host)) {
    return nodemailer.createTransport({
      service: "gmail",
      auth,
    });
  }

  const tlsInsecure = process.env.MAIL_TLS_INSECURE === "true";
  const ehloName = process.env.MAIL_EHLO_NAME || smtpMessageDomain(settings);

  // Port 465: implicit SSL (smtplib.SMTP_SSL). Port 587: STARTTLS.
  if (port === 587) {
    return nodemailer.createTransport({
      host,
      port: 587,
      secure: false,
      requireTLS: true,
      name: ehloName,
      auth,
      tls: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: !tlsInsecure,
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: true,
    name: ehloName,
    auth,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: !tlsInsecure,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
  });
}

export function smtpFromAddress(settings: MailSettings) {
  return settings.user.trim();
}

export function smtpFromHeader(settings: MailSettings) {
  const addr = smtpFromAddress(settings);
  const name = (settings.fromName || "MyBusinessesLeads").replace(/"/g, "'");
  return `"${name}" <${addr}>`;
}
