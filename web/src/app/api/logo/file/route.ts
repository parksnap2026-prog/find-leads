import { NextResponse } from "next/server";
import { readUserLogoBuffer } from "@/lib/logo";

export async function GET() {
  const logo = await readUserLogoBuffer();
  if (!logo) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(new Uint8Array(logo.buffer), {
    headers: {
      "Content-Type": logo.mime,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
