import { NextResponse } from "next/server";
import { normalizeWebsite, readUserListing } from "@/lib/listings";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const listing = readUserListing(userId);
  if (!listing?.published) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const photoUrl = (f: string) => `/api/store/${userId}/photo/${encodeURIComponent(f)}`;

  return NextResponse.json({
    userId: listing.userId,
    name: listing.name,
    businessType: listing.businessType,
    description: listing.description,
    address: listing.address,
    city: listing.city,
    country: listing.country,
    phone: listing.phone,
    email: listing.email,
    website: listing.website ? normalizeWebsite(listing.website) : "",
    coverPhoto: listing.coverPhoto ? photoUrl(listing.coverPhoto) : null,
    logoPhoto: listing.logoPhoto ? photoUrl(listing.logoPhoto) : null,
    photos: listing.photos.map(photoUrl),
  });
}
