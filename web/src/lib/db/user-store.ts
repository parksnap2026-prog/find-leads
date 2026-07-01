import type { UserRecord } from "./types";
import { getStorageProvider, isFirebaseReady } from "./index";
import { readUsersFile, writeUsersFile } from "./local";
import * as firebaseUsers from "./firebase-users";

function useFirebaseUsers(): boolean {
  return getStorageProvider() === "firebase" && isFirebaseReady();
}

export async function getUserByEmail(email: string): Promise<UserRecord | undefined> {
  if (useFirebaseUsers()) {
    return firebaseUsers.findUserByEmail(email);
  }
  const { users } = readUsersFile();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function getUserById(id: string): Promise<UserRecord | undefined> {
  if (useFirebaseUsers()) {
    return firebaseUsers.findUserById(id);
  }
  const { users } = readUsersFile();
  return users.find((u) => u.id === id);
}

export async function saveUser(user: UserRecord): Promise<void> {
  if (useFirebaseUsers()) {
    await firebaseUsers.saveUser(user);
    return;
  }
  const data = readUsersFile();
  const index = data.users.findIndex((u) => u.id === user.id);
  if (index >= 0) data.users[index] = user;
  else data.users.push(user);
  writeUsersFile(data);
}

export function usersStorageBackend(): "firebase" | "local" {
  return useFirebaseUsers() ? "firebase" : "local";
}
