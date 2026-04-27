"use client";
import { useMapEvents } from "react-leaflet";

interface Props { centerRef: React.MutableRefObject<[number, number]>; }

export default function MapCenterTracker({ centerRef }: Props) {
  const map = useMapEvents({
    moveend: () => { const c = map.getCenter(); centerRef.current = [c.lat, c.lng]; },
    zoomend: () => { const c = map.getCenter(); centerRef.current = [c.lat, c.lng]; },
  });
  return null;
}
