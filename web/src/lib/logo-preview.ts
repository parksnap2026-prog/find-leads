/** Client-safe logo preview helpers (no Node.js fs). */

const LOGO_CID_RE = /cid:logo_(?:webpower|mbl)/gi;

export function logoPreviewUrl(_origin?: string, version?: number | null) {
  const v = version ?? Date.now();
  return `/api/logo/file?v=${v}`;
}

export function injectLogoForPreview(html: string, logoSrc: string | null) {
  if (!logoSrc) return html;
  return html.replace(LOGO_CID_RE, logoSrc);
}

export function logoCidsInHtml(html: string): string[] {
  const cids = new Set<string>();
  if (/cid:logo_webpower/i.test(html)) cids.add("logo_webpower");
  if (/cid:logo_mbl/i.test(html)) cids.add("logo_mbl");
  if (!cids.size) cids.add("logo_webpower");
  return [...cids];
}

/** Load the logged-in user's email logo as a data: URL (works in preview iframes). */
export async function fetchEmailLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/api/logo/data");
    if (!res.ok) return null;
    const data = (await res.json()) as { hasLogo?: boolean; dataUrl?: string };
    return data.hasLogo && data.dataUrl ? data.dataUrl : null;
  } catch {
    return null;
  }
}
