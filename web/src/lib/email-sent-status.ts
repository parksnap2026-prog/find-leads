import type { EmailLogEntry } from "@/lib/db/types";

export interface EmailSentStatus {
  realSentAt?: string;
  testSentAt?: string;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export interface EmailSentIndex {
  realByEmail: Map<string, string>;
  realByName: Map<string, string>;
  testByName: Map<string, string>;
}

export function buildEmailSentIndex(logs: EmailLogEntry[]): EmailSentIndex {
  const realByEmail = new Map<string, string>();
  const realByName = new Map<string, string>();
  const testByName = new Map<string, string>();

  for (const log of logs) {
    const sentAt = log.sentAt;
    if (log.testReal === "Real") {
      const email = normalizeEmail(log.emailAddress);
      if (email) {
        const prev = realByEmail.get(email);
        if (!prev || sentAt > prev) realByEmail.set(email, sentAt);
      }
      const name = normalizeName(log.businessName);
      if (name) {
        const prev = realByName.get(name);
        if (!prev || sentAt > prev) realByName.set(name, sentAt);
      }
    } else {
      const name = normalizeName(log.businessName);
      if (name) {
        const prev = testByName.get(name);
        if (!prev || sentAt > prev) testByName.set(name, sentAt);
      }
    }
  }

  return { realByEmail, realByName, testByName };
}

export function getEmailSentStatus(
  biz: { name: string; email?: string },
  index: EmailSentIndex,
): EmailSentStatus {
  const emailKey = biz.email ? normalizeEmail(biz.email) : "";
  const nameKey = normalizeName(biz.name);
  const realSentAt =
    (emailKey ? index.realByEmail.get(emailKey) : undefined) ?? index.realByName.get(nameKey);
  const testSentAt = index.testByName.get(nameKey);
  return { realSentAt, testSentAt };
}

export function formatSentDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
