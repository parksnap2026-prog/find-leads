import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { isFirebaseReady } from "./index";

let app: App | undefined;
let db: Firestore | undefined;

export function getFirebaseAdminApp(): App {
  if (!isFirebaseReady()) {
    throw new Error("Firebase env vars are not configured");
  }

  if (!app) {
    const existing = getApps()[0];
    if (existing) {
      app = existing;
    } else {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey: privateKey!,
        }),
      });
    }
  }

  return app;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseAdminApp());
  }
  return db;
}
