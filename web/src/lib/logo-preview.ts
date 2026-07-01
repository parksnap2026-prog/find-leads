/** Client-safe logo preview helpers (no Node.js fs). */

const LOGO_CID_RE = /cid:logo_(?:webpower|mbl)/gi;

/** Static logo shipped with the app (public/email-logo.png). */
export const STATIC_EMAIL_LOGO_URL = "/email-logo.png";

export function logoPreviewUrl(_origin?: string, _version?: number | null) {
  return STATIC_EMAIL_LOGO_URL;
}

export function injectLogoForPreview(html: string, logoSrc: string | null) {
  const src = logoSrc || STATIC_EMAIL_LOGO_URL;
  return html.replace(LOGO_CID_RE, src);
}

export function logoCidsInHtml(html: string): string[] {
  const cids = new Set<string>();
  if (/cid:logo_webpower/i.test(html)) cids.add("logo_webpower");
  if (/cid:logo_mbl/i.test(html)) cids.add("logo_mbl");
  if (!cids.size) cids.add("logo_webpower");
  return [...cids];
}

export async function fetchEmailLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/api/logo/data");
    if (!res.ok) return STATIC_EMAIL_LOGO_URL;
    const data = (await res.json()) as { hasLogo?: boolean; dataUrl?: string };
    return data.hasLogo && data.dataUrl ? data.dataUrl : STATIC_EMAIL_LOGO_URL;
  } catch {
    return STATIC_EMAIL_LOGO_URL;
  }
}
