"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Store,
  X,
} from "lucide-react";
import { BUSINESS_TYPES } from "@/lib/constants";

interface StoreData {
  userId: string;
  name: string;
  businessType: string;
  description: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  coverPhoto: string | null;
  logoPhoto: string | null;
  photos: string[];
}

function StoreBackLink() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const href =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/finder";
  const label = href === "/my-store" ? "Back to My Store" : "Back to Finder";

  return (
    <Link
      href={href}
      className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}

function PhotoLightbox({
  images,
  index,
  onClose,
  onChange,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onChange(index - 1);
      if (e.key === "ArrowRight" && hasNext) onChange(index + 1);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [index, hasPrev, hasNext, onClose, onChange]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Full size photo"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(index - 1);
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-4"
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
      )}

      <img
        src={images[index]}
        alt=""
        className="max-h-[90vh] max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(index + 1);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-4"
          aria-label="Next photo"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      )}

      {images.length > 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">
          {index + 1} / {images.length}
        </p>
      )}
    </div>
  );
}

function StorePageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = params.userId === "me" ? null : String(params.userId);
  const [store, setStore] = useState<StoreData | null>(null);
  const [error, setError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      let id = userId;
      if (!id) {
        const me = await fetch("/api/auth/me", { credentials: "include" });
        if (!me.ok) {
          const next = `/store/me${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
          router.push(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        const meData = await me.json();
        id = meData?.user?.id;
        if (!id) {
          router.push("/login?next=/store/me");
          return;
        }
      }
      const res = await fetch(`/api/store/${id}`);
      if (!res.ok) {
        setError("Store not found or not published");
        return;
      }
      setStore(await res.json());
    }
    load();
  }, [userId, router, searchParams]);

  const viewablePhotos = useMemo(() => {
    if (!store) return [];
    return [store.coverPhoto, ...store.photos].filter(Boolean) as string[];
  }, [store]);

  const openLightbox = useCallback(
    (url: string) => {
      const idx = viewablePhotos.indexOf(url);
      if (idx >= 0) setLightboxIndex(idx);
    },
    [viewablePhotos],
  );

  if (error) {
    const returnTo = searchParams.get("returnTo") || "/finder";
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <Store className="mx-auto h-12 w-12 text-slate-300" />
        <p className="mt-4 text-slate-600">{error}</p>
        <Link href={returnTo} className="mt-4 inline-block text-indigo-600 hover:underline">
          Go back
        </Link>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  const typeLabel = BUSINESS_TYPES[store.businessType] || store.businessType;

  return (
    <div className="mx-auto max-w-2xl">
      <StoreBackLink />

      {lightboxIndex !== null && viewablePhotos.length > 0 && (
        <PhotoLightbox
          images={viewablePhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={setLightboxIndex}
        />
      )}

      <article className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-lg">
        <div className="relative">
          {store.coverPhoto ? (
            <button
              type="button"
              onClick={() => openLightbox(store.coverPhoto!)}
              className="block w-full cursor-zoom-in"
              aria-label="View cover photo full size"
            >
              <img src={store.coverPhoto} alt={store.name} className="h-56 w-full object-cover" />
            </button>
          ) : (
            <div className="flex h-40 items-center justify-center bg-gradient-to-br from-indigo-100 to-violet-100">
              <Store className="h-16 w-16 text-indigo-300" />
            </div>
          )}
          {store.logoPhoto && (
            <img
              src={store.logoPhoto}
              alt={`${store.name} logo`}
              className="pointer-events-none absolute left-4 top-4 h-16 w-16 rounded-xl border-2 border-white bg-white object-cover shadow-lg sm:h-20 sm:w-20"
            />
          )}
        </div>

        <div className="p-6">
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
            {typeLabel}
          </span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{store.name}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="h-4 w-4" />
            {store.address || `${store.city}, ${store.country}`}
          </p>

          {store.description && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <h2 className="text-sm font-semibold text-slate-900">About</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {store.description}
              </p>
            </div>
          )}

          {(store.phone || store.email || store.website) && (
            <div className={`flex flex-wrap gap-3 ${store.description ? "mt-4" : "mt-6"}`}>
              {store.phone && (
                <a href={`tel:${store.phone}`} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                  <Phone className="h-4 w-4" />
                  Call
                </a>
              )}
              {store.email && (
                <a href={`mailto:${store.email}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Mail className="h-4 w-4" />
                  Email
                </a>
              )}
              {store.website && (
                <a
                  href={store.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  <ExternalLink className="h-4 w-4" />
                  Visit website
                </a>
              )}
            </div>
          )}

          {store.photos.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Gallery</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {store.photos.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => openLightbox(url)}
                    className="cursor-zoom-in overflow-hidden rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    aria-label="View photo full size"
                  >
                    <img src={url} alt="" className="aspect-square w-full object-cover transition hover:scale-105" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

export default function StorePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      }
    >
      <StorePageContent />
    </Suspense>
  );
}
