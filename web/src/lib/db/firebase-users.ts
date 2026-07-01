import type { UserRecord } from "./types";
import { getFirebaseDb } from "./firebase-admin";

const ACCOUNTS = "accounts";

export async function findUserByEmail(email: string): Promise<UserRecord | undefined> {
  const normalized = email.toLowerCase().trim();
  const snap = await getFirebaseDb()
    .collection(ACCOUNTS)
    .where("email", "==", normalized)
    .limit(1)
    .get();

  if (snap.empty) return undefined;
  return snap.docs[0].data() as UserRecord;
}

export async function findUserById(id: string): Promise<UserRecord | undefined> {
  const doc = await getFirebaseDb().collection(ACCOUNTS).doc(id).get();
  if (!doc.exists) return undefined;
  return doc.data() as UserRecord;
}

export async function saveUser(user: UserRecord): Promise<void> {
  await getFirebaseDb().collection(ACCOUNTS).doc(user.id).set(user);
}
