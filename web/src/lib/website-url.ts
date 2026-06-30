const SCRAPE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Directories, maps, and meta sites — not a business's own website. */
const BLOCKED_HOSTS = new Set([
  "openstreetmap.org",
  "wiki.openstreetmap.org",
  "nominatim.openstreetmap.org",
  "wikipedia.org",
  "wikidata.org",
  "wikimedia.org",
  "google.com",
  "maps.google.com",
  "goo.gl",
  "g.page",
  "business.google.com",
  "duckduckgo.com",
  "bing.com",
  "tripadvisor.com",
  "tripadvisor.co.uk",
  "yelp.com",
  "yell.com",
  "opentable.com",
  "thefork.com",
  "zomato.com",
  "booking.com",
  "expedia.com",
  "airbnb.com",
  "foursquare.com",
  "trustpilot.com",
  "checkatrade.com",
  "yellowpages.com",
  "whitepages.com",
  "mapquest.com",
  "chamberofcommerce.com",
  "manta.com",
  "bbb.org",
  "happycow.net",
  "restaurantguru.com",
  "just-eat.co.uk",
  "justeat.co.uk",
  "deliveroo.co.uk",
  "ubereats.com",
  "doordash.com",
  "grubhub.com",
  "menupix.com",
  "allmenus.com",
]);

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isBlockedBusinessWebsite(url: string): boolean {
  const host = hostOf(url);
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (isSocialMediaUrl(url)) return true;
  for (const blocked of BLOCKED_HOSTS) {
    if (host === blocked || host.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

const SOCIAL_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "tiktok.com",
  "youtube.com",
];

export function isSocialMediaUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return SOCIAL_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
}

export function socialPlatformLabel(url: string): string {
  const host = hostOf(url);
  if (host.includes("facebook") || host === "fb.com") return "Facebook";
  if (host.includes("instagram")) return "Instagram";
  if (host.includes("twitter") || host === "x.com") return "X";
  if (host.includes("linkedin")) return "LinkedIn";
  if (host.includes("tiktok")) return "TikTok";
  if (host.includes("youtube")) return "YouTube";
  return "Social";
}

export function normalizeWebsiteUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  if (/^(mailto:|tel:|javascript:|#)/i.test(s)) return "";

  s = s.replace(/\s+/g, "");
  if (s.startsWith("//")) s = `https:${s}`;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;

  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (!u.hostname.includes(".")) return "";
    return u.href;
  } catch {
    return "";
  }
}

function splitUrlList(raw: string): string[] {
  return raw
    .split(/[;|,]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function socialUrlFromTag(key: string, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  if (key.includes("facebook") || key === "facebook") {
    return handle.includes("facebook.com") ? `https://${handle.replace(/^https?:\/\//, "")}` : `https://facebook.com/${handle}`;
  }
  if (key.includes("instagram") || key === "instagram") {
    return handle.includes("instagram.com") ? `https://${handle.replace(/^https?:\/\//, "")}` : `https://instagram.com/${handle}`;
  }
  if (key.includes("twitter") || key === "twitter") {
    return handle.includes("twitter.com") || handle.includes("x.com")
      ? `https://${handle.replace(/^https?:\/\//, "")}`
      : `https://twitter.com/${handle}`;
  }
  return null;
}

function pickFirstValid(candidates: string[]): string {
  for (const raw of candidates) {
    const normalized = normalizeWebsiteUrl(raw);
    if (normalized && !isBlockedBusinessWebsite(normalized)) return normalized;
  }
  return "";
}

function pickFirstSocial(candidates: string[]): string {
  for (const raw of candidates) {
    const normalized = normalizeWebsiteUrl(raw);
    if (normalized && isSocialMediaUrl(normalized)) return normalized;
  }
  return "";
}

/** Facebook, Instagram, etc. — kept separate from the website column. */
export function extractSocialFromOsmTags(tags: Record<string, string>): string {
  const social: string[] = [];
  for (const key of [
    "contact:facebook",
    "facebook",
    "contact:instagram",
    "instagram",
    "contact:twitter",
    "twitter",
    "contact:linkedin",
    "linkedin",
    "contact:tiktok",
    "tiktok",
    "contact:youtube",
    "youtube",
  ]) {
    const val = tags[key];
    if (!val) continue;
    for (const part of splitUrlList(val)) {
      const built = socialUrlFromTag(key, part);
      if (built) social.push(built);
    }
  }
  return pickFirstSocial(social);
}

/** OSM website tags — official site only (not social media). */
export function extractWebsiteFromOsmTags(tags: Record<string, string>): string {
  const primary: string[] = [];
  for (const key of ["website", "contact:website"]) {
    const val = tags[key];
    if (val) primary.push(...splitUrlList(val));
  }
  for (const [key, val] of Object.entries(tags)) {
    if (key.startsWith("website:") && val) primary.push(...splitUrlList(val));
  }
  const fromPrimary = pickFirstValid(primary);
  if (fromPrimary) return fromPrimary;

  const fallback: string[] = [];
  if (tags.url) fallback.push(...splitUrlList(tags.url));
  if (tags["contact:url"]) fallback.push(...splitUrlList(tags["contact:url"]));
  return pickFirstValid(fallback);
}

export function splitWebsiteAndSocial(website: string, social: string) {
  let site = sanitizeBusinessWebsite(website);
  let socialUrl = social.trim() ? normalizeWebsiteUrl(social) : "";

  if (site && isSocialMediaUrl(site)) {
    if (!socialUrl) socialUrl = site;
    site = "";
  }
  if (socialUrl && !isSocialMediaUrl(socialUrl)) socialUrl = "";

  return { website: site, social: socialUrl };
}

export function sanitizeBusinessWebsite(url: string): string {
  const normalized = normalizeWebsiteUrl(url);
  if (!normalized || isBlockedBusinessWebsite(normalized)) return "";
  return normalized;
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: SCRAPE_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  return { html: await res.text(), finalUrl: res.url };
}

function titleMatches(html: string, mustWords: string[]): boolean {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "";
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? "";
  const text = `${title} ${og}`.toLowerCase();
  return mustWords.every((w) => text.includes(w.toLowerCase()));
}

/** Try common domain patterns and verify page title matches the business name. */
export async function guessWebsiteUrl(name: string, city = ""): Promise<string> {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";

  const variants: string[] = [];
  if (words.length >= 2) variants.push(words.slice(0, 2).join(" "));
  if (words.length >= 3) variants.push(words.slice(0, 3).join(" "));
  if (words.length === 1) variants.push(name);

  const mustWords = words.slice(0, 2).filter((w) => w.length > 2).map((w) => w.toLowerCase());
  if (words.length === 1 && city) mustWords.push(city.toLowerCase());

  for (const variant of variants) {
    const slug = variant.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const plain = slug.replace(/-/g, "");
    const candidates = [
      `https://www.${slug}.com`,
      `https://${slug}.com`,
      `https://www.${plain}.com`,
      `https://www.${slug}.co.uk`,
      `https://www.${slug}.net`,
      `https://www.${slug}.mk`,
      `https://www.${slug}.de`,
    ];

    const hits: string[] = [];
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: "HEAD",
          headers: SCRAPE_HEADERS,
          redirect: "follow",
          signal: AbortSignal.timeout(5000),
        });
        if (res.status < 404) hits.push(res.url.replace(/\/$/, ""));
      } catch {
        /* try next */
      }
    }

    const nameWords = variant.split(/\s+/).filter((w) => w.length > 2).map((w) => w.toLowerCase());

    for (const final of hits) {
      if (isBlockedBusinessWebsite(final) || isSocialMediaUrl(final)) continue;
      try {
        const hostSlug = hostOf(final).split(".")[0].replace(/[^a-z0-9]/g, "");
        const nameSlug = variant.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, "");

        const { html } = await fetchHtml(final);
        if (hostSlug === nameSlug) {
          if (nameWords.every((w) => html.toLowerCase().includes(w))) return final;
          continue;
        }
        if (titleMatches(html, mustWords)) return final;
      } catch {
        /* try next hit */
      }
    }
  }

  return "";
}

export async function guessWebsitesForBusinesses(
  items: { id: string; name: string; city?: string }[],
  concurrency = 4,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const queue = [...items];

  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      const url = await guessWebsiteUrl(item.name, item.city ?? "");
      if (url) out[item.id] = url;
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return out;
}

/** @deprecated use normalizeWebsiteUrl */
export const normalizeWebsite = normalizeWebsiteUrl;
