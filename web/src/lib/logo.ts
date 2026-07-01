import fs from "fs";
import path from "path";

/** Single app-wide email logo (committed in git at public/email-logo.png). */
const STATIC_LOGO = path.join(process.cwd(), "public", "email-logo.png");

export function staticLogoPath(): string {
  return STATIC_LOGO;
}

export function userHasLogo(_userId?: string): boolean {
  return fs.existsSync(STATIC_LOGO);
}

export async function readUserLogoDataUrl(_userId?: string): Promise<string | null> {
  const data = await readUserLogoBuffer();
  if (!data) return null;
  return `data:${data.mime};base64,${data.buffer.toString("base64")}`;
}

export async function readUserLogoBuffer(_userId?: string): Promise<{
  buffer: Buffer;
  mime: string;
  filepath: string;
} | null> {
  if (!fs.existsSync(STATIC_LOGO)) return null;
  return {
    filepath: STATIC_LOGO,
    mime: "image/png",
    buffer: fs.readFileSync(STATIC_LOGO),
  };
}

/** Logo is static in the repo — uploads are ignored. */
export async function saveUserLogo(_userId: string, _buffer: Buffer, _mime: string) {
  return STATIC_LOGO;
}

/** Logo is static in the repo — cannot be removed at runtime. */
export async function deleteUserLogo(_userId: string) {
  /* no-op */
}

export function logoFileVersion(_userId?: string): number | null {
  if (!fs.existsSync(STATIC_LOGO)) return null;
  try {
    return fs.statSync(STATIC_LOGO).mtimeMs;
  } catch {
    return null;
  }
}

export function logoMimeType(filepath: string) {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}
