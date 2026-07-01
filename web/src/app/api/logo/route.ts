import { NextResponse } from "next/server";
import { userHasLogo } from "@/lib/logo";
import { STATIC_EMAIL_LOGO_URL } from "@/lib/logo-preview";

export async function GET() {
  return NextResponse.json({
    hasLogo: userHasLogo(),
    static: true,
    url: STATIC_EMAIL_LOGO_URL,
  });
}

export async function POST() {
  return NextResponse.json({
    ok: true,
    static: true,
    hasLogo: true,
    url: STATIC_EMAIL_LOGO_URL,
    message: "Logo is fixed in the app (public/email-logo.png). Replace that file in git to change it.",
  });
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Logo is static in the app and cannot be removed at runtime." },
    { status: 400 },
  );
}
