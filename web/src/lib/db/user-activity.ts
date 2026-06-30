/**
 * Hybrid user activity storage.
 * Search history, call activity, and email send logs use Firestore when
 * STORAGE_PROVIDER=firebase and Firebase admin env vars are set.
 * Otherwise they use local JSON files under data/users/{id}/.
 */
import type { CallLogEntry, CallLogState, EmailLogEntry } from "./types";
import type { HistoryEntry } from "@/types";
import { getStorageProvider, isFirebaseReady } from "./index";
import {
  readUserCallAudit,
  readUserCallLogState,
  readUserEmailLogs,
  readUserJson,
  writeUserCallAudit,
  writeUserCallLogState,
  writeUserEmailLogs,
  writeUserJson,
} from "./local";
import * as firebaseActivity from "./firebase-activity";

function useFirebaseActivity(): boolean {
  return getStorageProvider() === "firebase" && isFirebaseReady();
}

export async function readSearchHistory(userId: string): Promise<HistoryEntry[]> {
  if (useFirebaseActivity()) {
    return firebaseActivity.readSearchHistory(userId);
  }
  return readUserJson<HistoryEntry[]>(userId, "history.json", []);
}

export async function appendSearchHistory(
  userId: string,
  entry: HistoryEntry,
): Promise<HistoryEntry> {
  if (useFirebaseActivity()) {
    return firebaseActivity.appendSearchHistory(userId, entry);
  }

  const history = readUserJson<HistoryEntry[]>(userId, "history.json", []);
  history.unshift(entry);
  writeUserJson(userId, "history.json", history.slice(0, 100));
  return entry;
}

export async function readCallLogState(userId: string): Promise<CallLogState> {
  if (useFirebaseActivity()) {
    return firebaseActivity.readCallLogState(userId);
  }
  return readUserCallLogState(userId);
}

export async function writeCallLogState(userId: string, state: CallLogState): Promise<void> {
  if (useFirebaseActivity()) {
    await firebaseActivity.writeCallLogState(userId, state);
    return;
  }
  writeUserCallLogState(userId, state);
}

export async function readCallAudit(userId: string): Promise<CallLogEntry[]> {
  if (useFirebaseActivity()) {
    return firebaseActivity.readCallAudit(userId);
  }
  return readUserCallAudit(userId);
}

export async function prependCallAudit(userId: string, entry: CallLogEntry): Promise<void> {
  if (useFirebaseActivity()) {
    await firebaseActivity.prependCallAudit(userId, entry);
    return;
  }

  const audit = readUserCallAudit(userId);
  audit.unshift(entry);
  writeUserCallAudit(userId, audit.slice(0, 500));
}

export async function deleteCallAuditEntry(userId: string, entryId: string): Promise<void> {
  if (useFirebaseActivity()) {
    await firebaseActivity.deleteCallAuditEntry(userId, entryId);
    return;
  }

  const logs = readUserCallAudit(userId).filter((l) => l.id !== entryId);
  writeUserCallAudit(userId, logs);
}

export async function readEmailLogs(userId: string): Promise<EmailLogEntry[]> {
  if (useFirebaseActivity()) {
    return firebaseActivity.readEmailLogs(userId);
  }
  return readUserEmailLogs(userId);
}

export async function prependEmailLogs(userId: string, entries: EmailLogEntry[]): Promise<void> {
  if (useFirebaseActivity()) {
    await firebaseActivity.prependEmailLogs(userId, entries);
    return;
  }

  const logs = readUserEmailLogs(userId);
  logs.unshift(...entries);
  writeUserEmailLogs(userId, logs.slice(0, 500));
}

export async function deleteEmailLogEntry(userId: string, entryId: string): Promise<void> {
  if (useFirebaseActivity()) {
    await firebaseActivity.deleteEmailLogEntry(userId, entryId);
    return;
  }

  const logs = readUserEmailLogs(userId).filter((l) => l.id !== entryId);
  writeUserEmailLogs(userId, logs);
}

export function activityStorageBackend(): "firebase" | "local" {
  return useFirebaseActivity() ? "firebase" : "local";
}
