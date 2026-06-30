import type { BusinessResult } from "@/types";

export function formatWebLink(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

export function storePageUrl(biz: BusinessResult, origin = "") {
  if (!biz.isListing || !biz.storeUrl) return "";
  const path = biz.storeUrl.split("?")[0];
  return origin ? `${origin}${path}` : path;
}

/** Single link field for CSV — website first, then store page. */
export function leadLinkForExport(biz: BusinessResult, origin: string) {
  const parts: string[] = [];
  if (biz.website) parts.push(biz.website);
  const store = storePageUrl(biz, origin);
  if (store && !parts.includes(store)) parts.push(store);
  return parts.join(" | ");
}
