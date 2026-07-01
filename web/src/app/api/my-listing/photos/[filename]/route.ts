import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { photoMime, readListingPhoto, readUserListing } from "@/lib/listings";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  try {
    const user = await requireUser();
    const { filename } = await ctx.params;
    const listing = await readUserListing(user.id);
    const allowed =
      listing?.coverPhoto === filename ||
      listing?.logoPhoto === filename ||
      listing?.photos.includes(filename);
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const photo = await readListingPhoto(user.id, filename);
    if (!photo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(photo.buffer), {
      headers: {
        "Content-Type": photo.mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
