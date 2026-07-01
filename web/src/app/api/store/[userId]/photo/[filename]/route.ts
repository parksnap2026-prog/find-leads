import { NextResponse } from "next/server";
import { readListingPhoto, readUserListing } from "@/lib/listings";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ userId: string; filename: string }> },
) {
  const { userId, filename } = await ctx.params;
  const listing = await readUserListing(userId);
  const allowed =
    listing?.published &&
    (listing.coverPhoto === filename ||
      listing.logoPhoto === filename ||
      listing.photos.includes(filename));
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const photo = await readListingPhoto(userId, filename);
  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(photo.buffer), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
