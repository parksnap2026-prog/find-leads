import { NextResponse } from "next/server";
import { normalizeWebsite, readUserListing } from "@/lib/listings";

function photoUrl(userId: string, filename: string) {
  return `/api/store/${userId}/photo/${encodeURIComponent(filename)}`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const { userId } = await ctx.params;
  const listing = await readUserListing(userId);
  if (!listing?.published) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
    coverPhoto: listing.coverPhoto ? photoUrl(userId, listing.coverPhoto) : null,
    logoPhoto: listing.logoPhoto ? photoUrl(userId, listing.logoPhoto) : null,
    photos: listing.photos.map((f) => photoUrl(userId, f)),
  });
}
