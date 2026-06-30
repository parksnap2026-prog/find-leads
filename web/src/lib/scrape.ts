import type { ScrapeResult } from "@/lib/db/types";
import { fetchRenderedHtml, isDeepScrapeEnabled } from "@/lib/scrape-providers";
import { sanitizeBusinessWebsite } from "@/lib/website-url";

const SCRAPE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const FB_HEADERS = {
  ...SCRAPE_HEADERS,
  "User-Agent": "facebookexternalhit/1.1",
};

const SOCIAL_DOMAINS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "tiktok.com",
  "youtube.com",
];

const CHATBOT_SIGNATURES: Record<string, string[]> = {
  Intercom: ["intercom.io", "intercomcdn.com", "widget.intercom.io"],
  Drift: ["drift.com", "js.driftt.com"],
  Zendesk: ["zopim.com", "zendesk.com/embeddable", "zd-messenger"],
  Tidio: ["tidiochat.com", "widget.tidio.co", "tidio.co"],
  Crisp: ["crisp.chat", "client.crisp.chat"],
  HubSpot: ["js.hs-scripts.com", "js.hubspot.com", "hubspot.com/conversations"],
  Freshchat: ["wchat.freshchat.com", "freshchat.com"],
  "Tawk.to": ["embed.tawk.to", "tawk.to"],
  LiveChat: ["livechatinc.com", "cdn.livechat.com", "livechat.com"],
  "Chatbot.com": ["cdn.chatbot.com"],
  Landbot: ["landbot.io", "chats.landbot.io"],
  ManyChat: ["widget.manychat.com"],
  Olark: ["olark.com"],
  Userlike: ["userlike.com"],
  Botpress: ["botpress.com"],
  Voiceflow: ["cdn.voiceflow.com", "runtime.voiceflow.com"],
  Chaport: ["chaport.com"],
  JivoChat: ["jivosite.com", "jivo.chat"],
  Smartsupp: ["smartsupp.com"],
  LiveAgent: ["ladesk.com", "liveagent.com"],
};

const GENERIC_PATTERNS = [
  /chatbot/i,
  /live[\-_]?chat/i,
  /chat[\-_]?widget/i,
  /ai[\-_]assistant/i,
  /virtual[\-_]assistant/i,
  /support[\-_]chat/i,
];

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const EMAIL_BLOCK_LOCAL = new Set([
  "noreply", "no-reply", "donotreply", "do-not-reply",
  "mailer-daemon", "postmaster", "webmaster", "bounce",
  "notifications", "support", "admin", "root",
]);
const EMAIL_BLOCK_DOMAIN = new Set([
  "example.com", "domain.com", "yourdomain.com", "email.com",
  "test.com", "sentry.io", "wixpress.com", "squarespace.com",
  "amazonaws.com", "googletagmanager.com",
]);
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|svg|webp|ico|bmp|tiff?)$/i;
const CONTACT_HREF_RE = /href=["']([^"']*(?:contact|about|reach|touch|info)[^"']*)["']/gi;
const COMMON_CONTACT_PATHS = [
  "/contact",
  "/contact-us",
  "/contactus",
  "/about",
  "/about-us",
  "/kontakt",
  "/impressum",
];

function isSocial(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return SOCIAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function extractEmails(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/href=["']mailto:([^\s"'>\?&#]+)/gi)) {
    found.add(m[1].trim().toLowerCase());
  }
  const text = html.replace(/<[^>]+>/g, " ");
  for (const m of text.matchAll(EMAIL_RE)) {
    found.add(m[0].toLowerCase());
  }
  const clean: string[] = [];
  for (const email of found) {
    const [local, domain] = email.split("@");
    if (!local || !domain || !domain.includes(".")) continue;
    if (IMAGE_EXT_RE.test(domain)) continue;
    if (EMAIL_BLOCK_LOCAL.has(local.split("+")[0])) continue;
    if (EMAIL_BLOCK_DOMAIN.has(domain)) continue;
    clean.push(email);
  }
  return [...new Set(clean)].sort().slice(0, 5);
}

function contactPageUrl(html: string, baseUrl: string): string | null {
  const parsed = new URL(baseUrl);
  const baseRoot = `${parsed.protocol}//${parsed.host}`;
  let m: RegExpExecArray | null;
  CONTACT_HREF_RE.lastIndex = 0;
  while ((m = CONTACT_HREF_RE.exec(html))) {
    const href = m[1].trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:"))
      continue;
    if (href.startsWith("http")) {
      if (new URL(href).hostname === parsed.hostname) return href;
    } else if (href.startsWith("/")) {
      return baseRoot + href;
    } else {
      const candidate = new URL(href, baseUrl).href;
      if (new URL(candidate).hostname === parsed.hostname) return candidate;
    }
  }
  return null;
}

function extractPageName(html: string): string {
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item?.name) return String(item.name).trim();
      }
    } catch {
      /* ignore */
    }
  }
  const ogSite = html.match(
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
  );
  if (ogSite) return ogSite[1].trim();
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (ogTitle) return ogTitle[1].trim();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title) return title[1].trim();
  return "";
}

function extractPhones(html: string): string[] {
  const phones = new Set<string>();
  for (const m of html.matchAll(/href=["']tel:([^\s"'>\?&#]+)/gi)) {
    const raw = m[1].trim().replace(/%20/g, " ").replace(/%2B/gi, "+");
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) phones.add(raw);
  }
  const text = html.replace(/<[^>]+>/g, " ");
  for (const m of text.matchAll(/\+?\d[\d\s().\-]{6,}\d/g)) {
    const raw = m[0].trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) phones.add(raw);
  }
  return [...phones].sort().slice(0, 3);
}

function extractJsonLdContacts(html: string): { phone?: string; email?: string } {
  const contacts: { phone?: string; email?: string } = {};
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        if (item.telephone && !contacts.phone) contacts.phone = String(item.telephone);
        if (item.email && !contacts.email) contacts.email = String(item.email).toLowerCase();
      }
    } catch {
      /* ignore */
    }
  }
  return contacts;
}

async function fetchUrl(url: string, headers: Record<string, string>) {
  const res = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  return { html, finalUrl: res.url, status: res.status };
}

async function mergeHtmlContacts(
  html: string,
  emails: Set<string>,
  phones: Set<string>,
) {
  extractEmails(html).forEach((e) => emails.add(e));
  extractPhones(html).forEach((p) => phones.add(p));
  const jsonld = extractJsonLdContacts(html);
  if (jsonld.email) emails.add(jsonld.email);
  if (jsonld.phone) phones.add(jsonld.phone);
}

async function enrichFromContactPages(
  html: string,
  finalUrl: string,
  social: boolean,
  emails: Set<string>,
  phones: Set<string>,
  headers: Record<string, string>,
  tryCommonPaths: boolean,
) {
  if (social) return;

  const contactUrl = contactPageUrl(html, finalUrl);
  const urls = new Set<string>();
  if (contactUrl) urls.add(contactUrl);

  if (tryCommonPaths && emails.size === 0) {
    for (const path of COMMON_CONTACT_PATHS) {
      urls.add(new URL(path, finalUrl).href);
    }
  }

  for (const pageUrl of urls) {
    if (pageUrl.replace(/\/$/, "") === finalUrl.replace(/\/$/, "")) continue;
    try {
      const page = await fetchUrl(pageUrl, headers);
      if (page.status >= 400 || page.html.length < 200) continue;
      await mergeHtmlContacts(page.html, emails, phones);
      if (emails.size > 0 && phones.size > 0) break;
    } catch {
      /* ignore */
    }
  }
}

function detectChatAgents(html: string, social: boolean): string[] {
  if (social) return [];
  const htmlLower = html.toLowerCase();
  const foundAgents: string[] = [];
  for (const [platform, sigs] of Object.entries(CHATBOT_SIGNATURES)) {
    if (sigs.some((s) => htmlLower.includes(s.toLowerCase()))) {
      foundAgents.push(platform);
    }
  }
  if (!foundAgents.length) {
    for (const pat of GENERIC_PATTERNS) {
      if (pat.test(htmlLower)) {
        foundAgents.push("Chat Widget");
        break;
      }
    }
  }
  return foundAgents;
}

function buildResult(
  html: string,
  social: boolean,
  emails: Set<string>,
  phones: Set<string>,
  scrapeMethod: ScrapeResult["scrapeMethod"],
  renderProvider?: string,
): ScrapeResult {
  const foundAgents = detectChatAgents(html, social);
  return {
    has_agent: foundAgents.length > 0,
    platforms: [...new Set(foundAgents)],
    emails: [...emails].sort().slice(0, 5),
    phones: [...phones].sort().slice(0, 3),
    name: extractPageName(html),
    checked: true,
    is_social: social,
    error: null,
    scrapeMethod,
    renderProvider,
  };
}

function needsDeepScrape(result: ScrapeResult, social: boolean): boolean {
  if (!isDeepScrapeEnabled()) return false;
  if (social) return false;
  if (result.error) return true;
  return result.emails.length === 0;
}

function mergeScrapeResults(primary: ScrapeResult, secondary: ScrapeResult): ScrapeResult {
  const emails = new Set([...primary.emails, ...secondary.emails]);
  const phones = new Set([...primary.phones, ...secondary.phones]);
  const platforms = new Set([...primary.platforms, ...secondary.platforms]);
  const useSecondary =
    secondary.emails.length > primary.emails.length ||
    secondary.phones.length > primary.phones.length;

  return {
    has_agent: primary.has_agent || secondary.has_agent,
    platforms: [...platforms],
    emails: [...emails].sort().slice(0, 5),
    phones: [...phones].sort().slice(0, 3),
    name: primary.name || secondary.name,
    checked: true,
    is_social: primary.is_social,
    error: emails.size || phones.size ? null : primary.error ?? secondary.error,
    scrapeMethod: useSecondary ? "rendered" : primary.scrapeMethod,
    renderProvider: useSecondary ? secondary.renderProvider : primary.renderProvider,
  };
}

async function scrapeFromHtml(
  html: string,
  finalUrl: string,
  social: boolean,
  isFb: boolean,
  scrapeMethod: ScrapeResult["scrapeMethod"],
  renderProvider?: string,
  tryCommonPaths = false,
): Promise<ScrapeResult> {
  const hdrs = isFb ? FB_HEADERS : SCRAPE_HEADERS;
  const emails = new Set<string>();
  const phones = new Set<string>();
  await mergeHtmlContacts(html, emails, phones);
  await enrichFromContactPages(html, finalUrl, social, emails, phones, hdrs, tryCommonPaths);
  return buildResult(html, social, emails, phones, scrapeMethod, renderProvider);
}

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  const empty: ScrapeResult = {
    has_agent: false,
    platforms: [],
    emails: [],
    phones: [],
    name: "",
    checked: false,
    is_social: false,
    error: "No website",
    scrapeMethod: "direct",
  };
  if (!url) return empty;

  const normalized = sanitizeBusinessWebsite(url.startsWith("http") ? url : `https://${url}`);
  if (!normalized) {
    return { ...empty, checked: true, error: "Invalid or blocked URL" };
  }
  const social = isSocial(normalized);
  const isFb = normalized.includes("facebook.com") || normalized.includes("fb.com");
  const hdrs = isFb ? FB_HEADERS : SCRAPE_HEADERS;

  let primary: ScrapeResult;
  try {
    const fetched = await fetchUrl(normalized, hdrs);
    primary = await scrapeFromHtml(
      fetched.html,
      fetched.finalUrl,
      social,
      isFb,
      "direct",
      undefined,
      !social,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    primary = {
      ...empty,
      checked: true,
      is_social: social,
      error: msg.includes("timeout") || msg.includes("Timeout") ? "Timeout" : msg.slice(0, 80),
      scrapeMethod: "direct",
    };
  }

  if (!needsDeepScrape(primary, social)) {
    return primary;
  }

  const rendered = await fetchRenderedHtml(normalized);
  if (!rendered.ok) {
    return primary;
  }

  const deep = await scrapeFromHtml(
    rendered.html,
    rendered.finalUrl,
    social,
    isFb,
    "rendered",
    rendered.provider,
    true,
  );

  return mergeScrapeResults(primary, deep);
}
