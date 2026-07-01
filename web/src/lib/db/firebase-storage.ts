import { getStorage } from "firebase-admin/storage";
import { getFirebaseAdminApp } from "./firebase-admin";

export function getStorageBucket() {
  const storage = getStorage(getFirebaseAdminApp());
  const name = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  return name ? storage.bucket(name) : storage.bucket();
}

function objectPath(userId: string, subpath: string) {
  return `users/${userId}/${subpath.replace(/^\/+/, "")}`;
}

export async function saveUserFile(
  userId: string,
  subpath: string,
  buffer: Buffer,
  contentType: string,
) {
  const file = getStorageBucket().file(objectPath(userId, subpath));
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: { cacheControl: "public, max-age=3600" },
  });
}

export async function readUserFile(userId: string, subpath: string): Promise<Buffer | null> {
  const file = getStorageBucket().file(objectPath(userId, subpath));
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buffer] = await file.download();
  return buffer;
}

export async function deleteUserFile(userId: string, subpath: string) {
  const file = getStorageBucket().file(objectPath(userId, subpath));
  const [exists] = await file.exists();
  if (exists) await file.delete();
}

export async function userFileExists(userId: string, subpath: string): Promise<boolean> {
  const file = getStorageBucket().file(objectPath(userId, subpath));
  const [exists] = await file.exists();
  return exists;
}
