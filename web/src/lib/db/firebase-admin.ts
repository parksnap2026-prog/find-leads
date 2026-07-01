import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { isFirebaseReady } from "./index";

let app: App | undefined;
let db: Firestore | undefined;

function parsePrivateKey(raw?: string): string {
  if (!raw) return "";
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

export function getFirebaseAdminApp(): App {
  if (!isFirebaseReady()) {
    throw new Error("Firebase env vars are not configured");
  }

  if (!app) {
    const existing = getApps()[0];
    if (existing) {
      app = existing;
    } else {
      const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
      if (!privateKey.includes("BEGIN PRIVATE KEY")) {
        throw new Error("FIREBASE_PRIVATE_KEY is missing or malformed");
      }
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey,
        }),
      });
    }
  }

  return app;
}

export async function pingFirebase(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getFirebaseDb().collection("_health").doc("ping").set(
      { at: new Date().toISOString() },
      { merge: true },
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Firestore ping failed" };
  }
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseAdminApp());
  }
  return db;
}
