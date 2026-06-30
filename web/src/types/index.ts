export interface BusinessResult {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  social?: string;
  email: string;
  opening_hours?: string;
  scrapeStatus?: "pending" | "scanning" | "done" | "skipped" | "error";
  linkStatus?: "idle" | "finding" | "found" | "not_found" | "error";
  socialStatus?:
    | "idle"
    | "pending"
    | "finding"
    | "scanning"
    | "done"
    | "not_found"
    | "skipped"
    | "error";
  has_agent?: boolean;
  platforms?: string[];
  called?: boolean;
  city?: string;
  countryName?: string;
  businessType?: string;
  isListing?: boolean;
  listingUserId?: string;
  storeUrl?: string;
}

export interface SearchParams {
  country: string;
  city: string;
  business_type: string;
  radius?: number;
  source?: "auto" | "google" | "openstreetmap";
  page_token?: string;
}

export interface SearchResponse {
  results: BusinessResult[];
  total: number;
  source: string;
  radius_used?: number | null;
  error?: string;
}

export interface MessageTemplate {
  id: string;
  label: string;
  description: string;
  color: string;
}

export interface HistoryEntry {
  id: string;
  savedAt: string;
  label: string;
  params: SearchParams & { countryName?: string };
  resultCount: number;
}

export interface Country {
  code: string;
  name: string;
}
