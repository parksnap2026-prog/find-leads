import type { UserListing } from "@/lib/listings";
import { getFirebaseDb } from "./firebase-admin";

const STORES = "stores";

export async function readListing(userId: string): Promise<UserListing | null> {
  const doc = await getFirebaseDb().collection(STORES).doc(userId).get();
  if (!doc.exists) return null;
  return doc.data() as UserListing;
}

export async function writeListing(listing: UserListing): Promise<UserListing> {
  await getFirebaseDb().collection(STORES).doc(listing.userId).set(listing);
  return listing;
}

export async function deleteListing(userId: string) {
  await getFirebaseDb().collection(STORES).doc(userId).delete();
}

export async function loadPublishedListings(): Promise<UserListing[]> {
  const snap = await getFirebaseDb()
    .collection(STORES)
    .where("published", "==", true)
    .get();

  return snap.docs.map((doc) => doc.data() as UserListing);
}
