import { NextResponse } from "next/server";
import { getStorageProvider, isFirebaseReady } from "@/lib/db";
import { getFirebaseStatus } from "@/lib/db/firebase";

export async function GET() {
  return NextResponse.json({
    app: "find-leads",
    storage: getStorageProvider(),
    firebase: getFirebaseStatus(),
    vercel: Boolean(process.env.VERCEL),
    ready: {
      auth: Boolean(process.env.AUTH_SECRET),
      appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      localStorage: getStorageProvider() === "local",
      firebaseConfigured: isFirebaseReady(),
    },
  });
}
