import { NextResponse } from "next/server";

const UA = "MyBusinessesLeads/1.0";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const q = searchParams.get("q");

  try {
    if (lat && lon) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
        { headers: { "User-Agent": UA, "Accept-Language": "en" } },
      );
      if (!res.ok) return NextResponse.json({ error: "Geocode failed" }, { status: 502 });
      const data = await res.json();
      const addr = data.address ?? {};
      const city =
        addr.city || addr.town || addr.village || addr.municipality || addr.suburb || "";
      const country = addr.country || "";
      const road = [addr.road, addr.house_number].filter(Boolean).join(" ");
      const shortAddress = road || data.display_name || "";
      return NextResponse.json({
        address: data.display_name || shortAddress,
        shortAddress,
        city,
        country,
        countryCode: addr.country_code?.toUpperCase() ?? "",
        lat: Number(data.lat),
        lng: Number(data.lon),
      });
    }

    if (q) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`,
        { headers: { "User-Agent": UA, "Accept-Language": "en" } },
      );
      if (!res.ok) return NextResponse.json({ error: "Geocode failed" }, { status: 502 });
      const data = await res.json();
      if (!data?.[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const hit = data[0];
      const addr = hit.address ?? {};
      const city =
        addr.city || addr.town || addr.village || addr.municipality || "";
      return NextResponse.json({
        address: hit.display_name,
        shortAddress: hit.display_name,
        city,
        country: addr.country || "",
        countryCode: addr.country_code?.toUpperCase() ?? "",
        lat: Number(hit.lat),
        lng: Number(hit.lon),
      });
    }

    return NextResponse.json({ error: "lat/lon or q required" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Geocode failed" }, { status: 502 });
  }
}
