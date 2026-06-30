import fs from "fs";
import path from "path";
import { BUSINESS_TYPES, FETCH_HEADERS, OSM_TAGS } from "./constants";
import { dedupeOsmTags, type OsmTagPair } from "./search-scope";
import {
  extractSocialFromOsmTags,
  extractWebsiteFromOsmTags,
  isSocialMediaUrl,
  sanitizeBusinessWebsite,
  splitWebsiteAndSocial,
} from "./website-url";
import type { BusinessResult } from "@/types";

const CITIES_FILE = path.join(process.cwd(), "data", "cities.json");

let staticCities: Record<string, string[]> = {};
try {
  if (fs.existsSync(CITIES_FILE)) {
    staticCities = JSON.parse(fs.readFileSync(CITIES_FILE, "utf-8"));
  }
} catch {
  staticCities = {};
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exclude car/truck dealerships when searching auto repair (shop=car sells vehicles). */
function isVehicleDealerNotRepair(tags: Record<string, string>) {
  if (
    tags.amenity === "car_repair" ||
    tags.shop === "car_repair" ||
    tags.craft === "car_repair" ||
    tags.shop === "mechanic" ||
    tags.craft === "mechanic" ||
    tags.amenity === "vehicle_inspection"
  ) {
    return false;
  }
  if (tags.shop === "car" || tags.shop === "truck") return true;
  if (tags.service === "dealer") return true;
  return false;
}

export async function geocodeCity(
  city: string,
  countryCode: string,
): Promise<{ lat: number; lon: number } | null> {
  const params = new URLSearchParams({
    city,
    country: countryCode,
    format: "json",
    limit: "1",
  });

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: FETCH_HEADERS, signal: AbortSignal.timeout(10000) },
    );
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function fetchCitiesForCountry(
  countryCode: string,
): Promise<{ cities: string[]; error?: string }> {
  const code = countryCode.toUpperCase();
  if (staticCities[code]) {
    return { cities: staticCities[code] };
  }

  const query = `
[out:json][timeout:60];
area["ISO3166-1:alpha2"="${code}"]->.c;
(
  node["place"="city"](area.c);
  node["place"="town"](area.c);
);
out tags;
`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { ...FETCH_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(65000),
      });

      const text = await res.text();
      if (res.status === 429 || !text.trim()) {
        await sleep(3000 + attempt * 3000);
        continue;
      }

      let data: { elements?: { tags?: { name?: string } }[] };
      try {
        data = JSON.parse(text);
      } catch {
        await sleep(3000);
        continue;
      }

      const cities = [
        ...new Set(
          (data.elements ?? [])
            .map((el) => el.tags?.name)
            .filter((name): name is string => Boolean(name)),
        ),
      ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

      return { cities };
    } catch (e) {
      if (attempt === 2) {
        return { cities: [], error: e instanceof Error ? e.message : "Overpass error" };
      }
      await sleep(3000);
    }
  }

  return { cities: [], error: "Overpass API unavailable" };
}

export async function searchOverpass(
  businessType: string,
  lat: number,
  lon: number,
  radiusM = 5000,
  scopeTags: OsmTagPair[] = [],
): Promise<{ results: BusinessResult[]; error?: string }> {
  let query: string;
  let reqTimeout: number;

  const tags = scopeTags.length
    ? dedupeOsmTags(scopeTags)
    : businessType === "all"
      ? []
      : dedupeOsmTags(OSM_TAGS[businessType] ?? [["amenity", "restaurant"]]);

  if (businessType === "all" && !tags.length) {
    const tq = ["shop", "amenity", "office", "leisure", "tourism", "craft"].map(
      (key) => `nwr["${key}"]["name"](around:${radiusM},${lat},${lon});`,
    );
    query = `[out:json][timeout:90][maxsize:67108864];(${tq.join("")});out center tags 2000;`;
    reqTimeout = 100000;
  } else if (!tags.length) {
    return { results: [], error: "No search rules selected — add rules or reset defaults." };
  } else {
    const tagQueries = tags.map(
      ([key, value]) => `nwr["${key}"="${value}"](around:${radiusM},${lat},${lon});`,
    );
    query = `[out:json][timeout:${businessType === "all" ? 60 : 30}];(${tagQueries.join("")});out center tags;`;
    reqTimeout = businessType === "all" ? 45000 : 35000;
  }

  let elements: {
    id?: number | string;
    tags?: Record<string, string>;
  }[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { ...FETCH_HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(reqTimeout),
      });

      if (res.status === 429) {
        await sleep(3000 + attempt * 3000);
        continue;
      }

      const text = await res.text();
      if (!text.trim()) {
        await sleep(2000 + attempt * 2000);
        continue;
      }

      let data: { elements?: typeof elements; remark?: string };
      try {
        data = JSON.parse(text);
      } catch {
        await sleep(2000 + attempt * 2000);
        continue;
      }

      elements = data.elements ?? [];
      if (!elements.length && data.remark) {
        return { results: [], error: data.remark };
      }
      break;
    } catch (e) {
      if (attempt === 2) {
        return {
          results: [],
          error: e instanceof Error ? e.message : "Overpass API unavailable",
        };
      }
      await sleep(2000 + attempt * 2000);
    }
  }

  const results: BusinessResult[] = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    const name = (t.name ?? "").trim();
    if (!name) continue;
    if (businessType === "car_repair" && isVehicleDealerNotRepair(t)) continue;

    const addrParts: string[] = [];
    const street = t["addr:street"] ?? "";
    const housenumber = t["addr:housenumber"] ?? "";
    if (street) addrParts.push(`${housenumber} ${street}`.trim());
    if (t["addr:city"]) addrParts.push(t["addr:city"]);
    if (t["addr:postcode"]) addrParts.push(t["addr:postcode"]);

    const split = splitWebsiteAndSocial(
      extractWebsiteFromOsmTags(t),
      extractSocialFromOsmTags(t),
    );

    const phone =
      t.phone ||
      t["contact:phone"] ||
      t.telephone ||
      t["contact:mobile"] ||
      t.mobile ||
      "";

    results.push({
      id: String(el.id ?? ""),
      name,
      address: addrParts.join(", ") || "Address not listed",
      phone,
      website: split.website,
      social: split.social,
      email: t.email || t["contact:email"] || "",
      opening_hours: t.opening_hours ?? "",
    });
  }

  return { results };
}

async function getGooglePlaceDetails(
  placeId: string,
  apiKey: string,
): Promise<{ phone: string; website: string }> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "formatted_phone_number,international_phone_number,website",
    key: apiKey,
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      { headers: FETCH_HEADERS, signal: AbortSignal.timeout(10000) },
    );
    const data = (await res.json()) as {
      result?: {
        formatted_phone_number?: string;
        international_phone_number?: string;
        website?: string;
      };
    };
    const r = data.result ?? {};
    return {
      phone: r.formatted_phone_number || r.international_phone_number || "",
      website: r.website || "",
    };
  } catch {
    return { phone: "", website: "" };
  }
}

export async function searchGoogle(
  businessLabel: string,
  city: string,
  country: string,
  apiKey: string,
  pageToken?: string,
): Promise<{
  results: BusinessResult[];
  nextToken?: string | null;
  error?: string;
}> {
  const base = "https://maps.googleapis.com/maps/api/place/textsearch/json";
  const params = pageToken
    ? new URLSearchParams({ pagetoken: pageToken, key: apiKey })
    : new URLSearchParams({
        query: `${businessLabel} in ${city} ${country}`,
        key: apiKey,
      });

  try {
    const res = await fetch(`${base}?${params}`, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    const data = (await res.json()) as {
      results?: {
        place_id?: string;
        name?: string;
        formatted_address?: string;
      }[];
      next_page_token?: string;
      error_message?: string;
      status?: string;
    };

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return { results: [], error: data.error_message || data.status };
    }

    const places = data.results ?? [];
    const details = await Promise.all(
      places.map((p) => getGooglePlaceDetails(p.place_id ?? "", apiKey)),
    );

    const results: BusinessResult[] = places.map((place, i) => {
      const split = splitWebsiteAndSocial(sanitizeBusinessWebsite(details[i].website), "");
      return {
        id: place.place_id ?? "",
        name: place.name ?? "",
        address: place.formatted_address ?? "",
        phone: details[i].phone,
        website: split.website,
        social: split.social,
        email: "",
        opening_hours: "",
      };
    });

    return { results, nextToken: data.next_page_token ?? null };
  } catch (e) {
    return {
      results: [],
      error: e instanceof Error ? e.message : "Google Places error",
    };
  }
}

export async function runSearch(
  params: {
    country: string;
    city: string;
    business_type: string;
    radius?: number;
    scope_tags?: OsmTagPair[];
    /** @deprecated use scope_tags */
    custom_tags?: OsmTagPair[];
  },
): Promise<{
  results: BusinessResult[];
  total: number;
  radius_used?: number | null;
  error?: string;
}> {
  const { country, city, business_type } = params;
  const radius = params.radius ?? 5000;
  const scopeTags = params.scope_tags ?? params.custom_tags ?? [];

  const coords = await geocodeCity(city, country);
  if (!coords) {
    return {
      results: [],
      total: 0,
      error: `Could not locate "${city}" in "${country}"`,
    };
  }

  let { results, error } = await searchOverpass(
    business_type,
    coords.lat,
    coords.lon,
    radius,
    scopeTags,
  );
  let radiusUsed = radius;

  if (!results.length && !error) {
    for (const expanded of [radius * 3, 30000]) {
      const nextRadius = Math.min(expanded, 30000);
      if (nextRadius <= radiusUsed) continue;
      const wider = await searchOverpass(
        business_type,
        coords.lat,
        coords.lon,
        nextRadius,
        scopeTags,
      );
      if (wider.results.length) {
        results = wider.results;
        radiusUsed = nextRadius;
        error = undefined;
        break;
      }
      if (wider.error) error = wider.error;
    }
  }

  if (error && !results.length) {
    return { results: [], total: 0, error };
  }

  return {
    results,
    total: results.length,
    radius_used: radiusUsed,
  };
}
