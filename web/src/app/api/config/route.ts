import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getGoogleApiKey } from "@/lib/google-key";
import { BUSINESS_TYPES, OSM_TAGS } from "@/lib/constants";
import { COUNTRIES } from "@/lib/countries";
import { formatOsmTag } from "@/lib/search-scope";

export async function GET() {
  await requireUser();
  const osm_scope = Object.fromEntries(
    Object.entries(OSM_TAGS).map(([type, tags]) => [
      type,
      tags.map((t) => formatOsmTag(t)),
    ]),
  );
  return NextResponse.json({
    has_google_key: Boolean(getGoogleApiKey()),
    business_types: BUSINESS_TYPES,
    osm_scope,
    countries: COUNTRIES,
    app: {
      name: "MyBusinessesLeads",
      short: "MBL",
    },
  });
}
