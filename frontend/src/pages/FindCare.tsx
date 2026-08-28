import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { MapView } from "@/components/findcare/MapView";
import { FacilityCard } from "@/components/findcare/FacilityCard";
import { SpecialtyChips } from "@/components/findcare/SpecialtyChips";
import { LocationControl, type RadiusKm } from "@/components/findcare/LocationControl";
import { TypeFilter } from "@/components/findcare/TypeFilter";
import { LoadError } from "@/components/LoadError";
import { getFacilities } from "@/services/facilities";
import { haversineKm } from "@/lib/geo";
import type { Facility, FacilityType } from "@/types";

export default function FindCare() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [facilityType, setFacilityType] = useState<FacilityType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radius, setRadius] = useState<RadiusKm | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [pinMode, setPinMode] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    getFacilities({
      lat: userLocation?.lat,
      lng: userLocation?.lng,
      radiusKm: radius ?? undefined,
    })
      .then((list) => {
        if (!active) return;
        setFacilities(list);
        setSelectedId((prev) => (prev && list.some((f) => f.id === prev) ? prev : list[0]?.id ?? null));
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [retryKey, userLocation, radius]);


  const specialties = useMemo(
    () => Array.from(new Set(facilities.map((f) => f.specialty).filter(Boolean))) as string[],
    [facilities],
  );

  const withDistance = useMemo(() => {
    if (!userLocation) return facilities;
    return facilities
      .map((f) => ({ ...f, distanceKm: haversineKm(userLocation, { lat: f.lat ?? 0, lng: f.lng ?? 0 }) }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [facilities, userLocation]);

  const filtered = useMemo(() => {
    let list = withDistance;
    if (specialty) list = list.filter((f) => f.specialty === specialty);
    if (facilityType) list = list.filter((f) => f.type === facilityType);
    if (radius) list = list.filter((f) => (f.distanceKm ?? 0) <= radius);
    return list;
  }, [withDistance, specialty, facilityType, radius]);

  function handleCaptureLocation() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError("Couldn't get your location — check browser permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function handleClearLocation() {
    setUserLocation(null);
    setLocationError(null);
  }

  function handlePinLocation(loc: { lat: number; lng: number }) {
    setUserLocation(loc);
    setLocationError(null);
    setPinMode(false);
  }

  return (
    <div className="flex h-dvh flex-col">
      <PageHeader eyebrow="Find Care" title="Nearby facilities" />

      <div className="flex flex-col gap-3 px-5 pt-5 sm:px-8">
        <SpecialtyChips specialties={specialties} active={specialty} onChange={setSpecialty} />
        <div className="flex flex-wrap items-center gap-2">
          <TypeFilter value={facilityType} onChange={setFacilityType} />
          <LocationControl
            hasLocation={!!userLocation}
            locating={locating}
            error={locationError}
            radius={radius}
            pinMode={pinMode}
            onCapture={handleCaptureLocation}
            onClear={handleClearLocation}
            onStartPinMode={() => setPinMode(true)}
            onCancelPinMode={() => setPinMode(false)}
            onRadiusChange={setRadius}
          />
        </div>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="order-2 min-h-[280px] flex-1 lg:order-1">
          <MapView
            facilities={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            userLocation={userLocation}
            pinMode={pinMode}
            onPinLocation={handlePinLocation}
          />
        </div>

        <div className="order-1 flex max-h-[45vh] w-full shrink-0 flex-col gap-2.5 overflow-y-auto border-b border-hairline px-5 py-4 sm:px-8 lg:order-2 lg:max-h-none lg:w-[340px] lg:border-b-0 lg:border-l">
          {loadError ? (
            <LoadError
              message="Couldn't load nearby facilities — the backend may be unreachable."
              onRetry={() => setRetryKey((k) => k + 1)}
            />
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-stone">
              No facilities match this filter yet.
            </p>
          ) : (
            filtered.map((f) => (
              <FacilityCard
                key={f.id}
                facility={f}
                selected={f.id === selectedId}
                onSelect={() => setSelectedId(f.id)}
                userLocation={userLocation}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
