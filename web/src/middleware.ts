import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/", "/login", "/register"];
const PUBLIC_API = ["/api/auth/login", "/api/auth/register", "/api/health"];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_API.some((p) => pathname === p)) return true;
  if (pathname.startsWith("/store")) return true;
  if (pathname.startsWith("/api/store/")) return true;
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const user = await getSessionFromRequest(req);
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
