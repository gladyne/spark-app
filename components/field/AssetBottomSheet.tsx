"use client";

import React from "react";
import { Asset } from "../../lib/offlineDb";
import { useOfflineStore, calculateDistance } from "../../hooks/useOfflineStore";

export default function AssetBottomSheet() {
  const { selectedAsset, userLocation, selectAsset } = useOfflineStore();

  if (!selectedAsset) return null;

  const lat = selectedAsset.latitude;
  const lng = selectedAsset.longitude;

  // Calculate distance to selected asset
  let distanceStr = "";
  if (userLocation) {
    const dist = calculateDistance(userLocation[0], userLocation[1], lat, lng);
    if (dist < 1000) {
      distanceStr = `${dist.toFixed(0)} m`;
    } else {
      distanceStr = `${(dist / 1000).toFixed(1)} km`;
    }
  }

  // Google Maps Deep Link
  const navigationLink = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  // Formatting type colors
  const getTypeBadgeStyles = (type: string) => {
    switch (type) {
      case "gardu":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "tiang TM":
        return "bg-slate-800 text-slate-100 border-slate-700";
      case "tiang TR":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "kabel TM":
        return "bg-red-100 text-red-800 border-red-200";
      case "kabel TR":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusBadgeStyles = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("exist")) {
      return "bg-gray-100 text-gray-700 border-gray-200";
    }
    if (s.includes("perluasan") || s.includes("rencana")) {
      return "bg-amber-100 text-amber-800 border-amber-200";
    }
    return "bg-sky-100 text-sky-800 border-sky-200";
  };

  // Extract non-standard properties for details list
  const ignoredProperties = [
    "id",
    "latitude",
    "longitude",
    "asset_type",
    "status",
    "geometry",
    "name",
    "description",
  ];
  const customProps = Object.entries(selectedAsset.properties).filter(
    ([key]) => !ignoredProperties.includes(key) && selectedAsset.properties[key] !== ""
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1000] bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] border-t border-gray-100 flex flex-col transition-all duration-300 max-h-[75vh]">
      {/* Drag handle line indicator for aesthetics */}
      <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto my-3" />

      {/* Header Panel */}
      <div className="px-5 pb-4 flex justify-between items-start border-b border-gray-100">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTypeBadgeStyles(selectedAsset.asset_type)}`}>
              {selectedAsset.asset_type.toUpperCase()}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadgeStyles(selectedAsset.status)}`}>
              {selectedAsset.status}
            </span>
            {distanceStr && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-200 bg-sky-50 text-sky-700 flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {distanceStr}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-gray-900 truncate">
            {selectedAsset.properties.name || selectedAsset.id}
          </h2>
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            ID: {selectedAsset.id}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={() => selectAsset(null)}
          className="w-10 h-10 -mr-2 -mt-1 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors touch-manipulation focus:outline-none"
          aria-label="Tutup"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content Details Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Geo Coords display */}
        <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Latitude</span>
            <div className="text-sm font-semibold text-gray-800 font-mono mt-0.5">{lat.toFixed(6)}</div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Longitude</span>
            <div className="text-sm font-semibold text-gray-800 font-mono mt-0.5">{lng.toFixed(6)}</div>
          </div>
        </div>

        {/* Custom attributes list */}
        {customProps.length > 0 ? (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Spesifikasi & Atribut</h3>
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden bg-white">
              {customProps.map(([key, val]) => (
                <div key={key} className="flex justify-between items-center py-2 px-3 text-xs">
                  <span className="text-gray-500 capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="font-semibold text-gray-800 text-right truncate max-w-[60%]">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-xs text-gray-400 py-2">
            Tidak ada spesifikasi tambahan untuk aset ini.
          </div>
        )}
      </div>

      {/* Navigation Button Footer Area */}
      <div className="p-5 bg-white border-t border-gray-100 flex flex-col gap-2 pb-6">
        <a
          href={navigationLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-12 bg-sky-600 active:bg-sky-700 hover:bg-sky-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors text-sm touch-manipulation"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          Navigasi ke sini (Google Maps)
        </a>
      </div>
    </div>
  );
}
