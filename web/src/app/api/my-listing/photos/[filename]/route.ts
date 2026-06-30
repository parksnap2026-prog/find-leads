import fs from "fs";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listingPhotoPath, photoMime, readUserListing } from "@/lib/listings";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const user = await requireUser();
    const { filename } = await params;
    const listing = readUserListing(user.id);
    const owned =
      listing?.coverPhoto === filename ||
      listing?.logoPhoto === filename ||
      listing?.photos.includes(filename);
    if (!owned) {
      return new NextResponse("Not found", { status: 404 });
    }
    const filepath = listingPhotoPath(user.id, filename);
    if (!fs.existsSync(filepath)) return new NextResponse("Not found", { status: 404 });
    const buffer = fs.readFileSync(filepath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": photoMime(filepath),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
