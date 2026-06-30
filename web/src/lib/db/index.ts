/**
 * Storage provider abstraction.
 * Set STORAGE_PROVIDER=firebase when Firebase env vars are ready.
 * Default: local file storage under data/
 */
export type StorageProvider = "local" | "firebase";

export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  return provider === "firebase" ? "firebase" : "local";
}

export function isFirebaseReady(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}
