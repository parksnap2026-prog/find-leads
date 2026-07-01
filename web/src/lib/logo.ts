import fs from "fs";
import path from "path";
import { getStorageProvider, isFirebaseReady } from "@/lib/db";
import {
  deleteUserFile,
  readUserFile,
  saveUserFile,
  userFileExists,
} from "@/lib/db/firebase-storage";
import { ensureUserWorkspace } from "@/lib/db/local";

const LOGO_NAMES = ["logo.png", "logo.jpg", "logo.jpeg", "logo.webp"];

function useFirebaseStore(): boolean {
  return getStorageProvider() === "firebase" && isFirebaseReady();
}

function userDir(userId: string) {
  if (!useFirebaseStore()) ensureUserWorkspace(userId);
  return path.join(process.cwd(), "data", "users", userId);
}

function logoExtForMime(mime: string) {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  return ".png";
}

function logoSubpathForMime(mime: string) {
  return `logo${logoExtForMime(mime)}`;
}

export function logoMimeType(filepath: string) {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

export function findUserLogoPath(userId: string): string | null {
  if (useFirebaseStore()) return null;
  const dir = userDir(userId);
  for (const name of LOGO_NAMES) {
    const filepath = path.join(dir, name);
    if (fs.existsSync(filepath)) return filepath;
  }
  return null;
}

export async function userHasLogo(userId: string) {
  if (useFirebaseStore()) {
    for (const name of LOGO_NAMES) {
      if (await userFileExists(userId, name)) return true;
    }
    return false;
  }
  return Boolean(findUserLogoPath(userId));
}

export async function readUserLogoDataUrl(userId: string): Promise<string | null> {
  const data = await readUserLogoBuffer(userId);
  if (!data) return null;
  return `data:${data.mime};base64,${data.buffer.toString("base64")}`;
}

export async function readUserLogoBuffer(userId: string): Promise<{
  buffer: Buffer;
  mime: string;
  filepath: string;
} | null> {
  if (useFirebaseStore()) {
    for (const name of LOGO_NAMES) {
      const buffer = await readUserFile(userId, name);
      if (buffer) {
        return { buffer, mime: logoMimeType(name), filepath: name };
      }
    }
    return null;
  }

  const filepath = findUserLogoPath(userId);
  if (!filepath) return null;
  return {
    filepath,
    mime: logoMimeType(filepath),
    buffer: fs.readFileSync(filepath),
  };
}

export async function saveUserLogo(userId: string, buffer: Buffer, mime: string) {
  if (useFirebaseStore()) {
    for (const name of LOGO_NAMES) {
      await deleteUserFile(userId, name);
    }
    const subpath = logoSubpathForMime(mime);
    await saveUserFile(userId, subpath, buffer, mime);
    return subpath;
  }

  const dir = userDir(userId);
  for (const name of LOGO_NAMES) {
    const old = path.join(dir, name);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  const ext = logoExtForMime(mime);
  const filepath = path.join(dir, `logo${ext}`);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

export async function deleteUserLogo(userId: string) {
  if (useFirebaseStore()) {
    await Promise.all(LOGO_NAMES.map((name) => deleteUserFile(userId, name)));
    return;
  }

  const dir = userDir(userId);
  for (const name of LOGO_NAMES) {
    const filepath = path.join(dir, name);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
}

export function logoFileVersion(userId: string): number | null {
  const filepath = findUserLogoPath(userId);
  if (!filepath) return null;
  try {
    return fs.statSync(filepath).mtimeMs;
  } catch {
    return null;
  }
}
