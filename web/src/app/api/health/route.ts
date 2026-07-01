import { NextResponse } from "next/server";
import { getStorageProvider, isFirebaseReady } from "@/lib/db";
import { pingFirebase } from "@/lib/db/firebase-admin";
import { getFirebaseStatus } from "@/lib/db/firebase";
import { activityStorageBackend } from "@/lib/db/user-activity";
import { usersStorageBackend } from "@/lib/db/user-store";

export async function GET() {
  const firebasePing = isFirebaseReady() ? await pingFirebase() : { ok: false, error: "not configured" };

  return NextResponse.json({
    app: "find-leads",
    storage: getStorageProvider(),
    firebase: getFirebaseStatus(),
    activity: activityStorageBackend(),
    users: usersStorageBackend(),
    firestore: firebasePing,
    vercel: Boolean(process.env.VERCEL),
    ready: {
      auth: Boolean(process.env.AUTH_SECRET),
      appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      firebaseConfigured: isFirebaseReady(),
      firebaseActivity: activityStorageBackend() === "firebase",
      firebaseUsers: usersStorageBackend() === "firebase",
      firestoreReachable: firebasePing.ok,
    },
  });
}
