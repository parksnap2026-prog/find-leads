import bcrypt from "bcryptjs";
import { ensureUserWorkspace } from "@/lib/db/local";
import { getUserByEmail, saveUser } from "@/lib/db/user-store";
import { seedStarterTemplate } from "@/lib/user-templates";
import type { SessionUser, UserRecord, UserRole } from "@/lib/db/types";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function toSessionUser(user: UserRecord): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function seedUserWorkspace(userId: string) {
  try {
    ensureUserWorkspace(userId);
    seedStarterTemplate(userId);
  } catch (e) {
    console.warn("User workspace seed skipped (read-only filesystem?):", e);
  }
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}): Promise<SessionUser> {
  const existing = await getUserByEmail(input.email);
  if (existing) throw new Error("Email already registered");

  const user: UserRecord = {
    id: crypto.randomUUID(),
    email: input.email.toLowerCase().trim(),
    passwordHash: await hashPassword(input.password),
    name: input.name.trim() || input.email.split("@")[0],
    role: input.role ?? "user",
    createdAt: new Date().toISOString(),
  };

  await saveUser(user);
  seedUserWorkspace(user.id);

  return toSessionUser(user);
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return toSessionUser(user);
}

export async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL ?? "admin@mybusinessesleads.com";
  const password = process.env.ADMIN_PASSWORD ?? "MBLAdmin2026!";
  if (await getUserByEmail(email)) return;

  await createUser({
    email,
    password,
    name: "Admin",
    role: "admin",
  });
}
