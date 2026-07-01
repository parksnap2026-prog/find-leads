import { getStorageProvider, isFirebaseReady } from "./index";
import { activityStorageBackend } from "./user-activity";

export function getFirebaseStatus() {
  const ready = isFirebaseReady();
  const provider = getStorageProvider();

  return {
    ready,
    provider,
    activity: activityStorageBackend(),
    message: ready
      ? provider === "firebase"
        ? "Firebase connected — users, search history, call activity & email logs use Firestore"
        : "Firebase env vars set — set STORAGE_PROVIDER=firebase to enable Firestore activity"
      : "Using local file storage for all data",
  };
}
