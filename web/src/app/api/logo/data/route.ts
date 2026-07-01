import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readUserLogoDataUrl } from "@/lib/logo";

/** Returns the logged-in user's email logo as a data: URL for iframe previews. */
export async function GET() {
  try {
    const user = await requireUser();
    const dataUrl = await readUserLogoDataUrl(user.id);
    if (!dataUrl) {
      return NextResponse.json({ hasLogo: false });
    }
    return NextResponse.json({ hasLogo: true, dataUrl });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
