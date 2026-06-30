import { NextResponse } from "next/server";
import { createUser, seedAdminUser } from "@/lib/auth/users";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST(req: Request) {
  await seedAdminUser();
  const body = await req.json();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const user = await createUser({ email, password, name });
    await setSessionCookie(user);
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Registration failed" },
      { status: 400 },
    );
  }
}
