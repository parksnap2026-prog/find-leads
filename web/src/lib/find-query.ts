import { FETCH_HEADERS } from "./constants";
import { scrapeWebsite } from "./scrape";
import {
  guessWebsiteUrl,
  isSocialMediaUrl,
  sanitizeBusinessWebsite,
} from "./website-url";

const SCRAPE_HEADERS = {
  ...FETCH_HEADERS,
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const SKIP_HOSTS = new Set([
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "tripadvisor.com",
  "tripadvisor.co.uk",
  "yelp.com",
  "yell.com",
  "google.com",
  "maps.google.com",
  "duckduckgo.com",
  "wikipedia.org",
  "wikidata.org",
  "openstreetmap.org",
  "booking.com",
  "opentable.com",
  "thefork.com",
  "zomato.com",
]);

const SOCIAL_HOSTS = ["facebook.com", "fb.com", "instagram.com", "twitter.com", "x.com"];

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSkippedHost(url: string) {
  const host = hostOf(url);
  for (const s of SKIP_HOSTS) {
    if (host === s || host.endsWith(`.${s}`)) return true;
  }
  return false;
}

function isSocialHost(url: string) {
  const host = hostOf(url);
  return SOCIAL_HOSTS.some((s) => host === s || host.endsWith(`.${s}`));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function duckDuckGoUrls(query: string, preferSocial = false): Promise<string[]> {
  await sleep(400 + Math.random() * 600);
  try {
    const res = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: {
        ...SCRAPE_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: "https://lite.duckduckgo.com/lite/",
      },
      body: new URLSearchParams({ q: query }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok || res.headers.get("content-length") === "0") return [];
    const html = await res.text();
    if (html.length < 2000) return [];

    const firstWord = query.split(/\s+/)[0]?.replace(/\W/g, "").toLowerCase() ?? "";
    const candidates: { score: number; url: string }[] = [];

    for (const m of html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"/gi)) {
      const url = m[1].split("?")[0].replace(/\/$/, "");
      const host = hostOf(url);
      if (!host) continue;

      if (preferSocial) {
        if (!isSocialHost(url)) continue;
      } else if (isSkippedHost(url)) {
        continue;
      }

      const hostCompact = host.replace(/[-.]/g, "");
      const score = firstWord && hostCompact.includes(firstWord) ? 2 : 1;
      candidates.push({ score, url });
      if (candidates.length >= 12) break;
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.map((c) => c.url);
  } catch {
    return [];
  }
}

function cityHintFromQuery(query: string) {
  const skip = new Set([
    "road", "street", "avenue", "lane", "drive", "united", "kingdom", "states",
    "north", "south", "east", "west", "church", "park", "hill", "close", "place",
  ]);
  const parts = query.split(",").map((p) => p.trim());
  for (const p of parts.slice(1)) {
    for (const w of p.split(/\s+/)) {
      if (w.length > 3 && /^[a-zA-Z]+$/.test(w) && !skip.has(w.toLowerCase())) {
        return w;
      }
    }
  }
  return "";
}

export async function findWebsiteByQuery(query: string, googleApiKey?: string) {
  const parts = query.split(",").map((p) => p.trim()).filter(Boolean);
  const bizName = parts[0] ?? query;
  const cityHint = cityHintFromQuery(query);

  let website = "";
  let phone = "";
  let nameHint = "";

  if (googleApiKey) {
    try {
      const params = new URLSearchParams({
        input: query,
        inputtype: "textquery",
        fields: "name,formatted_address,website,formatted_phone_number,international_phone_number",
        key: googleApiKey,
      });
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`,
        { headers: FETCH_HEADERS, signal: AbortSignal.timeout(10000) },
      );
      const data = (await res.json()) as {
        candidates?: {
          name?: string;
          website?: string;
          formatted_phone_number?: string;
          international_phone_number?: string;
        }[];
      };
      const p = data.candidates?.[0];
      if (p?.website) {
        website = sanitizeBusinessWebsite(p.website);
        nameHint = p.name ?? "";
        phone = p.formatted_phone_number || p.international_phone_number || "";
      }
    } catch {
      /* continue */
    }
  }

  if (!website) {
    website = sanitizeBusinessWebsite(await guessWebsiteUrl(bizName, cityHint));
  }

  if (!website) {
    const ddg = await duckDuckGoUrls(query, false);
    website = sanitizeBusinessWebsite(ddg[0] ?? "");
  }

  if (!website) {
    return { ok: false as const, error: `No website found for "${bizName}"` };
  }

  const scraped = await scrapeWebsite(website);
  return {
    ok: true as const,
    website,
    name: nameHint || scraped.name || bizName,
    phone: phone || scraped.phones[0] || "",
    email: scraped.emails[0] || "",
    scraped,
  };
}

export async function findSocialByQuery(name: string, city: string, country = "") {
  const queries = [
    `${name} ${city} ${country} facebook`.trim(),
    `${name} ${city} instagram`.trim(),
    `${name} facebook ${city}`.trim(),
  ];

  for (const q of queries) {
    const urls = await duckDuckGoUrls(q, true);
    for (const url of urls) {
      if (isSocialMediaUrl(url)) return url;
    }
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40);
  if (!slug) return "";

  const guesses = [
    `https://www.facebook.com/${slug}`,
    `https://www.facebook.com/${slug.replace(/\s/g, "")}`,
    `https://www.instagram.com/${slug}`,
  ];

  for (const url of guesses) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        headers: SCRAPE_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
      if (res.status < 400 && isSocialMediaUrl(res.url)) return res.url.replace(/\/$/, "");
    } catch {
      /* try next */
    }
  }

  return "";
}
