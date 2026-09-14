"use client";
import { useState, useRef, useEffect } from "react";

const TOMTOM_KEY = "MxrjvKJ4xSEs7YgXLwRdYEp4nFoGRJMB";

const iconMap: Record<string, string> = {
  cafe: "☕", restaurant: "🍽️", bar: "🍺", fast_food: "🍟", food_court: "🍱",
  shop: "🏪", supermarket: "🛒", mall: "🏬",
  school: "🏫", university: "🎓", hospital: "🏥", clinic: "🏨",
  pharmacy: "💊", fuel: "⛽", parking: "🅿️", bank: "🏦", atm: "💳",
  mosque: "🕌", church: "⛪", temple: "🛕",
  road: "🛣️", bus_stop: "🚌", station: "🚉", airport: "✈️",
  natural: "🌿", park: "🌳", beach: "🏖️", tourism: "📸", hotel: "🏨",
  building: "🏢", residential: "🏘️", village: "🏡",
  town: "🏙️", city: "🌆", place: "📍",
};

export function parseSearchResult(r: any) {
  const mainName = r.name || r.display_name.split(",")[0];
  const secondary = r.display_name.split(",").slice(1, 4).map((s: string) => s.trim()).filter(Boolean).join(", ");
  const icon = iconMap[r.type] || iconMap[r.class] || "📍";
  return { mainName, secondary, icon };
}

export interface SearchPin {
  lat: number;
  lng: number;
  displayName: string;
  name: string;
  secondary?: string;
  type?: string;
}

export function useSearch(mapCenterRef: React.MutableRefObject<[number, number]>) {
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeResultIdx, setActiveResultIdx] = useState(-1);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [flyZoom, setFlyZoom] = useState<number>(16);
  const [searchPin, setSearchPin] = useState<SearchPin | null>(null);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed.length < 2) { setSearchResults([]); setActiveResultIdx(-1); return; }
    const parts = trimmed.split(/[\s,]+/).filter(Boolean);
    if (parts.length >= 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [biasLat, biasLng] = mapCenterRef.current;
        const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(trimmed)}.json`
          + `?key=${TOMTOM_KEY}&limit=6&lat=${biasLat}&lon=${biasLng}&radius=50000&language=id-ID&countrySet=ID&idxSet=POI,PAD,Str,Xstr,Geo,Addr`;
        const res = await fetch(url);
        const data = await res.json();
        const results = (data.results || []).map((r: any) => {
          const pos = r.position || {};
          const addr = r.address || {};
          const poi = r.poi || {};
          const name = poi.name || addr.streetName || addr.municipality || r.type;
          const addrParts = [
            addr.streetName && addr.streetNumber ? `${addr.streetName} No. ${addr.streetNumber}` : addr.streetName,
            addr.municipalitySubdivision || addr.neighbourhood,
            addr.municipality,
            addr.countrySubdivision,
          ].filter(Boolean);
          const cat = poi.categories?.[0] || r.type || "place";
          return {
            lat: String(pos.lat), lon: String(pos.lon),
            display_name: [name, ...addrParts].filter(Boolean).join(", "),
            name, address: { road: addr.streetName, city: addr.municipality },
            type: cat.toLowerCase().replace(/\s+/g, "_"), class: "tomtom",
            place_id: r.id || `tt_${pos.lat}_${pos.lon}`,
          };
        }).filter((r: any) => r.lat && r.lon && r.name);
        setSearchResults(results);
        setActiveResultIdx(-1);
      } catch { setSearchResults([]); } finally { setIsSearching(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSelectLocation = (lat: string | number, lon: string | number, displayName: string, resultType?: string) => {
    const latNum = parseFloat(String(lat));
    const lonNum = parseFloat(String(lon));
    setFlyTarget([latNum, lonNum]);
    
    const parts = displayName.split(",");
    const mainName = parts[0]?.trim() || displayName;
    const secondary = parts.slice(1, 4).map((s: string) => s.trim()).filter(Boolean).join(", ");

    setSearchPin({
      lat: latNum,
      lng: lonNum,
      displayName,
      name: mainName,
      secondary,
      type: resultType,
    });

    setSearchInput(mainName);
    setSearchResults([]); setSearchFocused(false); setActiveResultIdx(-1);
    const t = (resultType || "").toLowerCase();
    if (t.includes("country")) setFlyZoom(6);
    else if (t.includes("state") || t.includes("province")) setFlyZoom(9);
    else if (t.includes("municipality") || t.includes("city")) setFlyZoom(12);
    else if (t.includes("neighbourhood") || t.includes("district")) setFlyZoom(14);
    else if (t.includes("street") || t.includes("road")) setFlyZoom(16);
    else setFlyZoom(18);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchResults.length) {
      if (e.key === "Enter") {
        const parts = searchInput.split(/[\s,]+/).filter(Boolean);
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]); const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            setFlyTarget([lat, lng]);
            setSearchPin({
              lat,
              lng,
              displayName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
              name: "Titik Koordinat",
              secondary: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            });
            setSearchResults([]); setSearchFocused(false); return;
          }
        }
        if (searchResults.length > 0) handleSelectLocation(searchResults[0].lat, searchResults[0].lon, searchResults[0].display_name, searchResults[0].type);
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveResultIdx(i => Math.min(i + 1, searchResults.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveResultIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const target = activeResultIdx >= 0 ? searchResults[activeResultIdx] : searchResults[0];
      if (target) handleSelectLocation(target.lat, target.lon, target.display_name, target.type);
    } else if (e.key === "Escape") { setSearchResults([]); setSearchFocused(false); }
  };

  const clearSearchPin = () => {
    setSearchPin(null);
  };

  return {
    searchInput, setSearchInput, searchResults, isSearching,
    searchFocused, setSearchFocused, activeResultIdx, setActiveResultIdx,
    flyTarget, setFlyTarget, flyZoom, setFlyZoom,
    handleSelectLocation, handleSearchKeyDown,
    searchPin, setSearchPin, clearSearchPin,
  };
}
