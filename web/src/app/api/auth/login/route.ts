import { NextResponse } from "next/server";
import { authenticateUser, createUser } from "@/lib/auth/users";
import { setSessionCookie } from "@/lib/auth/session";
import { seedAdminUser } from "@/lib/auth/users";

export async function POST(req: Request) {
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
}
