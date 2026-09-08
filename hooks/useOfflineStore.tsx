"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { Asset, getAllAssets, saveAssets, clearAllAssets } from "../lib/offlineDb";

// Haversine formula for calculating distance in meters between two coordinates
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

interface OfflineStoreContextProps {
  assets: Asset[];
  selectedAsset: Asset | null;
  userLocation: [number, number] | null;
  isOffline: boolean;
  isSyncing: boolean;
  nearestAsset: Asset | null;
  distanceToNearest: number | null; // in meters
  loadAssets: () => Promise<void>;
  importAssets: (newAssets: Asset[]) => Promise<void>;
  clearAssets: () => Promise<void>;
  selectAsset: (asset: Asset | null) => void;
  setUserLocation: (loc: [number, number] | null) => void;
}

const OfflineStoreContext = createContext<OfflineStoreContextProps | undefined>(undefined);

export function OfflineStoreProvider({ children }: { children: React.ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [userLocation, setUserLocationState] = useState<[number, number] | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Monitor online status
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const loadAssets = useCallback(async () => {
    setIsSyncing(true);
    try {
      const data = await getAllAssets();
      setAssets(data);
    } catch (error) {
      console.error("Failed to load assets from IndexedDB:", error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Initial database load
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const importAssets = useCallback(async (newAssets: Asset[]) => {
    setIsSyncing(true);
    try {
      await saveAssets(newAssets);
      await loadAssets(); // Refresh from DB
    } catch (error) {
      console.error("Failed to save imported assets:", error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [loadAssets]);

  const clearAssets = useCallback(async () => {
    setIsSyncing(true);
    try {
      await clearAllAssets();
      setAssets([]);
      setSelectedAsset(null);
    } catch (error) {
      console.error("Failed to clear assets:", error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const selectAsset = useCallback((asset: Asset | null) => {
    setSelectedAsset(asset);
  }, []);

  const setUserLocation = useCallback((loc: [number, number] | null) => {
    setUserLocationState(loc);
  }, []);

  // Find nearest asset to user
  const { nearestAsset, distanceToNearest } = useMemo(() => {
    if (!userLocation || assets.length === 0) {
      return { nearestAsset: null, distanceToNearest: null };
    }

    let minDistance = Infinity;
    let closest: Asset | null = null;

    assets.forEach((asset) => {
      const dist = calculateDistance(
        userLocation[0],
        userLocation[1],
        asset.latitude,
        asset.longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        closest = asset;
      }
    });

    return {
      nearestAsset: closest,
      distanceToNearest: closest ? minDistance : null,
    };
  }, [userLocation, assets]);

  return (
    <OfflineStoreContext.Provider
      value={{
        assets,
        selectedAsset,
        userLocation,
        isOffline,
        isSyncing,
        nearestAsset,
        distanceToNearest,
        loadAssets,
        importAssets,
        clearAssets,
        selectAsset,
        setUserLocation,
      }}
    >
      {children}
    </OfflineStoreContext.Provider>
  );
}

export function useOfflineStore() {
  const context = useContext(OfflineStoreContext);
  if (!context) {
    throw new Error("useOfflineStore must be used within an OfflineStoreProvider");
  }
  return context;
}
