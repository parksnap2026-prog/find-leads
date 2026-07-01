import type { MailSettings } from "./types";
import { getFirebaseDb } from "./firebase-admin";

export async function readMailSettings(userId: string): Promise<MailSettings | null> {
  const doc = await getFirebaseDb().collection("users").doc(userId).collection("prefs").doc("mail").get();
  if (!doc.exists) return null;
  return doc.data() as MailSettings;
}

export async function writeMailSettings(userId: string, settings: MailSettings): Promise<void> {
  await getFirebaseDb().collection("users").doc(userId).collection("prefs").doc("mail").set(settings);
}
