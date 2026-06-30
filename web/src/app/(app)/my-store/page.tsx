"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Image,
  MapPin,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { COUNTRIES } from "@/lib/countries";
import { BUSINESS_TYPES } from "@/lib/constants";
import type { ListingPhotoKind, UserListing } from "@/lib/listings";

const LocationMap = dynamic(
  () => import("@/components/store/LocationMap").then((m) => m.LocationMap),
  { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-xl bg-slate-100" /> },
);

const MAX_GALLERY = 6;

function PhotoSlot({
  label,
  filename,
  previewUrl,
  disabled,
  onUpload,
  onRemove,
}: {
  label: string;
  filename: string | null;
  previewUrl?: string;
  disabled?: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <div className="relative h-28 w-28">
        {previewUrl ? (
          <img src={previewUrl} alt={label} className="h-28 w-28 rounded-xl border object-cover" />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
            <Image className="h-6 w-6" />
          </div>
        )}
        {filename && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <label
        className={`inline-block cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
          disabled ? "cursor-not-allowed bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700"
        }`}
      >
        {filename ? "Replace" : "Upload"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

export default function MyStorePage() {
  const [form, setForm] = useState({
    name: "",
    businessType: "hair_salon",
    description: "",
    address: "",
    city: "",
    country: "",
    countryCode: "",
    lat: 0,
    lng: 0,
    phone: "",
    email: "",
    website: "",
    published: true,
  });
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [logoPhoto, setLogoPhoto] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [cities, setCities] = useState<string[]>([]);
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(false);
  const [listingSaved, setListingSaved] = useState(false);

  useEffect(() => {
    loadListing();
  }, []);

  useEffect(() => {
    if (!form.countryCode) {
      setCities([]);
      return;
    }
    fetch(`/api/cities/${form.countryCode}`)
      .then((r) => r.json())
      .then((data) => setCities(Array.isArray(data) ? data : []))
      .catch(() => setCities([]));
  }, [form.countryCode]);

  async function loadPhotoPreview(filename: string) {
    const res = await fetch(`/api/my-listing/photos/${encodeURIComponent(filename)}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const blob = await res.blob();
    setPhotoUrls((prev) => ({ ...prev, [filename]: URL.createObjectURL(blob) }));
  }

  async function loadAllPreviews(cover: string | null, logo: string | null, gallery: string[]) {
    const files = [cover, logo, ...gallery].filter(Boolean) as string[];
    await Promise.all(files.map(loadPhotoPreview));
  }

  async function loadListing() {
    const res = await fetch("/api/my-listing");
    if (!res.ok) return;
    const data = await res.json();
    if (data.listing) {
      const l = data.listing as UserListing;
      setForm({
        name: l.name,
        businessType: l.businessType,
        description: l.description,
        address: l.address,
        city: l.city,
        country: l.country,
        countryCode: l.countryCode,
        lat: l.lat,
        lng: l.lng,
        phone: l.phone,
        email: l.email,
        website: l.website,
        published: l.published,
      });
      setListingSaved(true);
    }
    setCoverPhoto(data.coverPhoto ?? null);
    setLogoPhoto(data.logoPhoto ?? null);
    setPhotos(Array.isArray(data.photos) ? data.photos : []);
    await loadAllPreviews(data.coverPhoto ?? null, data.logoPhoto ?? null, data.photos ?? []);
  }

  async function applyPhotoResponse(data: {
    coverPhoto?: string | null;
    logoPhoto?: string | null;
    photos?: string[];
  }) {
    if ("coverPhoto" in data) setCoverPhoto(data.coverPhoto ?? null);
    if ("logoPhoto" in data) setLogoPhoto(data.logoPhoto ?? null);
    if (Array.isArray(data.photos)) setPhotos(data.photos);
    await loadAllPreviews(
      data.coverPhoto ?? coverPhoto,
      data.logoPhoto ?? logoPhoto,
      data.photos ?? photos,
    );
  }

  async function uploadPhoto(file: File, kind: ListingPhotoKind) {
    if (!listingSaved) {
      setSaved("Save your store details first, then upload photos");
      return;
    }
    setLoading(true);
    setSaved("");
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch(`/api/my-listing/photos?kind=${kind}`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setSaved(data.error || "Upload failed");
        return;
      }
      await applyPhotoResponse(data);
      setSaved(kind === "cover" ? "Cover photo uploaded" : kind === "logo" ? "Logo uploaded" : "Photo added to gallery");
    } finally {
      setLoading(false);
    }
  }

  async function uploadGallery(files: FileList | null) {
    if (!files?.length) return;
    const remaining = MAX_GALLERY - photos.length;
    if (remaining <= 0) {
      setSaved(`Maximum ${MAX_GALLERY} gallery photos`);
      return;
    }
    for (const file of Array.from(files).slice(0, remaining)) {
      await uploadPhoto(file, "gallery");
    }
  }

  async function removePhoto(filename: string, kind: ListingPhotoKind) {
    const res = await fetch(
      `/api/my-listing/photos?file=${encodeURIComponent(filename)}&kind=${kind}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      const data = await res.json();
      await applyPhotoResponse(data);
      setPhotoUrls((prev) => {
        const next = { ...prev };
        if (next[filename]?.startsWith("blob:")) URL.revokeObjectURL(next[filename]);
        if (![data.coverPhoto, data.logoPhoto, ...(data.photos ?? [])].includes(filename)) {
          delete next[filename];
        }
        return next;
      });
    }
  }

  async function useImageAsLogo(filename: string) {
    const res = await fetch(`/api/my-listing/photos?useAsLogo=${encodeURIComponent(filename)}`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      await applyPhotoResponse(data);
      setSaved("Logo set from image");
    }
  }

  async function clearLogo() {
    const res = await fetch("/api/my-listing/photos?clearLogo=1", { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      await applyPhotoResponse(data);
      setSaved("Logo removed");
    }
  }

  async function saveListing() {
    setLoading(true);
    setSaved("");
    const res = await fetch("/api/my-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setListingSaved(true);
      setSaved(
        form.published
          ? "Store saved — visible in Finder. You can upload photos now."
          : "Store saved (unpublished)",
      );
    } else {
      setSaved(data.error || "Failed to save");
    }
  }

  async function removeStore() {
    if (!window.confirm("Remove your store listing?")) return;
    await fetch("/api/my-listing", { method: "DELETE" });
    setForm({
      name: "",
      businessType: "hair_salon",
      description: "",
      address: "",
      city: "",
      country: "",
      countryCode: "",
      lat: 0,
      lng: 0,
      phone: "",
      email: "",
      website: "",
      published: true,
    });
    setCoverPhoto(null);
    setLogoPhoto(null);
    setPhotos([]);
    setPhotoUrls({});
    setListingSaved(false);
    setSaved("Store removed");
  }

  const countryName = useMemo(
    () => COUNTRIES.find((c) => c.code === form.countryCode)?.name ?? form.country,
    [form.countryCode, form.country],
  );

  const logoPickOptions = [coverPhoto, ...photos].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/finder"
            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Finder
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[#1e1b4b]">My Store</h1>
          <p className="mt-1 text-slate-600">
            Create your business page with photos and map location — searchable in Finder.
          </p>
        </div>
        {listingSaved && form.published && (
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/store/me?returnTo=/my-store"
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              <ExternalLink className="h-4 w-4" />
              View my store page
            </Link>
            {form.website && (
              <a
                href={form.website.startsWith("http") ? form.website : `https://${form.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-700 underline decoration-emerald-200 underline-offset-2 hover:text-emerald-900"
              >
                {form.website.replace(/^https?:\/\/(www\.)?/i, "")}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="space-y-5 rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-xl">
        {/* form fields - same as before */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Business name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Business type</label>
            <select
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
            >
              {Object.entries(BUSINESS_TYPES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Country</label>
            <select
              value={form.countryCode}
              onChange={(e) => {
                const c = COUNTRIES.find((x) => x.code === e.target.value);
                setForm({
                  ...form,
                  countryCode: e.target.value,
                  country: c?.name ?? "",
                  city: "",
                  lat: 0,
                  lng: 0,
                  address: "",
                });
              }}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
            <select
              value={form.city}
              disabled={!form.countryCode}
              onChange={(e) =>
                setForm({ ...form, city: e.target.value, lat: 0, lng: 0, address: "" })
              }
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 disabled:opacity-50"
            >
              <option value="">Select city (map zooms here)</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              {form.city && !cities.includes(form.city) && (
                <option value={form.city}>{form.city}</option>
              )}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Business description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
              placeholder="Tell customers what you offer, your story, services…"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
            <MapPin className="h-4 w-4" />
            Location — pin on map
          </label>
          <LocationMap
            lat={form.lat}
            lng={form.lng}
            countryName={countryName}
            city={form.city}
            onLocationChange={(loc) => {
              setForm((f) => ({
                ...f,
                lat: loc.lat,
                lng: loc.lng,
                address: loc.address,
                city: loc.city || f.city,
                country: loc.country || f.country,
                countryCode: loc.countryCode || f.countryCode,
              }));
            }}
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Address (from map)</label>
              <input readOnly value={form.address} placeholder="Drop pin on map" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">City (from map)</label>
              <input readOnly value={form.city} placeholder="From map pin" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Website</label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://yourbusiness.com"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
            <p className="mt-1 text-xs text-slate-500">
              Shown in Finder (when visible) and on your store page
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 space-y-5">
          {!listingSaved && (
            <p className="text-xs text-amber-700">Save store details first to enable photo upload.</p>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Cover photo</h3>
            <p className="text-xs text-slate-500">Shown at the top of your store page</p>
            <div className="mt-3">
              <PhotoSlot
                label="Cover"
                filename={coverPhoto}
                previewUrl={coverPhoto ? photoUrls[coverPhoto] : undefined}
                disabled={!listingSaved || loading}
                onUpload={(file) => uploadPhoto(file, "cover")}
                onRemove={() => coverPhoto && removePhoto(coverPhoto, "cover")}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Logo (optional)</h3>
            <p className="text-xs text-slate-500">Shown on the top-left of your cover photo (optional)</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <PhotoSlot
                label="Logo"
                filename={logoPhoto}
                previewUrl={logoPhoto ? photoUrls[logoPhoto] : undefined}
                disabled={!listingSaved || loading}
                onUpload={(file) => uploadPhoto(file, "logo")}
                onRemove={() => (logoPhoto ? clearLogo() : undefined)}
              />
              {logoPickOptions.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">Or use existing image</p>
                  <select
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value=""
                    disabled={!listingSaved}
                    onChange={(e) => e.target.value && useImageAsLogo(e.target.value)}
                  >
                    <option value="">Pick image…</option>
                    {coverPhoto && <option value={coverPhoto}>Cover photo</option>}
                    {photos.map((f, i) => (
                      <option key={f} value={f}>Gallery photo {i + 1}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Gallery</h3>
                <p className="text-xs text-slate-500">Up to {MAX_GALLERY} extra photos</p>
              </div>
              <label
                className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                  photos.length >= MAX_GALLERY || !listingSaved
                    ? "cursor-not-allowed bg-slate-400"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                <Image className="mr-2 inline h-4 w-4" />
                Add photos
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  disabled={photos.length >= MAX_GALLERY || !listingSaved || loading}
                  onChange={(e) => uploadGallery(e.target.files)}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              {photos.length === 0 ? (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-400">
                  <Image className="h-6 w-6" />
                </div>
              ) : (
                photos.map((f, i) => (
                  <div key={f} className="relative">
                    {photoUrls[f] ? (
                      <img src={photoUrls[f]} alt={`Gallery ${i + 1}`} className="h-24 w-24 rounded-xl border object-cover" />
                    ) : (
                      <div className="h-24 w-24 animate-pulse rounded-xl bg-slate-200" />
                    )}
                    <button
                      type="button"
                      onClick={() => removePhoto(f, "gallery")}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="rounded border-slate-300 text-indigo-600" />
          Visible in Finder (store page + website link)
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={loading} onClick={saveListing} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            <Save className="h-4 w-4" />
            Save store
          </button>
          <button type="button" onClick={removeStore} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        </div>
        {saved && (
          <p className={`text-sm ${saved.includes("Failed") || saved.includes("Maximum") || saved.includes("first") ? "text-red-600" : "text-emerald-600"}`}>
            {saved}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
        <Building2 className="mr-2 inline h-4 w-4" />
        In Finder, your store page link and website URL (if set) are both shown as clickable links.
      </div>
    </div>
  );
}
