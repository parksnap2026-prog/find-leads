import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  addListingPhoto,
  clearListingLogo,
  listListingPhotos,
  readUserListing,
  removeListingPhoto,
  setLogoFromGallery,
  type ListingPhotoKind,
} from "@/lib/listings";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await listListingPhotos(user.id));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!(await readUserListing(user.id))) {
      return NextResponse.json(
        { error: "Save your store details first, then upload photos" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(req.url);
    const kind = (searchParams.get("kind") || "gallery") as ListingPhotoKind;
    const useAsLogo = searchParams.get("useAsLogo");

    if (useAsLogo) {
      await setLogoFromGallery(user.id, useAsLogo);
      return NextResponse.json({ ok: true, ...(await listListingPhotos(user.id)) });
    }

    if (!["cover", "logo", "gallery"].includes(kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("photo");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "photo required" }, { status: 400 });
    }
    const mime = file.type || "image/jpeg";
    if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) {
      return NextResponse.json({ error: "Use PNG, JPG, or WEBP" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Photo must be under 4 MB" }, { status: 400 });
    }

    const filename = await addListingPhoto(user.id, buffer, mime, kind);
    return NextResponse.json({ ok: true, filename, ...(await listListingPhotos(user.id)) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("file");
    const kind = searchParams.get("kind") as ListingPhotoKind | null;
    const clearLogo = searchParams.get("clearLogo");

    if (clearLogo === "1") {
      await clearListingLogo(user.id);
      return NextResponse.json({ ok: true, ...(await listListingPhotos(user.id)) });
    }

    if (!filename) return NextResponse.json({ error: "file required" }, { status: 400 });
    await removeListingPhoto(user.id, filename, kind ?? undefined);
    return NextResponse.json({ ok: true, ...(await listListingPhotos(user.id)) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
