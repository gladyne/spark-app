"use client";

import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Asset } from "../../lib/offlineDb";
import { useOfflineStore } from "../../hooks/useOfflineStore";

import "leaflet/dist/leaflet.css";

// Fix default leaflet icon issues in SSR/Next.js
const fixLeafletIcons = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  });
};

import { ASSET_COLORS, getPoleStyle } from "../../lib/assetStyles";

// Custom SVG Icons for Assets
const createAssetIcon = (type: string, status: string, isSelected: boolean, properties?: Record<string, any>) => {
  let color = "#6b7280"; // gray fallback
  let html = "";
  const borderSize = isSelected ? `3px solid ${ASSET_COLORS.SELECTED.stroke}` : "2px solid white";
  const shadow = isSelected ? `box-shadow: 0 0 10px ${ASSET_COLORS.SELECTED.stroke}, 0 4px 6px rgba(0,0,0,0.3)` : "box-shadow: 0 2px 4px rgba(0,0,0,0.3)";

  if (type === "gardu") {
    // Transformer substation (purple triangle symbol)
    color = ASSET_COLORS.GARDU.primary;
    html = `<div style="
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${ASSET_COLORS.GARDU.bg};
      border: ${borderSize};
      border-radius: 4px;
      ${shadow};
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round">
        <polygon points="12,2 2,22 22,22" fill="${ASSET_COLORS.GARDU.fill}" />
      </svg>
    </div>`;
  } else if (type === "tiang TM" || type === "tiang TR" || type.toLowerCase().includes("tiang")) {
    const isExisting = status?.toLowerCase() === "existing";
    const material = properties?.material || properties?.tipe || "Beton";
    const poleStyle = getPoleStyle({
      material,
      isExisting,
      size: type === "tiang TM" ? 18 : 16,
    });
    html = `<div style="
      width: ${poleStyle.size}px;
      height: ${poleStyle.size}px;
      background: ${poleStyle.bg};
      border: ${poleStyle.borderWidth}px solid ${poleStyle.border};
      border-radius: 50%;
      ${isSelected ? `outline: 3px solid ${ASSET_COLORS.SELECTED.stroke};` : ""}
      ${shadow};
    "></div>`;
  } else {
    // Fallback point asset
    color = "#4b5563";
    html = `<div style="
      width: 14px;
      height: 14px;
      background: ${color};
      border: ${borderSize};
      border-radius: 50%;
      ${shadow};
    "></div>`;
  }

  return L.divIcon({
    html: html,
    className: "custom-asset-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Pulsing User GPS Position Icon
const userGpsIcon = L.divIcon({
  html: `
    <div class="gps-pulse-marker">
      <div class="gps-pulse-ring"></div>
    </div>
  `,
  className: "custom-gps-icon",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Helper component to fly the map to coordinates
function MapRecenter({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, map.getZoom() || 16, { animate: true, duration: 1.5 });
    }
  }, [coords, map]);
  return null;
}

// Map Event Listener for clear click
function MapClickHandler() {
  const { selectAsset } = useOfflineStore();
  useMapEvents({
    click() {
      selectAsset(null);
    },
  });
  return null;
}

interface FieldMapProps {
  recenterTrigger: number;
}

export default function FieldMap({ recenterTrigger }: FieldMapProps) {
  const { assets, selectedAsset, userLocation, selectAsset, setUserLocation } = useOfflineStore();
  const [mapReady, setMapReady] = useState(false);
  const [viewMode, setViewMode] = useState<"peta" | "satelit">("peta");
  const locationWatchId = useRef<number | null>(null);

  useEffect(() => {
    fixLeafletIcons();
    setMapReady(true);

    const startWatching = (highAccuracy: boolean) => {
      if (typeof window === "undefined" || !navigator.geolocation) return;

      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }

      locationWatchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          console.warn(`GPS Geolocation warning (highAccuracy=${highAccuracy}):`, error.message);
          
          // Fallback if high accuracy failed and we haven't tried low accuracy yet
          if (highAccuracy && (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT)) {
            console.log("Retrying GPS tracking with enableHighAccuracy=false...");
            startWatching(false);
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 8000 : 15000,
          maximumAge: 10000,
        }
      );
    };

    startWatching(true);

    return () => {
      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, []);

  // Handle center zoom based on assets when loaded
  const InitialBoundsHandler = () => {
    const map = useMap();
    useEffect(() => {
      if (assets.length > 0) {
        const points = assets.map((a) => L.latLng(a.latitude, a.longitude));
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40] });
      } else if (userLocation) {
        map.setView(userLocation, 16);
      }
    }, [assets, map]);
    return null;
  };

  if (!mapReady) return null;

  // Render Polylines and Markers
  return (
    <div className="w-full h-full relative">
      <style>{`
        .gps-pulse-marker {
          position: relative;
        }
        .gps-pulse-marker::after {
          content: '';
          width: 14px;
          height: 14px;
          background-color: #0284c7;
          border: 2px solid white;
          border-radius: 50%;
          position: absolute;
          top: -7px;
          left: -7px;
          box-shadow: 0 0 6px rgba(2, 132, 199, 0.6);
        }
        .gps-pulse-ring {
          border: 3px solid #0284c7;
          border-radius: 30px;
          height: 30px;
          width: 30px;
          position: absolute;
          left: -15px;
          top: -15px;
          animation: pulse-animation 2s ease-out infinite;
          opacity: 0;
        }
        @keyframes pulse-animation {
          0% {
            transform: scale(0.1);
            opacity: 0.8;
          }
          70% {
            opacity: 0.3;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }
        /* Custom Tap Target Sizes for Leaflet components */
        .leaflet-interactive {
          cursor: pointer;
        }
      `}</style>

      <MapContainer
        center={[-6.2, 106.81]} // Jakarta default center if nothing exists
        zoom={13}
        className="w-full h-full"
        zoomControl={false} // Disable to put controls in cleaner mobile layout
      >
        {viewMode === "satelit" ? (
          <>
            <TileLayer
              key="satelit"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
            />
            <TileLayer
              key="satelit-labels"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              attribution="Labels &copy; Esri"
              zIndex={10}
            />
          </>
        ) : (
          <TileLayer
            key="peta"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
        )}

        {/* Recenter Map Action */}
        {recenterTrigger > 0 && userLocation && <MapRecenter coords={userLocation} />}

        {/* Fit Bounds on load */}
        <InitialBoundsHandler />

        {/* Clear selection when clicking map blank areas */}
        <MapClickHandler />

        {/* User Current GPS Location */}
        {userLocation && (
          <Marker position={userLocation} icon={userGpsIcon} zIndexOffset={1000} />
        )}

        {/* Render Assets */}
        {assets.map((asset) => {
          const isSelected = selectedAsset?.id === asset.id;

          // 1. LineString Asset (Kabel)
          if (asset.geometry?.type === "LineString") {
            const isTM = asset.asset_type === "kabel TM";
            const color = isTM ? ASSET_COLORS.KABEL_TM.stroke : ASSET_COLORS.KABEL_TR.stroke; // Red for TM, Green for TR
            const coords = asset.geometry.coordinates as [number, number][];
            const leafletCoords = coords.map((c) => [c[1], c[0]] as [number, number]);

            return (
              <React.Fragment key={asset.id}>
                {/* Visual Polyline */}
                <Polyline
                  positions={leafletCoords}
                  pathOptions={{
                    color: isSelected ? ASSET_COLORS.SELECTED.stroke : color,
                    weight: isSelected ? 7 : 4,
                    opacity: 0.85,
                  }}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      selectAsset(asset);
                    },
                  }}
                />
                {/* Thick Invisible Polyline helper for easier mobile tap target */}
                <Polyline
                  positions={leafletCoords}
                  pathOptions={{
                    color: "transparent",
                    weight: 22,
                  }}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      selectAsset(asset);
                    },
                  }}
                />
              </React.Fragment>
            );
          }

          // 2. Point Asset (Tiang, Gardu)
          return (
            <Marker
              key={asset.id}
              position={[asset.latitude, asset.longitude]}
              icon={createAssetIcon(asset.asset_type, asset.status, isSelected, asset.properties)}
              zIndexOffset={isSelected ? 500 : 100}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  selectAsset(asset);
                },
              }}
            />
          );
        })}
      </MapContainer>

      {/* Satellite Toggle Button */}
      <button
        onClick={() => setViewMode((prev) => (prev === "peta" ? "satelit" : "peta"))}
        className={`absolute bottom-20 right-6 z-[999] w-12 h-12 rounded-full shadow-lg flex flex-col items-center justify-center border touch-manipulation focus:outline-none transition-all duration-200 ${
          viewMode === "satelit"
            ? "bg-slate-800 border-slate-700 text-sky-400"
            : "bg-white border-gray-100 text-slate-700 hover:bg-gray-50 active:bg-gray-100"
        }`}
        title={viewMode === "peta" ? "Aktifkan Citra Satelit" : "Aktifkan Peta Jalan"}
      >
        <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L12 7.5l4.179 2.25m-11.142 4.5L12 16.5l4.179-2.25m1.192-2.25l4.179 2.25m-4.179-2.25l-5.571 3-5.571-3" />
        </svg>
        <span className="text-[7.5px] font-bold uppercase tracking-wider mt-0.5 leading-none">
          {viewMode === "peta" ? "Peta" : "Satelit"}
        </span>
      </button>
    </div>
  );
}
