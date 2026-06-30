import fs from "fs";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { findUserLogoPath, logoMimeType } from "@/lib/logo";

export async function GET() {
  try {
    const user = await requireUser();
    const filepath = findUserLogoPath(user.id);
    if (!filepath) {
      return new NextResponse("Not found", { status: 404 });
    }
    const buffer = fs.readFileSync(filepath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": logoMimeType(filepath),
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
