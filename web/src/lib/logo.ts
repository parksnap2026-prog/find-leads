import fs from "fs";
import path from "path";
import { ensureUserWorkspace } from "@/lib/db/local";

const LOGO_NAMES = ["logo.png", "logo.jpg", "logo.jpeg", "logo.webp"];

function userDir(userId: string) {
  ensureUserWorkspace(userId);
  return path.join(process.cwd(), "data", "users", userId);
}

export function findUserLogoPath(userId: string): string | null {
  const dir = userDir(userId);
  for (const name of LOGO_NAMES) {
    const filepath = path.join(dir, name);
    if (fs.existsSync(filepath)) return filepath;
  }
  return null;
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

export function userHasLogo(userId: string) {
  return Boolean(findUserLogoPath(userId));
}

export function logoMimeType(filepath: string) {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

export function readUserLogoDataUrl(userId: string): string | null {
  const filepath = findUserLogoPath(userId);
  if (!filepath) return null;
  const buffer = fs.readFileSync(filepath);
  return `data:${logoMimeType(filepath)};base64,${buffer.toString("base64")}`;
}

export function readUserLogoBuffer(userId: string): {
  buffer: Buffer;
  mime: string;
  filepath: string;
} | null {
  const filepath = findUserLogoPath(userId);
  if (!filepath) return null;
  return {
    filepath,
    mime: logoMimeType(filepath),
    buffer: fs.readFileSync(filepath),
  };
}

export function saveUserLogo(userId: string, buffer: Buffer, mime: string) {
  const dir = userDir(userId);
  for (const name of LOGO_NAMES) {
    const old = path.join(dir, name);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  const ext =
    mime === "image/jpeg" ? ".jpg" : mime === "image/webp" ? ".webp" : ".png";
  const filepath = path.join(dir, `logo${ext}`);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

export function deleteUserLogo(userId: string) {
  const dir = userDir(userId);
  for (const name of LOGO_NAMES) {
    const filepath = path.join(dir, name);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
}

export function syncListingLogoToEmailLogo(userId: string, listingLogoFilename: string) {
  const listingPath = path.join(
    process.cwd(),
    "data",
    "users",
    userId,
    "listing",
    listingLogoFilename,
  );
  if (!fs.existsSync(listingPath)) return;
  const buffer = fs.readFileSync(listingPath);
  saveUserLogo(userId, buffer, logoMimeType(listingPath));
}
