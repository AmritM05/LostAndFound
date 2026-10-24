"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, ExternalLink, LoaderCircle } from "lucide-react";
import { campus } from "../lib/campus";
import { loadGoogleMaps, onMapsAuthFailure } from "../lib/googleMaps";
type Point = { lat: number; lng: number; name?: string };
const validPoint = (point?: Point) =>
  !!point &&
  Number.isFinite(point.lat) &&
  Number.isFinite(point.lng) &&
  Math.abs(point.lat) <= 90 &&
  Math.abs(point.lng) <= 180;
export default function CampusMap({
  value,
  onSelect,
}: {
  value?: Point;
  onSelect?: (point: Point) => void;
}) {
  const mapRef = useRef<any>(null),
    selectedMarker = useRef<any>(null),
    ref = useRef<HTMLDivElement>(null),
    callback = useRef(onSelect),
    currentValue = useRef(value);
  const [status, setStatus] = useState<"loading" | "error" | "ready">(
    "loading",
  );
  callback.current = onSelect;
  currentValue.current = value;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const mapId =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID";
  useEffect(() => {
    let cancelled = false,
      failed = false;
    const markers: any[] = [],
      listeners: any[] = [];
    let timeout: ReturnType<typeof setTimeout>;
    const fail = (reason: string) => {
      if (cancelled) return;
      failed = true;
      clearTimeout(timeout);
      console.error("[Magpie Maps]", reason);
      setStatus("error");
    };
    setStatus("loading");
    const unsubscribe = onMapsAuthFailure(() =>
      fail(
        "Google rejected authorization. Check your Cloud project configuration.",
      ),
    );
    if (!key || key === "your_google_maps_api_key_here") {
      fail(
        "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing. Set it in .env.local and restart/rebuild Next.js.",
      );
      return unsubscribe;
    }
    timeout = setTimeout(
      () =>
        fail(
          "Map tiles did not load. Check map ID, network access, API enablement, billing, and referrers.",
        ),
      25000,
    );
    loadGoogleMaps(key)
      .then(() => {
        if (cancelled || failed || !ref.current) return;
        const g = window.google.maps;
        const point = currentValue.current;
        const map = new g.Map(ref.current, {
          center: validPoint(point)
            ? { lat: point!.lat, lng: point!.lng }
            : campus.center,
          zoom: 15,
          mapId,
          disableDefaultUI: true,
          clickableIcons: false,
          zoomControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
        });
        mapRef.current = map;
        for (const building of campus.locations.filter(
          (b) => b.active !== false && validPoint(b),
        )) {
          const marker = new g.marker.AdvancedMarkerElement({
            map,
            position: { lat: building.lat, lng: building.lng },
            title: building.name,
            gmpClickable: true,
          });
          markers.push(marker);
          const handler = () => {
            callback.current?.({
              lat: building.lat,
              lng: building.lng,
              name: building.name,
            });
            map.panTo({ lat: building.lat, lng: building.lng });
          };
          marker.addEventListener("gmp-click", handler);
          listeners.push({
            remove: () => marker.removeEventListener("gmp-click", handler),
          });
        }
        listeners.push(
          map.addListener("click", (event: any) => {
            if (!event.latLng) return;
            const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
            if (validPoint(point)) callback.current?.(point);
          }),
        );
        listeners.push(
          g.event.addListenerOnce(map, "tilesloaded", () => {
            if (cancelled || failed) return;
            clearTimeout(timeout);
            setStatus("ready");
          }),
        );
      })
      .catch((error) =>
        fail(
          error instanceof Error
            ? error.message
            : "Maps initialization failed.",
        ),
      );
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsubscribe();
      listeners.forEach((listener) => listener.remove());
      markers.forEach((marker) => {
        marker.map = null;
      });
      if (selectedMarker.current) selectedMarker.current.map = null;
      selectedMarker.current = null;
      mapRef.current = null;
    };
  }, [key, mapId]);
  useEffect(() => {
    if (selectedMarker.current) selectedMarker.current.map = null;
    selectedMarker.current = null;
    if (status !== "ready" || !mapRef.current || !validPoint(value)) return;
    const position = { lat: value!.lat, lng: value!.lng };
    selectedMarker.current =
      new window.google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position,
        title: value!.name || "Selected location",
      });
    mapRef.current.panTo(position);
  }, [value?.lat, value?.lng, value?.name, status]);
  return (
    <div className="map-container" aria-busy={status === "loading"}>
      <div
        ref={ref}
        className={`google-map ${status === "error" ? "map-hidden" : ""}`}
        aria-label="Google Maps campus map"
      />
      {status !== "ready" && (
        <div className="map-message map-overlay" role="status">
          {status === "loading" ? (
            <LoaderCircle size={25} className="spin" />
          ) : (
            <MapPin size={28} />
          )}
          <h3>
            {status === "loading" ? "Loading Google Maps" : "Map unavailable"}
          </h3>
          <p>
            {status === "loading"
              ? "Loading campus locations…"
              : "You can still select a campus building or report the location as unknown."}
          </p>
          <a
            className="text-link"
            target="_blank"
            rel="noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${campus.center.lat},${campus.center.lng}`}
          >
            Open area in Google Maps
            <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  );
}
