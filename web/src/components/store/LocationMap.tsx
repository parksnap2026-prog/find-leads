"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface LocationMapProps {
  lat: number;
  lng: number;
  countryName: string;
  city: string;
  onLocationChange: (loc: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    country: string;
    countryCode: string;
  }) => void;
}

function MapFlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const prev = useRef("");

  useEffect(() => {
    const key = `${center[0]},${center[1]},${zoom}`;
    if (prev.current === key) return;
    prev.current = key;
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);

  return null;
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

async function reverseGeocode(lat: number, lng: number) {
  const res = await fetch(`/api/geocode?lat=${lat}&lon=${lng}`);
  if (!res.ok) return null;
  return res.json() as Promise<{
    address: string;
    shortAddress: string;
    city: string;
    country: string;
    countryCode: string;
  }>;
}

async function geocodeQuery(q: string) {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
  if (!res.ok) return null;
  return res.json() as Promise<{ lat: number; lng: number }>;
}

export function LocationMap({
  lat,
  lng,
  countryName,
  city,
  onLocationChange,
}: LocationMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]);
  const [mapZoom, setMapZoom] = useState(2);
  const [geocoding, setGeocoding] = useState(false);
  const pinReady = lat !== 0 && lng !== 0;

  useEffect(() => {
    if (!countryName) return;
    let cancelled = false;
    (async () => {
      const query = city ? `${city}, ${countryName}` : countryName;
      const z = city ? 12 : 5;
      const hit = await geocodeQuery(query);
      if (cancelled || !hit) return;
      setMapCenter([hit.lat, hit.lng]);
      setMapZoom(z);
    })();
    return () => {
      cancelled = true;
    };
  }, [countryName, city]);

  useEffect(() => {
    if (pinReady) {
      setMapCenter([lat, lng]);
      setMapZoom(16);
    }
  }, [lat, lng, pinReady]);

  async function pickLocation(pickedLat: number, pickedLng: number) {
    setMapCenter([pickedLat, pickedLng]);
    setMapZoom(16);
    setGeocoding(true);
    try {
      const geo = await reverseGeocode(pickedLat, pickedLng);
      if (!geo) return;
      onLocationChange({
        lat: pickedLat,
        lng: pickedLng,
        address: geo.shortAddress || geo.address,
        city: geo.city,
        country: geo.country,
        countryCode: geo.countryCode,
      });
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <MapContainer center={mapCenter} zoom={mapZoom} className="h-[320px] w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapFlyTo center={mapCenter} zoom={mapZoom} />
          {pinReady && (
            <Marker
              position={[lat, lng]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const ll = m.getLatLng();
                  pickLocation(ll.lat, ll.lng);
                },
              }}
            />
          )}
          <MapClickHandler onPick={pickLocation} />
        </MapContainer>
      </div>
      <p className="text-xs text-slate-500">
        Pick country, then city — the map zooms there. Click the map to drop your store pin.
        Address and city are filled from the pin.
        {geocoding && <span className="ml-1 text-indigo-600">Updating address…</span>}
      </p>
    </div>
  );
}
