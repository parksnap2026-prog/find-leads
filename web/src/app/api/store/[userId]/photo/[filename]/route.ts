import fs from "fs";
import { NextResponse } from "next/server";
import { listingPhotoPath, photoMime, readUserListing } from "@/lib/listings";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string; filename: string }> },
) {
  const { userId, filename } = await params;
  const listing = readUserListing(userId);
  const owned =
    listing?.published &&
    (listing.coverPhoto === filename ||
      listing.logoPhoto === filename ||
      listing.photos.includes(filename));
  if (!owned) {
    return new NextResponse("Not found", { status: 404 });
  }
  const filepath = listingPhotoPath(userId, filename);
  if (!fs.existsSync(filepath)) return new NextResponse("Not found", { status: 404 });
  const buffer = fs.readFileSync(filepath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": photoMime(filepath),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
