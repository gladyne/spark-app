"use client";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

interface Props { target: [number, number] | null; zoom?: number; }

export default function MapFlyTo({ target, zoom = 16 }: Props) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo(target, zoom, { duration: 1.5 }); }, [target, zoom, map]);
  return null;
}
