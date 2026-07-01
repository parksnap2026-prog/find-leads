import { NextResponse } from "next/server";
import { authenticateUser, seedAdminUser } from "@/lib/auth/users";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    await seedAdminUser();
    const body = await req.json();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await authenticateUser(email, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await setSessionCookie(user);
    return NextResponse.json({ user });
  } catch (e) {
    console.error("[auth/login]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Login failed" },
      { status: 500 },
    );
  }
}
