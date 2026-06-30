import bcrypt from "bcryptjs";
import {
  readUsersFile,
  writeUsersFile,
  ensureUserWorkspace,
} from "@/lib/db/local";
import { seedStarterTemplate } from "@/lib/user-templates";
import type { SessionUser, UserRecord, UserRole } from "@/lib/db/types";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function findUserByEmail(email: string): UserRecord | undefined {
  const { users } = readUsersFile();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id: string): UserRecord | undefined {
  const { users } = readUsersFile();
  return users.find((u) => u.id === id);
}

function toSessionUser(user: UserRecord): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}): Promise<SessionUser> {
  const existing = findUserByEmail(input.email);
  if (existing) throw new Error("Email already registered");

  const user: UserRecord = {
    id: crypto.randomUUID(),
    email: input.email.toLowerCase().trim(),
    passwordHash: await hashPassword(input.password),
    name: input.name.trim() || input.email.split("@")[0],
    role: input.role ?? "user",
    createdAt: new Date().toISOString(),
  };

  const data = readUsersFile();
  data.users.push(user);
  writeUsersFile(data);
  ensureUserWorkspace(user.id);
  seedStarterTemplate(user.id);

  return toSessionUser(user);
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = findUserByEmail(email);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return toSessionUser(user);
}

export async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL ?? "admin@mybusinessesleads.com";
  const password = process.env.ADMIN_PASSWORD ?? "MBLAdmin2026!";
  if (findUserByEmail(email)) return;

  await createUser({
    email,
    password,
    name: "Admin",
    role: "admin",
  });
}
