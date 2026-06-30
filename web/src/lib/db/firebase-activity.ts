import type { CallLogEntry, CallLogState, EmailLogEntry } from "./types";
import type { HistoryEntry } from "@/types";
import { getFirebaseDb } from "./firebase-admin";

const HISTORY_LIMIT = 100;
const CALL_AUDIT_LIMIT = 500;
const EMAIL_LOG_LIMIT = 500;

function userRoot(userId: string) {
  return getFirebaseDb().collection("users").doc(userId);
}

export async function readSearchHistory(userId: string): Promise<HistoryEntry[]> {
  const snap = await userRoot(userId)
    .collection("searchHistory")
    .orderBy("savedAt", "desc")
    .limit(HISTORY_LIMIT)
    .get();

  return snap.docs.map((doc) => doc.data() as HistoryEntry);
}

export async function appendSearchHistory(
  userId: string,
  entry: HistoryEntry,
): Promise<HistoryEntry> {
  await userRoot(userId).collection("searchHistory").doc(entry.id).set(entry);

  const snap = await userRoot(userId)
    .collection("searchHistory")
    .orderBy("savedAt", "desc")
    .offset(HISTORY_LIMIT)
    .get();

  if (snap.docs.length) {
    const batch = getFirebaseDb().batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
  }

  return entry;
}

export async function readCallLogState(userId: string): Promise<CallLogState> {
  const doc = await userRoot(userId).collection("prefs").doc("callLog").get();
  if (!doc.exists) return {};
  const data = doc.data() as { state?: CallLogState };
  return data.state ?? {};
}

export async function writeCallLogState(userId: string, state: CallLogState): Promise<void> {
  await userRoot(userId).collection("prefs").doc("callLog").set({ state });
}

export async function readCallAudit(userId: string): Promise<CallLogEntry[]> {
  const snap = await userRoot(userId)
    .collection("callActivity")
    .orderBy("calledAt", "desc")
    .limit(CALL_AUDIT_LIMIT)
    .get();

  return snap.docs.map((doc) => doc.data() as CallLogEntry);
}

export async function prependCallAudit(userId: string, entry: CallLogEntry): Promise<void> {
  await userRoot(userId).collection("callActivity").doc(entry.id).set(entry);

  const snap = await userRoot(userId)
    .collection("callActivity")
    .orderBy("calledAt", "desc")
    .offset(CALL_AUDIT_LIMIT)
    .get();

  if (snap.docs.length) {
    const batch = getFirebaseDb().batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
  }
}

export async function deleteCallAuditEntry(userId: string, entryId: string): Promise<void> {
  await userRoot(userId).collection("callActivity").doc(entryId).delete();
}

export async function readEmailLogs(userId: string): Promise<EmailLogEntry[]> {
  const snap = await userRoot(userId)
    .collection("emailLogs")
    .orderBy("sentAt", "desc")
    .limit(EMAIL_LOG_LIMIT)
    .get();

  return snap.docs.map((doc) => doc.data() as EmailLogEntry);
}

export async function prependEmailLogs(userId: string, entries: EmailLogEntry[]): Promise<void> {
  if (!entries.length) return;

  const batch = getFirebaseDb().batch();
  for (const entry of entries) {
    batch.set(userRoot(userId).collection("emailLogs").doc(entry.id), entry);
  }
  await batch.commit();

  const snap = await userRoot(userId)
    .collection("emailLogs")
    .orderBy("sentAt", "desc")
    .offset(EMAIL_LOG_LIMIT)
    .get();

  if (snap.docs.length) {
    const trimBatch = getFirebaseDb().batch();
    for (const doc of snap.docs) trimBatch.delete(doc.ref);
    await trimBatch.commit();
  }
}

export async function deleteEmailLogEntry(userId: string, entryId: string): Promise<void> {
  await userRoot(userId).collection("emailLogs").doc(entryId).delete();
}
