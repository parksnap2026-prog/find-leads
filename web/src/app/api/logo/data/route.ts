import { NextResponse } from "next/server";
import { readUserLogoBuffer } from "@/lib/logo";

export async function GET() {
  const logo = await readUserLogoBuffer();
  if (!logo) {
    return NextResponse.json({ hasLogo: false });
  }
  return NextResponse.json({
    hasLogo: true,
    static: true,
    dataUrl: `data:${logo.mime};base64,${logo.buffer.toString("base64")}`,
  });
}
