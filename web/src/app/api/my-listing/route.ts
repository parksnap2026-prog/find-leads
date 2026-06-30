import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  deleteUserListing,
  listListingPhotos,
  normalizeWebsite,
  readUserListing,
  writeUserListing,
} from "@/lib/listings";

export async function GET() {
  try {
    const user = await requireUser();
    const listing = readUserListing(user.id);
    return NextResponse.json({
      listing,
      ...listListingPhotos(user.id),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "Business name is required" }, { status: 400 });
    }
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Pin your location on the map" }, { status: 400 });
    }
    if (!String(body.city ?? "").trim()) {
      return NextResponse.json({ error: "City is required — pick location on map" }, { status: 400 });
    }

    const listing = writeUserListing(user.id, {
      name,
      businessType: String(body.businessType ?? "hair_salon"),
      description: String(body.description ?? ""),
      address: String(body.address ?? ""),
      city: String(body.city ?? ""),
      country: String(body.country ?? ""),
      countryCode: String(body.countryCode ?? ""),
      lat,
      lng,
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      website: normalizeWebsite(String(body.website ?? "")),
      published: Boolean(body.published),
    });
    return NextResponse.json({ ok: true, listing });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    deleteUserListing(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
