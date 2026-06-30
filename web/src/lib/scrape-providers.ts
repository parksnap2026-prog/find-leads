/**
 * Free deep scrape via Jina Reader (no API key required).
 * Paid providers are only used if you add keys to .env — not needed for free tier.
 */

export type RenderedFetchResult =
  | { ok: true; html: string; finalUrl: string; provider: string }
  | { ok: false; error: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Jina free tier ≈ 20 requests/min — throttle when no API key is set. */
let lastJinaCallAt = 0;

async function throttleJinaFreeTier() {
  if (process.env.JINA_API_KEY?.trim()) return;
  const minGapMs = 3500;
  const wait = lastJinaCallAt + minGapMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastJinaCallAt = Date.now();
}

async function fetchViaJina(url: string, attempt = 0): Promise<RenderedFetchResult> {
  await throttleJinaFreeTier();

  const headers: Record<string, string> = {
    Accept: "text/html,application/json,text/plain",
    "X-Respond-With": "html",
    "X-Timeout": "20",
  };
  const key = process.env.JINA_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(45000),
    });

    if (res.status === 429 && attempt < 2) {
      await sleep(5000 * (attempt + 1));
      return fetchViaJina(url, attempt + 1);
    }

    if (!res.ok) {
      return { ok: false, error: `Jina Reader HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await res.json()) as {
        data?: { html?: string; content?: string; url?: string };
      };
      const html = json.data?.html ?? json.data?.content ?? "";
      if (!html.trim()) return { ok: false, error: "Jina returned empty content" };
      return {
        ok: true,
        html,
        finalUrl: json.data?.url ?? url,
        provider: "jina",
      };
    }

    const html = await res.text();
    if (!html.trim()) return { ok: false, error: "Jina returned empty content" };
    return { ok: true, html, finalUrl: url, provider: "jina" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 80) : "Jina fetch failed",
    };
  }
}

async function fetchViaRapidApiPageSource(url: string): Promise<RenderedFetchResult> {
  const apiKey = process.env.RAPIDAPI_KEY?.trim();
  if (!apiKey) return { ok: false, error: "RAPIDAPI_KEY not set" };

  const host =
    process.env.RAPIDAPI_PAGE_SOURCE_HOST?.trim() ||
    "page-source-scraper.p.rapidapi.com";
  const endpoint = `https://${host}/get-url?urlSupplier=${encodeURIComponent(url)}&forceCache=true`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": host,
      },
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      return { ok: false, error: `RapidAPI page source HTTP ${res.status}` };
    }
    const html = await res.text();
    if (!html.trim()) return { ok: false, error: "RapidAPI returned empty HTML" };
    return { ok: true, html, finalUrl: url, provider: "rapidapi-page-source" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 80) : "RapidAPI fetch failed",
    };
  }
}

async function fetchViaPandaScraper(url: string): Promise<RenderedFetchResult> {
  const base = process.env.PANDA_SCRAPER_API_URL?.trim().replace(/\/$/, "");
  const apiKey =
    process.env.PANDA_SCRAPER_API_KEY?.trim() || process.env.RAPIDAPI_KEY?.trim();
  if (!base || !apiKey) {
    return { ok: false, error: "Panda scraper URL/key not configured" };
  }

  const rapidHost = process.env.PANDA_SCRAPER_RAPIDAPI_HOST?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (rapidHost) {
    headers["x-rapidapi-key"] = apiKey;
    headers["x-rapidapi-host"] = rapidHost;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const startRes = await fetch(`${base}/scrape`, {
      method: "POST",
      headers,
      body: JSON.stringify({ url, format: "html", width: 1280, height: 900 }),
      signal: AbortSignal.timeout(20000),
    });
    if (!startRes.ok) {
      return { ok: false, error: `Panda scrape start HTTP ${startRes.status}` };
    }

    const startJson = (await startRes.json()) as {
      taskId?: string;
      html?: string;
      status?: string;
      url?: string;
    };

    if (startJson.html) {
      return {
        ok: true,
        html: startJson.html,
        finalUrl: url,
        provider: "panda",
      };
    }

    const taskId = startJson.taskId;
    if (!taskId) return { ok: false, error: "Panda scraper returned no taskId" };

    for (let attempt = 0; attempt < 12; attempt++) {
      await sleep(1500 + attempt * 500);
      const statusRes = await fetch(`${base}/scrape/status`, {
        method: "POST",
        headers,
        body: JSON.stringify({ taskId }),
        signal: AbortSignal.timeout(15000),
      });
      if (!statusRes.ok) continue;

      const statusJson = (await statusRes.json()) as {
        status?: string;
        html?: string;
        url?: string;
      };

      if (statusJson.status === "failed" || statusJson.status === "error") {
        return { ok: false, error: "Panda scrape task failed" };
      }

      if (statusJson.html) {
        return {
          ok: true,
          html: statusJson.html,
          finalUrl: url,
          provider: "panda",
        };
      }

      if (statusJson.status === "completed" && statusJson.url) {
        const fileRes = await fetch(statusJson.url, {
          signal: AbortSignal.timeout(20000),
        });
        if (!fileRes.ok) continue;
        const html = await fileRes.text();
        if (html.trim()) {
          return { ok: true, html, finalUrl: url, provider: "panda" };
        }
      }
    }

    return { ok: false, error: "Panda scrape timed out" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 80) : "Panda fetch failed",
    };
  }
}

/** Free Jina Reader first; paid APIs only if keys are in .env. */
export async function fetchRenderedHtml(url: string): Promise<RenderedFetchResult> {
  if (process.env.PANDA_SCRAPER_API_URL?.trim() && process.env.PANDA_SCRAPER_API_KEY?.trim()) {
    const panda = await fetchViaPandaScraper(url);
    if (panda.ok) return panda;
  }
  if (process.env.RAPIDAPI_KEY?.trim()) {
    const rapid = await fetchViaRapidApiPageSource(url);
    if (rapid.ok) return rapid;
  }
  return fetchViaJina(url);
}

/** Deep scrape is on by default (Jina Reader). Set SCRAPE_DEEP_FALLBACK=false to disable. */
export function isDeepScrapeEnabled(): boolean {
  return process.env.SCRAPE_DEEP_FALLBACK !== "false";
}
