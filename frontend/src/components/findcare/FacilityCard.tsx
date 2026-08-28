import { Navigation2 } from "lucide-react";
import type { Facility } from "@/types";

interface FacilityCardProps {
  facility: Facility;
  selected: boolean;
  onSelect: () => void;
  userLocation?: { lat: number; lng: number } | null;
}

export function FacilityCard({ facility, selected, onSelect, userLocation }: FacilityCardProps) {
  // A raw lat/lng destination lets Google Maps snap to whichever nearby
  // point of interest it considers more prominent (e.g. a hotel next door
  // to a hospital) rather than this specific place. Searching by name +
  // address instead makes Google resolve the actual named business.
  const params = new URLSearchParams({
    api: "1",
    destination: `${facility.name}, ${facility.address}`,
  });
  // Without an explicit origin, Google Maps resolves "Your location" on its
  // own — a separate permission grant from whatever this app has, or an
  // IP-based guess that can land in the wrong city entirely. We already
  // have an accurate, user-granted location from "Use my location" above;
  // pass it through so Google never has to guess.
  if (userLocation) {
    params.set("origin", `${userLocation.lat},${userLocation.lng}`);
  }
  const directionsUrl = `https://www.google.com/maps/dir/?${params.toString()}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "w-full rounded-xl border px-4 py-3.5 text-left transition-colors duration-150",
        selected
          ? "border-teal-deep bg-surface-card"
          : "border-hairline bg-surface-card hover:border-teal-deep/60",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-medium leading-snug text-ink">{facility.name}</p>
          <p className="mt-0.5 text-[12px] text-stone">{facility.address}</p>
        </div>
        <span className="shrink-0 font-mono text-[13px] text-ink">
          {(facility.distanceKm ?? facility.distance_km ?? 0).toFixed(1)} km
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-hairline bg-bg-mist px-2.5 py-1 text-[11px] text-stone">
            {facility.specialty}
          </span>
          <span
            className={[
              "text-[11px] font-mono",
              facility.openNow ? "text-teal-deep" : "text-stone",
            ].join(" ")}
          >
            {facility.openNow ? "Open now" : "Closed"}
          </span>
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-[12px] font-medium text-teal-deep hover:underline"
        >
          <Navigation2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          Directions
        </a>
      </div>
    </button>
  );
}
