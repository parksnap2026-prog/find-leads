import fs from "fs";
import path from "path";
import { getStorageProvider, isFirebaseReady } from "@/lib/db";
import * as firebaseListings from "@/lib/db/firebase-listings";
import {
  deleteUserFile,
  readUserFile,
  saveUserFile,
} from "@/lib/db/firebase-storage";
import { readUsersFile } from "@/lib/db/local";
import { saveUserLogo } from "@/lib/logo";
import { normalizeWebsiteUrl } from "@/lib/website-url";
import type { BusinessResult } from "@/types";

export type ListingPhotoKind = "cover" | "logo" | "gallery";

export interface UserListing {
  userId: string;
  name: string;
  businessType: string;
  description: string;
  address: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  website: string;
  coverPhoto: string | null;
  logoPhoto: string | null;
  photos: string[];
  published: boolean;
  updatedAt: string;
}

const MAX_GALLERY_PHOTOS = 6;

export { normalizeWebsiteUrl as normalizeWebsite } from "@/lib/website-url";

function useFirebaseStore(): boolean {
  return getStorageProvider() === "firebase" && isFirebaseReady();
}

function userDir(userId: string) {
  return path.join(process.cwd(), "data", "users", userId);
}

function listingDir(userId: string) {
  return path.join(userDir(userId), "listing");
}

function listingPath(userId: string) {
  return path.join(userDir(userId), "listing.json");
}

function listingPhotoSubpath(filename: string) {
  return `listing/${filename}`;
}

function normalizeListing(data: UserListing & { photos?: string[] }): UserListing {
  const rawPhotos = data.photos ?? [];
  let coverPhoto = data.coverPhoto ?? null;
  let logoPhoto = data.logoPhoto ?? null;
  let photos = rawPhotos;

  if (!coverPhoto && !logoPhoto && rawPhotos.length > 0 && data.coverPhoto === undefined) {
    coverPhoto = rawPhotos[0];
    photos = rawPhotos.slice(1);
  }

  return { ...data, coverPhoto, logoPhoto, photos };
}

function readUserListingLocal(userId: string): UserListing | null {
  try {
    const fp = listingPath(userId);
    if (!fs.existsSync(fp)) return null;
    const data = JSON.parse(fs.readFileSync(fp, "utf-8")) as UserListing;
    return normalizeListing(data);
  } catch {
    return null;
  }
}

export async function readUserListing(userId: string): Promise<UserListing | null> {
  if (useFirebaseStore()) {
    const listing = await firebaseListings.readListing(userId);
    return listing ? normalizeListing(listing) : null;
  }
  return readUserListingLocal(userId);
}

export async function writeUserListing(
  userId: string,
  data: Omit<UserListing, "userId" | "updatedAt" | "coverPhoto" | "logoPhoto" | "photos"> & {
    coverPhoto?: string | null;
    logoPhoto?: string | null;
    photos?: string[];
  },
) {
  const existing = await readUserListing(userId);
  const listing: UserListing = {
    ...data,
    coverPhoto: data.coverPhoto ?? existing?.coverPhoto ?? null,
    logoPhoto: data.logoPhoto ?? existing?.logoPhoto ?? null,
    photos: data.photos ?? existing?.photos ?? [],
    userId,
    updatedAt: new Date().toISOString(),
  };

  if (useFirebaseStore()) {
    return firebaseListings.writeListing(listing);
  }

  const dir = userDir(userId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(listingPath(userId), JSON.stringify(listing, null, 2), "utf-8");
  return listing;
}

export async function deleteUserListing(userId: string) {
  if (useFirebaseStore()) {
    await firebaseListings.deleteListing(userId);
    return;
  }

  const fp = listingPath(userId);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  const dir = listingDir(userId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

export function listingPhotoPath(userId: string, filename: string) {
  return path.join(listingDir(userId), filename);
}

export async function readListingPhoto(
  userId: string,
  filename: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (useFirebaseStore()) {
    const buffer = await readUserFile(userId, listingPhotoSubpath(filename));
    if (!buffer) return null;
    return { buffer, mime: photoMime(filename) };
  }

  const filepath = listingPhotoPath(userId, filename);
  if (!fs.existsSync(filepath)) return null;
  return {
    buffer: fs.readFileSync(filepath),
    mime: photoMime(filepath),
  };
}

export async function listListingPhotos(userId: string) {
  const listing = await readUserListing(userId);
  return {
    coverPhoto: listing?.coverPhoto ?? null,
    logoPhoto: listing?.logoPhoto ?? null,
    photos: listing?.photos ?? [],
    maxGalleryPhotos: MAX_GALLERY_PHOTOS,
  };
}

export function photoMime(filepath: string) {
  const ext = path.extname(filepath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

async function saveListing(listing: UserListing) {
  if (useFirebaseStore()) {
    await firebaseListings.writeListing(listing);
    return;
  }
  fs.writeFileSync(listingPath(listing.userId), JSON.stringify(listing, null, 2), "utf-8");
}

async function writeImageFile(userId: string, buffer: Buffer, mime: string, prefix: string) {
  const ext = mime === "image/jpeg" ? ".jpg" : mime === "image/webp" ? ".webp" : ".png";
  const filename = `${prefix}-${Date.now()}${ext}`;

  if (useFirebaseStore()) {
    await saveUserFile(userId, listingPhotoSubpath(filename), buffer, mime);
    return filename;
  }

  const dir = listingDir(userId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return filename;
}

async function deleteImageFile(userId: string, filename: string | null) {
  if (!filename) return;
  if (useFirebaseStore()) {
    await deleteUserFile(userId, listingPhotoSubpath(filename));
    return;
  }
  const fp = listingPhotoPath(userId, filename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

function listingUsesFile(listing: UserListing, filename: string) {
  return (
    listing.coverPhoto === filename ||
    listing.logoPhoto === filename ||
    listing.photos.includes(filename)
  );
}

async function syncListingLogoToEmailLogo(userId: string, listingLogoFilename: string) {
  const photo = await readListingPhoto(userId, listingLogoFilename);
  if (!photo) return;
  await saveUserLogo(userId, photo.buffer, photo.mime);
}

export async function addListingPhoto(
  userId: string,
  buffer: Buffer,
  mime: string,
  kind: ListingPhotoKind,
) {
  const listing = await readUserListing(userId);
  if (!listing) throw new Error("Save your store details first");

  if (kind === "gallery" && listing.photos.length >= MAX_GALLERY_PHOTOS) {
    throw new Error(`Maximum ${MAX_GALLERY_PHOTOS} gallery photos`);
  }

  const prefix = kind === "cover" ? "cover" : kind === "logo" ? "logo" : "photo";
  const filename = await writeImageFile(userId, buffer, mime, prefix);

  if (kind === "cover") {
    await deleteImageFile(userId, listing.coverPhoto);
    listing.coverPhoto = filename;
  } else if (kind === "logo") {
    await deleteImageFile(userId, listing.logoPhoto);
    listing.logoPhoto = filename;
    await syncListingLogoToEmailLogo(userId, filename);
  } else {
    listing.photos.push(filename);
  }

  await saveListing(listing);
  return filename;
}

export async function setLogoFromGallery(userId: string, filename: string) {
  const listing = await readUserListing(userId);
  if (!listing) throw new Error("Save your store details first");
  if (!listing.photos.includes(filename) && listing.coverPhoto !== filename) {
    throw new Error("Pick a photo from your cover or gallery");
  }
  listing.logoPhoto = filename;
  await syncListingLogoToEmailLogo(userId, filename);
  await saveListing(listing);
}

export async function clearListingLogo(userId: string) {
  const listing = await readUserListing(userId);
  if (!listing?.logoPhoto) return;
  const logo = listing.logoPhoto;
  listing.logoPhoto = null;
  if (!listingUsesFile({ ...listing, logoPhoto: null }, logo)) {
    await deleteImageFile(userId, logo);
  }
  await saveListing(listing);
}

export async function removeListingPhoto(
  userId: string,
  filename: string,
  kind?: ListingPhotoKind,
) {
  const listing = await readUserListing(userId);
  if (!listing) return;

  if (!kind || kind === "cover") {
    if (listing.coverPhoto === filename) listing.coverPhoto = null;
  }
  if (!kind || kind === "logo") {
    if (listing.logoPhoto === filename) listing.logoPhoto = null;
  }
  if (!kind || kind === "gallery") {
    listing.photos = listing.photos.filter((p) => p !== filename);
  }

  await saveListing(listing);
  if (!listingUsesFile(listing, filename)) {
    await deleteImageFile(userId, filename);
  }
}

async function loadAllPublishedListings(): Promise<UserListing[]> {
  if (useFirebaseStore()) {
    return firebaseListings.loadPublishedListings();
  }

  const { users } = readUsersFile();
  const out: UserListing[] = [];
  for (const user of users) {
    const listing = readUserListingLocal(user.id);
    if (listing?.published) out.push(listing);
  }
  return out;
}

function cityMatch(a: string, b: string) {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  return x.includes(y) || y.includes(x);
}

export async function searchListings(
  country: string,
  city: string,
  business_type: string,
): Promise<BusinessResult[]> {
  const published = await loadAllPublishedListings();
  return published
    .filter((l) => {
      if (l.countryCode.toLowerCase() !== country.toLowerCase()) return false;
      if (!cityMatch(l.city, city)) return false;
      if (business_type !== "all" && l.businessType !== business_type) return false;
      return true;
    })
    .map((l) => ({
      id: `mbl-listing-${l.userId}`,
      name: l.name,
      address: l.address,
      phone: l.phone,
      email: l.email,
      website: l.website ? normalizeWebsiteUrl(l.website) : "",
      storeUrl: `/store/${l.userId}?returnTo=${encodeURIComponent("/finder")}`,
      opening_hours: l.description,
      scrapeStatus: "skipped" as const,
      isListing: true,
      listingUserId: l.userId,
      city: l.city,
      countryName: l.country,
      businessType: l.businessType,
    }));
}

export { MAX_GALLERY_PHOTOS as MAX_PHOTOS };
