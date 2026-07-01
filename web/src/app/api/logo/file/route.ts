import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readUserLogoBuffer } from "@/lib/logo";

export async function GET() {
  try {
    const user = await requireUser();
    const logo = await readUserLogoBuffer(user.id);
    if (!logo) {
      return new NextResponse("Not found", { status: 404 });
    }
    return new NextResponse(new Uint8Array(logo.buffer), {
      headers: {
        "Content-Type": logo.mime,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
