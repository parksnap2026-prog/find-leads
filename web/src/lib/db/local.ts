import fs from "fs";
import path from "path";
import type {
  CallLogEntry,
  CallLogState,
  EmailLogEntry,
  MailSettings,
  UserRecord,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function userDir(userId: string) {
  return path.join(DATA_DIR, "users", userId);
}

export function readUsersFile(): { users: UserRecord[] } {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(USERS_FILE)) return { users: [] };
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return { users: [] };
  }
}

export function writeUsersFile(data: { users: UserRecord[] }) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function ensureUserWorkspace(userId: string) {
  const dir = userDir(userId);
  ensureDir(dir);
  ensureDir(path.join(dir, "templates"));
}

export function readUserJson<T>(userId: string, file: string, fallback: T): T {
  ensureUserWorkspace(userId);
  const filepath = path.join(userDir(userId), file);
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, "utf-8")) as T;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeUserJson<T>(userId: string, file: string, data: T) {
  ensureUserWorkspace(userId);
  fs.writeFileSync(
    path.join(userDir(userId), file),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

export function readUserMailSettings(userId: string): MailSettings | null {
  return readUserJson<MailSettings | null>(userId, "mail.json", null);
}

export function writeUserMailSettings(userId: string, settings: MailSettings) {
  writeUserJson(userId, "mail.json", settings);
}

export function readUserCallLogState(userId: string): CallLogState {
  return readUserJson<CallLogState>(userId, "call_log.json", {});
}

export function writeUserCallLogState(userId: string, state: CallLogState) {
  writeUserJson(userId, "call_log.json", state);
}

export function readUserEmailLogs(userId: string): EmailLogEntry[] {
  return readUserJson<EmailLogEntry[]>(userId, "email_logs.json", []);
}

export function writeUserEmailLogs(userId: string, logs: EmailLogEntry[]) {
  writeUserJson(userId, "email_logs.json", logs);
}

export function readUserCallAudit(userId: string): CallLogEntry[] {
  return readUserJson<CallLogEntry[]>(userId, "call_audit.json", []);
}

export function writeUserCallAudit(userId: string, logs: CallLogEntry[]) {
  writeUserJson(userId, "call_audit.json", logs);
}

export function userTemplatePath(userId: string, templateId: string) {
  return path.join(userDir(userId), "templates", `${templateId}.json`);
}

export function globalTemplatePath(templateId: string) {
  return path.join(DATA_DIR, "templates", `${templateId}.json`);
}
