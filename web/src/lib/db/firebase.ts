/**
 * Firebase adapter stub — wire up when STORAGE_PROVIDER=firebase and env vars are set.
 * See .env.example for required variables.
 */
import { isFirebaseReady } from "./index";

export function getFirebaseStatus() {
  return {
    ready: isFirebaseReady(),
    message: isFirebaseReady()
      ? "Firebase env vars detected — adapter can be enabled"
      : "Using local file storage",
  };
}
