import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  deleteUserLogo,
  saveUserLogo,
  userHasLogo,
} from "@/lib/logo";
import { logoPreviewUrl } from "@/lib/logo-preview";

export async function GET() {
  try {
    const user = await requireUser();
    const hasLogo = await userHasLogo(user.id);
    if (!hasLogo) {
      return NextResponse.json({ hasLogo: false });
    }
    return NextResponse.json({
      hasLogo: true,
      url: logoPreviewUrl(undefined, Date.now()),
      version: Date.now(),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("logo");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "logo file required" }, { status: 400 });
    }

    const mime = file.type || "image/png";
    if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) {
      return NextResponse.json(
        { error: "Use PNG, JPG, or WEBP" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Logo must be under 2 MB" }, { status: 400 });
    }

    await saveUserLogo(user.id, buffer, mime);
    const version = Date.now();
    return NextResponse.json({
      ok: true,
      hasLogo: true,
      url: logoPreviewUrl(undefined, version),
      version,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await deleteUserLogo(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
