import type { UserListing } from "@/lib/listings";
import { getFirebaseDb } from "./firebase-admin";
import { deleteUserFile } from "./firebase-storage";

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
  const listing = await readListing(userId);
  await getFirebaseDb().collection(STORES).doc(userId).delete();
  if (!listing) return;

  const files = new Set<string>();
  if (listing.coverPhoto) files.add(listing.coverPhoto);
  if (listing.logoPhoto) files.add(listing.logoPhoto);
  listing.photos.forEach((p) => files.add(p));

  await Promise.all(
    [...files].map((filename) => deleteUserFile(userId, `listing/${filename}`)),
  );
}

export async function loadPublishedListings(): Promise<UserListing[]> {
  const snap = await getFirebaseDb()
    .collection(STORES)
    .where("published", "==", true)
    .get();

  return snap.docs.map((doc) => doc.data() as UserListing);
}
