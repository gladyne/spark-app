"use client";
import { useMapEvents } from "react-leaflet";

interface Props {
  mode: "start" | "end" | null;
  setMode: (m: "start" | "end" | null) => void;
  editMode: string | null;
  handleMapClickForInsert: (latlng: any) => void;
  onSnapClick: (lat: number, lng: number, which: "start" | "end") => void;
}

export default function MapClickHandler({ mode, setMode, editMode, handleMapClickForInsert, onSnapClick }: Props) {
  useMapEvents({
    click(e) {
      if (mode === "start") { onSnapClick(e.latlng.lat, e.latlng.lng, "start"); setMode(null); }
      else if (mode === "end") { onSnapClick(e.latlng.lat, e.latlng.lng, "end"); setMode(null); }
      else if (editMode === "insert") { handleMapClickForInsert(e.latlng); }
    },
  });
  return null;
}
