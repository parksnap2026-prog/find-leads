import type { SearchFormValues } from "@/components/finder/SearchForm";
import type { BusinessResult } from "@/types";
import type { OsmTagPair } from "@/lib/search-scope";

const SESSION_KEY = "mbl_finder_session";
const RERUN_KEY = "mbl_rerun_search";

export interface FinderSession {
  results: BusinessResult[];
  radiusUsed: number | null;
  searchContext: {
    country: string;
    countryName: string;
    city: string;
    businessType: string;
    scopeTags?: OsmTagPair[];
    /** @deprecated use scopeTags */
    customTags?: OsmTagPair[];
  } | null;
  formValues: SearchFormValues | null;
  selectedIds: string[];
}

export function saveFinderSession(session: FinderSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota */
  }
}

export function loadFinderSession(): FinderSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FinderSession;
  } catch {
    return null;
  }
}

export function queueRerunSearch(values: SearchFormValues) {
  sessionStorage.setItem(RERUN_KEY, JSON.stringify(values));
}

export function consumeRerunSearch(): SearchFormValues | null {
  try {
    const raw = sessionStorage.getItem(RERUN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RERUN_KEY);
    return JSON.parse(raw) as SearchFormValues;
  } catch {
    return null;
  }
}
