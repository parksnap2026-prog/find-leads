import type { MailSettings } from "./types";
import { getStorageProvider, isFirebaseReady } from "./index";
import { readUserMailSettings, writeUserMailSettings } from "./local";
import * as firebasePrefs from "./firebase-prefs";

function useFirebasePrefs(): boolean {
  return getStorageProvider() === "firebase" && isFirebaseReady();
}

export async function getMailSettings(userId: string): Promise<MailSettings | null> {
  if (useFirebasePrefs()) {
    return firebasePrefs.readMailSettings(userId);
  }
  return readUserMailSettings(userId);
}

export async function saveMailSettings(userId: string, settings: MailSettings): Promise<void> {
  if (useFirebasePrefs()) {
    await firebasePrefs.writeMailSettings(userId, settings);
    return;
  }
  writeUserMailSettings(userId, settings);
}
