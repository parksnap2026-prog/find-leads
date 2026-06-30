export {
  getSessionUser,
  getSessionFromRequest,
  setSessionCookie,
  clearSessionCookie,
} from "./auth/session";

export {
  authenticateUser,
  createUser,
  seedAdminUser,
} from "./auth/users";

import { getSessionUser } from "./auth/session";

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    const err = new Error("Unauthorized");
    throw err;
  }
  return user;
}
