"use client";

import { useState, useRef, Fragment, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import * as turf from "@turf/turf";

import { useSearch } from "../hooks/useSearch";
import type { GarduConfig, SchoorConfig, NetworkLayer, Connection, SnapInfo, ConnectFirstState, JunctionInfo, DragSource, DragTarget } from "../types/spark";
import { haversineMeters } from "../lib/geo";
import { buildGarduSvg, buildSchoorSvg } from "../lib/svgUtils";

import MapClickHandler from "./map/MapClickHandler";
import MapFlyTo from "./map/MapFlyTo";
import MapCenterTracker from "./map/MapCenterTracker";
import SavedLayersRenderer from "./map/SavedLayersRenderer";

import GarduModal from "./modals/GarduModal";
import SchoorModal from "./modals/SchoorModal";
import KonstruksiModal from "./modals/KonstruksiModal";

import SearchBar from "./sidebar/SearchBar";
import ComponentPalette from "./sidebar/ComponentPalette";
import UndoRedoPanel from "./sidebar/UndoRedoPanel";
import AutoSchoorCard from "./sidebar/AutoSchoorCard";
import NetworkSettings from "./sidebar/NetworkSettings";
import TentikanTitikCard from "./sidebar/TentikanTitikCard";
import LayerManager from "./sidebar/LayerManager";
import ExecCard from "./sidebar/ExecCard";
import RekapModal from "./modals/RekapModal";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Konstanta untuk drag-to-connect
const ACTIVE_LAYER_ID = -1;
const ACTIVE_LAYER_LABEL = "Layer Aktif (Draft)";

// Helper universal untuk hitung konstruksi JTM
function getJtmConstruction(poles: [number, number][], idx: number): string {
  if (poles.length < 2) return "A1";
  const isLast = idx === poles.length - 1;
  let maxSpan = 0;
  if (idx < poles.length - 1) maxSpan = Math.max(maxSpan, haversineMeters(poles[idx][0], poles[idx][1], poles[idx + 1][0], poles[idx + 1][1]));
  if (idx > 0)               maxSpan = Math.max(maxSpan, haversineMeters(poles[idx][0], poles[idx][1], poles[idx - 1][0], poles[idx - 1][1]));
  if (maxSpan >= 70) return "B3";
  if (idx === 0 || isLast || (idx + 1) % 10 === 0) return "A3";
  if (idx > 0 && idx < poles.length - 1) {
    const b1 = turf.bearing(turf.point([poles[idx - 1][1], poles[idx - 1][0]]), turf.point([poles[idx][1], poles[idx][0]]));
    const b2 = turf.bearing(turf.point([poles[idx][1], poles[idx][0]]), turf.point([poles[idx + 1][1], poles[idx + 1][0]]));
    let diff = Math.abs(b2 - b1); if (diff > 180) diff = 360 - diff;
    if (diff > 30) return "2xA3";
    if (diff >= 10) return "A2";
  }
  return "A1";
}

// Hitung konstruksi JTM untuk tiang tertentu di layer tersimpan.
function computeJtmTypeForIndex(layer: NetworkLayer, idx: number): string {
  if (!layer.jenisJaringan.includes("SUTM")) return "";
  return getJtmConstruction(layer.poles, idx);
}

// Hitung tipe konstruksi otomatis (short) untuk sembarang layer tersimpan
function computeKonstruksiShort(layer: NetworkLayer, idx: number): string {
  const { jenisJaringan, poles } = layer;
  const isLast = idx === poles.length - 1;
  let angle = 0;
  if (idx > 0 && idx < poles.length - 1) {
    const b1 = turf.bearing(turf.point([poles[idx-1][1], poles[idx-1][0]]), turf.point([poles[idx][1], poles[idx][0]]));
    const b2 = turf.bearing(turf.point([poles[idx][1], poles[idx][0]]), turf.point([poles[idx+1][1], poles[idx+1][0]]));
    let diff = Math.abs(b2 - b1); if (diff > 180) diff = 360 - diff; angle = diff;
  }
  if (jenisJaringan.includes("SUTM")) return getJtmConstruction(poles, idx);
  if (jenisJaringan.includes("SKUTR") || jenisJaringan.includes("Underbuild")) {
    if (idx === 0) return "FDE";
    if (isLast) return "BDL+DE";
    if (angle > 15) return "LA";
    return "S";
  }
  if (jenisJaringan === "SKUTM") {
    if (idx === 0 || isLast) return "Trm";
    if (angle > 75) return "2xTrm";
    if (angle > 5) return "LA";
    return "S";
  }
  if (jenisJaringan === "SKTM" || jenisJaringan === "SKTR") {
    return idx === 0 || isLast ? "TRM" : "JNT";
  }
  return "";
}

type HistorySnapshot = {
  description: string;
  poles: [number,number][]; line: [number,number][];
  gardus: Record<number,GarduConfig>; schoors: Record<number,SchoorConfig>;
  konstruksiOverrides: Record<number,string>;
  savedLayers: NetworkLayer[]; junctions: JunctionInfo[];
};

export default function SparkMap() {
  // ─── Core state ───────────────────────────────────────────────────────────
  const mapRef = useRef<L.Map | null>(null);
  const [startPos, setStartPos] = useState<[number, number] | null>(null);
  const [endPos, setEndPos] = useState<[number, number] | null>(null);
  const [mode, setMode] = useState<"start" | "end" | null>(null);
  const [poles, setPoles] = useState<[number, number][]>([]);
  const [line, setLine] = useState<[number, number][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rawRoute, setRawRoute] = useState<any>(null);
  const [isEdited, setIsEdited] = useState(false);

  // ─── Edit modes ───────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState<"insert" | "delete" | "gardu" | "schoor" | "konstruksi" | null>(null);

  // ─── Gardu state ──────────────────────────────────────────────────────────
  const [gardus, setGardus] = useState<Record<number, GarduConfig>>({});
  const [selectedGarduIdx, setSelectedGarduIdx] = useState<number | null>(null);
  const [tempGardu, setTempGardu] = useState<GarduConfig>({ jenis: "Cantol", orientasi: "Horizontal", trafo: "100 kVA" });

  // ─── Schoor state ─────────────────────────────────────────────────────────
  const [schoors, setSchoors] = useState<Record<number, SchoorConfig>>({});
  const [selectedSchoorIdx, setSelectedSchoorIdx] = useState<number | null>(null);
  const [tempSchoor, setTempSchoor] = useState<SchoorConfig>({ jenis: "Treck" });

  // ─── Konstruksi override state ────────────────────────────────────────────
  const [konstruksiOverrides, setKonstruksiOverrides] = useState<Record<number, string>>({});
  const [selectedKonstruksiIdx, setSelectedKonstruksiIdx] = useState<number | null>(null);
  const [selectedKonstruksiSaved, setSelectedKonstruksiSaved] = useState<{ layerId: number; poleIdx: number } | null>(null);

  // ─── Auto schoor ──────────────────────────────────────────────────────────
  const [autoSchoor, setAutoSchoor] = useState(false);
  const [routingMode, setRoutingMode] = useState<"jalan" | "lurus">("jalan");
  const [autoSchoorThreshold, setAutoSchoorThreshold] = useState(15);
  const [rekapOpen, setRekapOpen] = useState(false);


  // ─── ETAP-style palette ───────────────────────────────────────────────────
  const [paletteSchoorJenis, setPaletteSchoorJenis] = useState<SchoorConfig["jenis"]>("Treck");
  const [paletteGarduJenis, setPaletteGarduJenis] = useState<GarduConfig["jenis"]>("Cantol");
  const [paletteGarduTrafo, setPaletteGarduTrafo] = useState("100 kVA");
  const [paletteGarduOrientasi, setPaletteGarduOrientasi] = useState<GarduConfig["orientasi"]>("Horizontal");

  // ─── Multi-layer state ────────────────────────────────────────────────────
  const [savedLayers, setSavedLayers] = useState<NetworkLayer[]>([]);
  const [layerCounter, setLayerCounter] = useState(1);
  const [activeEditLayerId, setActiveEditLayerId] = useState<number | null>(null);
  const [snapStart, setSnapStart] = useState<SnapInfo | null>(null);
  const [snapEnd, setSnapEnd] = useState<SnapInfo | null>(null);
  // Nama custom saat simpan layer (kosong = pakai nama default)
  const [saveName, setSaveName] = useState("");

  // ─── Connect networks ─────────────────────────────────────────────────────
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFirst, setConnectFirst] = useState<ConnectFirstState>(null);
  const [connectNotif, setConnectNotif] = useState<string | null>(null);

  // ─── Junction topologis ────────────────────────────────────────────────────
  const [junctions, setJunctions] = useState<JunctionInfo[]>([]);

  // ─── Group name overrides ─────────────────────────────────────────────────
  // Key = sorted layerIds joined by "-", value = nama grup kustom
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  // Layer IDs yang di-highlight saat mode group-edit aktif
  const [highlightedLayerIds, setHighlightedLayerIds] = useState<Set<number>>(new Set());

  // ─── History ──────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);
  const [undoLogOpen, setUndoLogOpen] = useState(false);

  // ─── Drag-to-connect state ────────────────────────────────────────────────
  const [dragSource, setDragSource] = useState<DragSource | null>(null);
  const [dragMousePos, setDragMousePos] = useState<[number, number] | null>(null);
  const [dragSnapTarget, setDragSnapTarget] = useState<DragTarget | null>(null);
  const didDragRef = useRef<boolean>(false);
  // ─── Pending drag-to-connect (delay resolves conflict with Leaflet native drag) ─
  const pendingDragConnRef = useRef<{ layerId: number; label: string; pos: [number,number]; poleIdx: number; isFromActiveLayer?: boolean } | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDragConn = useCallback((layerId: number, label: string, pos: [number, number], poleIdx: number, isFromActiveLayer?: boolean) => {
    setDragSource({ layerId, label, pos, poleIdx, isFromActiveLayer });
  }, []);

  /** Jadwalkan drag-to-connect setelah 200 ms.
   *  Jika Leaflet native `dragstart` terjadi lebih dulu, timer dibatalkan
   *  dan drag pole biasa (geser posisi) diizinkan berjalan. */
  const scheduleDragConn = useCallback((layerId: number, label: string, pos: [number,number], poleIdx: number, isFromActiveLayer?: boolean) => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingDragConnRef.current = { layerId, label, pos, poleIdx, isFromActiveLayer };
    pendingTimerRef.current = setTimeout(() => {
      const p = pendingDragConnRef.current;
      if (p) {
        setDragSource({ layerId: p.layerId, label: p.label, pos: p.pos, poleIdx: p.poleIdx, isFromActiveLayer: p.isFromActiveLayer });
        pendingDragConnRef.current = null;
      }
    }, 200);
  }, []);

  const cancelPendingDragConn = useCallback(() => {
    if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
    pendingDragConnRef.current = null;
  }, []);

  const captureSnapshot = (description: string): HistorySnapshot => ({
    description,
    poles: [...poles], line: [...line],
    gardus: { ...gardus }, schoors: { ...schoors },
    konstruksiOverrides: { ...konstruksiOverrides },
    savedLayers: savedLayers.map(l => ({ ...l, poles: [...l.poles], line: [...l.line], gardus: { ...l.gardus }, schoors: { ...l.schoors }, konstruksiOverrides: { ...(l.konstruksiOverrides ?? {}) } })),
    junctions: [...junctions],
  });
  const commitHistory = (desc: string) => {
    setHistory(prev => [...prev, captureSnapshot(desc)].slice(-30));
    setRedoStack([]);
  };
  const restoreSnapshot = (snap: HistorySnapshot) => {
    setPoles(snap.poles); setLine(snap.line);
    setGardus(snap.gardus); setSchoors(snap.schoors);
    setKonstruksiOverrides(snap.konstruksiOverrides);
    setSavedLayers(snap.savedLayers); setJunctions(snap.junctions);
  };
  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setRedoStack(prev => [...prev, captureSnapshot(last.description)].slice(-30));
    setHistory(prev => prev.slice(0, -1));
    restoreSnapshot(last);
  };
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, captureSnapshot(next.description)].slice(-30));
    setRedoStack(prev => prev.slice(0, -1));
    restoreSnapshot(next);
  };
  const handleJumpTo = (historyIdx: number) => {
    const target = history[historyIdx];
    if (!target) return;
    const current = captureSnapshot(target.description);
    // Semua entry setelah historyIdx jadi redo stack (urutan: terlama dulu)
    setRedoStack([current, ...history.slice(historyIdx + 1).reverse()].slice(-30));
    setHistory(history.slice(0, historyIdx));
    restoreSnapshot(target);
  };

  // ─── Callback: dua jaringan berhasil disambung ────────────────────────────
  // Dipanggil SavedLayersRenderer; menampilkan toast 2.5 detik lalu hilang
  const handleConnected = useCallback(() => {
    setConnectNotif("✅ Jaringan Berhasil Tersambung!");
    setTimeout(() => setConnectNotif(null), 2500);
  }, []);

  // ─── Callback: update rotasi schoor pada layer tersimpan ─────────────────
  const handleUpdateSchoorRotation = useCallback((layerId: number, poleIdx: number, rotation: number) => {
    setSavedLayers(prev => prev.map(layer =>
      layer.id !== layerId ? layer : {
        ...layer,
        schoors: { ...layer.schoors, [poleIdx]: { ...layer.schoors[poleIdx], rotation } },
      }
    ));
  }, []);

  // ─── Network settings ─────────────────────────────────────────────────────
  const [jenisJaringan, setJenisJaringan] = useState("SUTM");
  const [statusJaringan, setStatusJaringan] = useState("Perluasan");
  const [offsetSide, setOffsetSide] = useState(4);
  const [jarakGawang, setJarakGawang] = useState(50);
  const [tinggiTiang, setTinggiTiang] = useState(12);
  const [materialTiang, setMaterialTiang] = useState("Beton");

  const trafoOptions = ["25 kVA", "50 kVA", "100 kVA", "160 kVA", "200 kVA", "250 kVA", "315 kVA", "400 kVA", "630 kVA"];
  const isKabelTanah = jenisJaringan === "SKTM" || jenisJaringan === "SKTR";
  const [rotatingSchoor, setRotatingSchoor] = useState<{ poleIdx: number; cx: number; cy: number; } | null>(null);

  // ─── Callback: buat junction topologis ────────────────────────────────────
  // hostPole = tiang yang mempertahankan koordinat (menampilkan A3 indicator)
  // branchPole = tiang yang koordinatnya di-override ke host, disuppress dari render
  const handleCreateJunction = useCallback((
    hostLayerId: number, hostPoleIdx: number,
    branchLayerId: number, branchPoleIdx: number,
  ): void => {
    let hostCoord: [number, number] | undefined;
    let hostIsA2 = false;
    
    if (hostLayerId === ACTIVE_LAYER_ID) {
      hostCoord = poles[hostPoleIdx];
      if (jenisJaringan.includes("SUTM") && getJtmConstruction(poles, hostPoleIdx) === "A2") {
        hostIsA2 = true;
      }
    } else {
      const layer = savedLayers.find(l => l.id === hostLayerId);
      if (layer) {
        hostCoord = layer.poles[hostPoleIdx];
        if (computeJtmTypeForIndex(layer, hostPoleIdx) === "A2") hostIsA2 = true;
      }
    }

    if (!hostCoord) return;

    if (hostIsA2) {
      alert("Konstruksi A2 tidak disarankan menjadi sambungan. Pilih tiang A1 atau ujung A3."); //
      return;
    }

    // Override koordinat branch ke koordinat host yang sama persis
    if (branchLayerId === ACTIVE_LAYER_ID) {
      commitHistory("Sambung junction"); setIsEdited(true);
      const np = [...poles]; np[branchPoleIdx] = [hostCoord[0], hostCoord[1]];
      setPoles(np); setLine(np);
    } else {
      setSavedLayers(prev => prev.map(l => {
        if (l.id !== branchLayerId) return l;
        const newPoles = [...l.poles];
        newPoles[branchPoleIdx] = [hostCoord![0], hostCoord![1]];
        return { ...l, poles: newPoles, line: newPoles };
      }));
    }
    // Hapus junction lama untuk branch pole yang sama, lalu tambahkan yang baru
    setJunctions(prev => [
      ...prev.filter(j => !(j.branchLayerId === branchLayerId && j.branchPoleIdx === branchPoleIdx)),
      { id: Date.now(), hostLayerId, hostPoleIdx, branchLayerId, branchPoleIdx, hostCoord: [hostCoord![0], hostCoord![1]] },
    ]);
  }, [savedLayers, poles, jenisJaringan]);

  // ─── Search hook ──────────────────────────────────────────────────────────
  const mapCenterRef = useRef<[number, number]>([-0.7893, 113.9213]);
  const { searchInput, setSearchInput, searchResults, isSearching, searchFocused, setSearchFocused,
    activeResultIdx, setActiveResultIdx, flyTarget, setFlyTarget, flyZoom,
    handleSelectLocation, handleSearchKeyDown } = useSearch(mapCenterRef);

  // ─── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isKabelTanah) {
      setOffsetSide(0);
      // Hanya set default 500 jika nilai saat ini masih di range mode tiang (< 100)
      // Jika user sudah set ke nilai valid kabel tanah (>= 100), pertahankan
      setJarakGawang(prev => prev < 100 ? 500 : prev);
      return;
    }
    setTinggiTiang(prev => {
      if (jenisJaringan === "SKUTR") return 9;
      if (jenisJaringan === "SUTM Underbuild (3 Jaringan)") return prev < 13 ? 13 : prev;
      return prev === 9 ? 12 : prev;
    });
    // Saat switch dari kabel tanah (prev >= 100) ke mode tiang, reset ke default tiang
    setJarakGawang(prev => {
      const isShort = jenisJaringan === "SKUTR" || jenisJaringan === "SKUTM";
      if (prev >= 100) return isShort ? 40 : 50;
      return isShort ? 40 : (prev === 40 ? 50 : prev);
    });
  }, [jenisJaringan]);

  useEffect(() => {
    if (!rawRoute || isEdited) return;
    try {
      let finalRoute = rawRoute;
      if (offsetSide !== 0) {
        try { finalRoute = turf.lineOffset(rawRoute, offsetSide, { units: "meters" }); }
        catch (err) { console.warn("TurfJS offset gagal:", err); alert("Peringatan: Rute terlalu tajam, digambar di tengah as jalan."); finalRoute = rawRoute; }
      }
      const distanceKm = turf.length(finalRoute, { units: "kilometers" });
      const generatedPoles: [number, number][] = [];
      const poleDistance = jarakGawang / 1000;
      const minDistance = (jarakGawang * 0.4) / 1000;
      let lastPoleDistance = 0;
      for (let i = 0; i <= distanceKm; i += poleDistance) {
        const seg = turf.along(finalRoute, i, { units: "kilometers" });
        generatedPoles.push([seg.geometry.coordinates[1], seg.geometry.coordinates[0]] as [number, number]);
        lastPoleDistance = i;
      }
      const sisaJarak = distanceKm - lastPoleDistance;
      if (sisaJarak > 0.001) {
        if (sisaJarak < minDistance && generatedPoles.length > 1) generatedPoles.pop();
        const endSeg = turf.along(finalRoute, distanceKm, { units: "kilometers" });
        generatedPoles.push([endSeg.geometry.coordinates[1], endSeg.geometry.coordinates[0]] as [number, number]);
      }
      setPoles(generatedPoles); setLine(generatedPoles);
    } catch (e) { console.error("Gagal memperbarui rute reaktif", e); }
  }, [rawRoute, offsetSide, jarakGawang, isEdited]);

  useEffect(() => {
    if (!rotatingSchoor) return;

    if (mapRef.current) {
      mapRef.current.dragging.disable();
    }

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - rotatingSchoor.cx;
      const dy = e.clientY - rotatingSchoor.cy;
      let rawAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      const snapped = Math.round(((rawAngle % 360) + 360) % 360 / 5) * 5 % 360;
      
      setSchoors(prev => {
        const cur = prev[rotatingSchoor.poleIdx];
        if (!cur) return prev;
        return { ...prev, [rotatingSchoor.poleIdx]: { ...cur, rotation: snapped } };
      });
    };

    const onMouseUp = () => setRotatingSchoor(null);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      if (mapRef.current) mapRef.current.dragging.enable();
    };
  }, [rotatingSchoor]);

  useEffect(() => {
    if (selectedGarduIdx !== null) setTempGardu(gardus[selectedGarduIdx] || { jenis: "Cantol", orientasi: "Horizontal", trafo: "100 kVA" });
  }, [selectedGarduIdx, gardus]);

  useEffect(() => {
    if (selectedSchoorIdx !== null) setTempSchoor(schoors[selectedSchoorIdx] || { jenis: "Treck" });
  }, [selectedSchoorIdx, schoors]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => { const p: [number, number] = [pos.coords.latitude, pos.coords.longitude]; setFlyTarget(p); mapCenterRef.current = p; },
        err => console.warn("User menolak lokasi", err.message)
      );
    }
  }, []);

  // ─── Keyboard shortcuts: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z ─────────────────
  const undoRef = useRef(handleUndo);
  const redoRef = useRef(handleRedo);
  undoRef.current = handleUndo;
  redoRef.current = handleRedo;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey && !e.shiftKey && e.key === "z") { e.preventDefault(); undoRef.current(); }
      if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); redoRef.current(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ─── Spatial snap: dua fase ───────────────────────────────────────────────
  // Fase 1 — vertex (semua tiang, radius 15m, Haversine eksplisit)
  //   Mengembalikan koordinat PASTI dari poles[] bukan hasil interpolasi,
  //   sehingga titik baru benar-benar melebur ke satu koordinat yang sama persis.
  // Fase 2 — mid-line tee-off (radius 20m, hanya jika Fase 1 tidak menemukan)
  //   Snap ke proyeksi tegak-lurus pada segmen garis — berguna untuk cabang baru.
  // Fase 3 — fallback: kembalikan koordinat klik asli tanpa snap.
  const SNAP_NODE_M = 15;
  const SNAP_MIDLINE_M = 20;

  // findNearestNode: loop semua vertex (bukan hanya ujung) dengan Haversine eksplisit.
  // Memakai haversineMeters() — tidak melalui turf agar tidak ada konversi CRS/rounding.
  const findNearestNode = (
    clickLat: number, clickLng: number
  ): { pos: [number, number]; layerId: number; label: string; poleIdx: number } | undefined => {
    type NodeHit = { pos: [number, number]; layerId: number; label: string; poleIdx: number };
    let minDist = Infinity;
    let best: NodeHit | undefined;
    for (const layer of savedLayers) {
      for (let pi = 0; pi < layer.poles.length; pi++) {
        const pole = layer.poles[pi];
        const d = haversineMeters(clickLat, clickLng, pole[0], pole[1]);
        if (d <= SNAP_NODE_M && d < minDist) {
          minDist = d;
          best = { pos: [pole[0], pole[1]], layerId: layer.id, label: layer.label, poleIdx: pi };
        }
      }
    }
    return best;
  };

  const snapToNearestPoint = (clickLat: number, clickLng: number): { pos: [number, number]; info: SnapInfo | null } => {
    // Fase 1: vertex snap — koordinat pasti dari stored poles
    const node = findNearestNode(clickLat, clickLng);
    if (node) return { pos: node.pos, info: { layerId: node.layerId, label: node.label, poleIdx: node.poleIdx } };

    // Fase 2: mid-line snap — proyeksi ke segmen (cabang tee-off)
    const clickPt = turf.point([clickLng, clickLat]);
    let minMlDist = Infinity;
    type MlHit = { pos: [number, number]; layerId: number; label: string };
    let nearestMl: MlHit | undefined;
    for (const layer of savedLayers) {
      if (layer.line.length < 2) continue;
      try {
        const lineGeo = turf.lineString(layer.line.map(p => [p[1], p[0]]));
        const nearest = turf.nearestPointOnLine(lineGeo, clickPt, { units: "meters" });
        const d = nearest.properties.dist ?? Infinity;
        if (d <= SNAP_MIDLINE_M && d < minMlDist) {
          minMlDist = d;
          nearestMl = {
            pos: [nearest.geometry.coordinates[1], nearest.geometry.coordinates[0]],
            layerId: layer.id, label: layer.label,
          };
        }
      } catch { /* abaikan error geometri */ }
    }
    if (nearestMl) return { pos: nearestMl.pos, info: { layerId: nearestMl.layerId, label: nearestMl.label, isMidLine: true } };

    // Fase 3: tidak ada snap — gunakan koordinat klik asli
    return { pos: [clickLat, clickLng], info: null };
  };

  const handleSnapClick = (lat: number, lng: number, which: "start" | "end") => {
    const { pos, info } = snapToNearestPoint(lat, lng);
    if (info !== null) {
      // Ada jaringan terdekat — minta konfirmasi sebelum snap
      const kindText = info.isMidLine ? `titik cabang pada` : `ujung`;
      const confirmed = window.confirm(`Sambungkan ke ${kindText} jaringan "${info.label}"?`);
      if (confirmed) {
        if (which === "start") { setStartPos(pos); setSnapStart(info); }
        else { setEndPos(pos); setSnapEnd(info); }
      } else {
        // User tolak — pakai koordinat klik asli tanpa snap
        if (which === "start") { setStartPos([lat, lng]); setSnapStart(null); }
        else { setEndPos([lat, lng]); setSnapEnd(null); }
      }
    } else {
      if (which === "start") { setStartPos(pos); setSnapStart(null); }
      else { setEndPos(pos); setSnapEnd(null); }
    }
  };

  // ─── Drag-to-connect map effect ───────────────────────────────────────────
  useEffect(() => {
    if (!dragSource) return;
    const map = mapRef.current;
    if (map) map.dragging.disable();

    const handleMouseMove = (e: MouseEvent) => {
      didDragRef.current = true; // Tandai bahwa user benar-benar melakukan drag
      if (!map) return;
      const rect = map.getContainer().getBoundingClientRect();
      const pt = L.point(e.clientX - rect.left, e.clientY - rect.top);
      const latlng = map.containerPointToLatLng(pt);
      setDragMousePos([latlng.lat, latlng.lng]);

      const snap = snapToNearestPoint(latlng.lat, latlng.lng);
      if (snap.info && snap.info.layerId !== undefined && snap.info.poleIdx !== undefined) {
        if (snap.info.layerId === dragSource.layerId && snap.info.poleIdx === dragSource.poleIdx) {
          setDragSnapTarget(null);
        } else {
          setDragSnapTarget({
            layerId: snap.info.layerId,
                label: snap.info.label,
            poleIdx: snap.info.poleIdx,
            pos: snap.pos,
            isFromActiveLayer: snap.info.layerId === ACTIVE_LAYER_ID
          });
        }
      } else {
        setDragSnapTarget(null);
      }
    };

    const handleMouseUp = () => {
      setDragSource(prevSrc => {
        setDragSnapTarget(prevTgt => {
          if (prevSrc && prevTgt) {
            handleCreateJunction(prevTgt.layerId, prevTgt.poleIdx, prevSrc.layerId, prevSrc.poleIdx);
          }
          return null;
        });
        return null;
      });
      setDragMousePos(null);
      if (map) map.dragging.enable();
      
      if (didDragRef.current) {
        setTimeout(() => { didDragRef.current = false; }, 50);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      if (map) map.dragging.enable();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragSource]);

  // ─── Pole editing ─────────────────────────────────────────────────────────
  const handlePoleDrag = (idx: number, newLatLng: [number, number]) => {
    const ptDragged = turf.point([newLatLng[1], newLatLng[0]]);
    let snapTarget: { layerId: number; label: string; poleIdx: number; coord: [number, number] } | null = null;

    for (const l of savedLayers) {
      for (let i = 0; i < l.poles.length; i++) {
        const p = l.poles[i];
        const dist = turf.distance(ptDragged, turf.point([p[1], p[0]]), { units: "meters" });
        if (dist < 5) {
          const alreadyConnected = junctions.some(j =>
            (j.hostLayerId === l.id && j.hostPoleIdx === i && j.branchLayerId === ACTIVE_LAYER_ID && j.branchPoleIdx === idx) ||
            (j.hostLayerId === ACTIVE_LAYER_ID && j.hostPoleIdx === idx && j.branchLayerId === l.id && j.branchPoleIdx === i)
          );
          if (!alreadyConnected) { snapTarget = { layerId: l.id, label: l.label, poleIdx: i, coord: p }; break; }
        }
      }
      if (snapTarget) break;
    }

    if (snapTarget && window.confirm(`Sambungkan ke ujung jaringan "${snapTarget.label}"?`)) {
      handleCreateJunction(snapTarget.layerId, snapTarget.poleIdx, ACTIVE_LAYER_ID, idx);
    } else {
      commitHistory("Geser tiang"); setIsEdited(true);
      const np = [...poles]; np[idx] = newLatLng; setPoles(np); setLine(np);
    }
  };

  const handleDeletePole = (idx: number) => {
    commitHistory(`Hapus tiang #${idx + 1}`); setIsEdited(true);
    const np = [...poles]; np.splice(idx, 1); setPoles(np); setLine(np);
    const ng = { ...gardus }; delete ng[idx];
    for (let i = idx + 1; i <= poles.length; i++) { if (ng[i]) { ng[i - 1] = ng[i]; delete ng[i]; } }
    setGardus(ng);
    const ns = { ...schoors }; delete ns[idx];
    for (let i = idx + 1; i <= poles.length; i++) { if (ns[i]) { ns[i - 1] = ns[i]; delete ns[i]; } }
    setSchoors(ns);
  };
  const handleSavedPoleEdit = (layerId: number, poleIdx: number, mode: string) => {
    if (!highlightedLayerIds.has(layerId)) return;
    if (mode === "konstruksi") {
      setSelectedKonstruksiSaved({ layerId, poleIdx });
      return;
    }
    const modeLabel: Record<string, string> = { delete: "Hapus tiang tersimpan", gardu: "Edit gardu tersimpan", schoor: "Edit schoor tersimpan" };
    commitHistory(modeLabel[mode] ?? "Edit tiang tersimpan");
    setSavedLayers(prev => prev.map(l => {
      if (l.id !== layerId) return l;
      let newL = { ...l };
      if (mode === "delete") {
        if (l.poles.length <= 2) {
          alert("Minimal 2 tiang dalam satu jaringan!");
          return l;
        }
        const np = [...l.poles]; np.splice(poleIdx, 1);
        const ng = { ...l.gardus }; delete ng[poleIdx];
        for (let i = poleIdx + 1; i <= l.poles.length; i++) { if (ng[i]) { ng[i - 1] = ng[i]; delete ng[i]; } }
        const ns = { ...l.schoors }; delete ns[poleIdx];
        for (let i = poleIdx + 1; i <= l.poles.length; i++) { if (ns[i]) { ns[i - 1] = ns[i]; delete ns[i]; } }
        newL = { ...l, poles: np, line: np, gardus: ng, schoors: ns };

        // Propagasi junction index setelah delete
        setJunctions(prevJ => {
          let nextJ = prevJ.filter(j => !(j.hostLayerId === l.id && j.hostPoleIdx === poleIdx) && !(j.branchLayerId === l.id && j.branchPoleIdx === poleIdx));
          return nextJ.map(j => {
            if (j.hostLayerId === l.id && j.hostPoleIdx > poleIdx) return { ...j, hostPoleIdx: j.hostPoleIdx - 1 };
            if (j.branchLayerId === l.id && j.branchPoleIdx > poleIdx) return { ...j, branchPoleIdx: j.branchPoleIdx - 1 };
            return j;
          });
        });

      } else if (mode === "gardu") {
        const current = l.gardus[poleIdx];
        if (current && current.jenis === paletteGarduJenis && current.trafo === paletteGarduTrafo) {
          const ng = { ...l.gardus }; delete ng[poleIdx]; newL.gardus = ng;
        } else {
          newL.gardus = { ...l.gardus, [poleIdx]: { jenis: paletteGarduJenis, trafo: paletteGarduTrafo, orientasi: "Horizontal" } };
        }
      } else if (mode === "schoor") {
        const current = l.schoors[poleIdx];
        if (current && current.jenis === paletteSchoorJenis) {
          const ns = { ...l.schoors }; delete ns[poleIdx]; newL.schoors = ns;
        } else {
          newL.schoors = { ...l.schoors, [poleIdx]: { jenis: paletteSchoorJenis, rotation: undefined } };
        }
      }
      return newL;
    }));
  };

  const handleMapClickForInsert = (latlng: any) => {
    let minDist = Infinity; let targetIdx = -1; let targetType: "active" | "saved" = "active"; let targetLayerId = -1;
    const clickPt = turf.point([latlng.lng, latlng.lat]);

    if (poles.length >= 2) {
      for (let i = 0; i < poles.length - 1; i++) {
        const d = turf.pointToLineDistance(clickPt, turf.lineString([[poles[i][1], poles[i][0]], [poles[i + 1][1], poles[i + 1][0]]]), { units: "meters" });
        if (d < minDist) { minDist = d; targetIdx = i + 1; targetType = "active"; }
      }
    }

    for (const l of savedLayers) {
      if (!highlightedLayerIds.has(l.id) || l.poles.length < 2) continue;
      for (let i = 0; i < l.poles.length - 1; i++) {
        const d = turf.pointToLineDistance(clickPt, turf.lineString([[l.poles[i][1], l.poles[i][0]], [l.poles[i + 1][1], l.poles[i + 1][0]]]), { units: "meters" });
        if (d < minDist) { minDist = d; targetIdx = i + 1; targetType = "saved"; targetLayerId = l.id; }
      }
    }

    if (targetIdx !== -1 && minDist < 20) {
      if (targetType === "active") {
        commitHistory("Sisip tiang");
        setIsEdited(true);
        const np = [...poles]; np.splice(targetIdx, 0, [latlng.lat, latlng.lng]); setPoles(np); setLine(np);
        const ng = { ...gardus };
        for (let i = poles.length - 1; i >= targetIdx; i--) { if (ng[i]) { ng[i + 1] = ng[i]; delete ng[i]; } }
        setGardus(ng);
        const ns = { ...schoors };
        for (let i = poles.length - 1; i >= targetIdx; i--) { if (ns[i]) { ns[i + 1] = ns[i]; delete ns[i]; } }
        setSchoors(ns);
      } else if (targetType === "saved") {
        commitHistory("Sisip tiang tersimpan");
        setSavedLayers(prev => prev.map(l => {
          if (l.id !== targetLayerId) return l;
          const np = [...l.poles]; np.splice(targetIdx, 0, [latlng.lat, latlng.lng]);
          const ng = { ...l.gardus };
          for (let i = l.poles.length - 1; i >= targetIdx; i--) { if (ng[i]) { ng[i + 1] = ng[i]; delete ng[i]; } }
          const ns = { ...l.schoors };
          for (let i = l.poles.length - 1; i >= targetIdx; i--) { if (ns[i]) { ns[i + 1] = ns[i]; delete ns[i]; } }
          
          setJunctions(prevJ => prevJ.map(j => {
            if (j.hostLayerId === l.id && j.hostPoleIdx >= targetIdx) return { ...j, hostPoleIdx: j.hostPoleIdx + 1 };
            if (j.branchLayerId === l.id && j.branchPoleIdx >= targetIdx) return { ...j, branchPoleIdx: j.branchPoleIdx + 1 };
            return j;
          }));

          return { ...l, poles: np, line: np, gardus: ng, schoors: ns };
        }));
      }
    }
  };

  // ─── Generate & clear ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!startPos || !endPos) { alert("Pilih titik awal dan akhir dulu di peta!"); return; }
    setIsLoading(true); setEditMode(null); setIsEdited(false); setGardus({}); setSchoors({});
    try {
      if (routingMode === "lurus") {
        setRawRoute(turf.lineString([[startPos[1], startPos[0]], [endPos[1], endPos[0]]]));
        setFlyTarget(startPos);
      } else {
        const res = await fetch(`/api/route?start=${startPos[1]},${startPos[0]}&end=${endPos[1]},${endPos[0]}`);
        const data = await res.json();
        if (!data.features?.[0]) { alert("Gagal menemukan rute. Pastikan titik dekat jalan."); setIsLoading(false); return; }
        setRawRoute(turf.lineString(data.features[0].geometry.coordinates));
        setFlyTarget(startPos);
      }
    } catch (e) { console.error("ERROR SAAT FETCH RUTE:", e); alert("Gagal memproses rute."); }
    finally { setIsLoading(false); }
  };

  const handleClear = () => {
    if (savedLayers.length > 0 && !window.confirm(`Reset semua? ${savedLayers.length} layer jaringan akan dihapus.`)) return;
    setHistory([]); setRedoStack([]); setStartPos(null); setEndPos(null); setPoles([]); setLine([]);
    setRawRoute(null); setIsEdited(false); setGardus({}); setSchoors({});
    setMode(null); setEditMode(null); setAutoSchoor(false); setRoutingMode("jalan");
    setSavedLayers([]); setLayerCounter(1); setActiveEditLayerId(null);
    setSnapStart(null); setSnapEnd(null);
    setJunctions([]); setConnections([]);
  };

  // ─── Hapus layer + bersihkan junction yang terkait ───────────────────────
  const handleDeleteLayer = (id: number) => {
    const layerLabel = savedLayers.find(l => l.id === id)?.label ?? "layer";
    commitHistory(`Hapus layer "${layerLabel}"`);
    setSavedLayers(prev => prev.filter(l => l.id !== id));
    setJunctions(prev => prev.filter(j => j.hostLayerId !== id && j.branchLayerId !== id));
  };

  // ─── Helper: sisip tiang baru ke host layer pada titik mid-line snap ───────
  // Dipakai saveCurrentAsLayer untuk auto-junction saat startPos/endPos mid-line.
  const insertMidLineJunction = (
    snap: SnapInfo, branchLayerId: number, branchPoleIdx: number,
    snapCoord: [number, number],
  ) => {
    const hostLayer = savedLayers.find(l => l.id === snap.layerId);
    if (!hostLayer || hostLayer.line.length < 2) return;
    const linePt = turf.nearestPointOnLine(
      turf.lineString(hostLayer.line.map(p => [p[1], p[0]])),
      turf.point([snapCoord[1], snapCoord[0]]), { units: "meters" }
    );
    const insertIdx = (linePt.properties.index ?? 0) + 1;
    const newPoles = [...hostLayer.poles];
    newPoles.splice(insertIdx, 0, [snapCoord[0], snapCoord[1]]);
    const newGardus: Record<number, GarduConfig> = {};
    for (const [k, v] of Object.entries(hostLayer.gardus))
      newGardus[Number(k) >= insertIdx ? Number(k) + 1 : Number(k)] = v;
    const newSchoors: Record<number, SchoorConfig> = {};
    for (const [k, v] of Object.entries(hostLayer.schoors))
      newSchoors[Number(k) >= insertIdx ? Number(k) + 1 : Number(k)] = v;
    setSavedLayers(prev => prev.map(l => l.id !== snap.layerId ? l : {
      ...l, poles: newPoles, line: newPoles, gardus: newGardus, schoors: newSchoors,
    }));
    setJunctions(prev => [
      ...prev.filter(j => !(j.branchLayerId === branchLayerId && j.branchPoleIdx === branchPoleIdx)),
      { id: Date.now(), hostLayerId: snap.layerId, hostPoleIdx: insertIdx,
        branchLayerId, branchPoleIdx, hostCoord: [snapCoord[0], snapCoord[1]] },
    ]);
  };

  // ─── Update pole position pada layer tersimpan + propagasi junction ────────
  // Saat host pole digeser → branch poles di layer lain ikut berpindah.
  // Saat branch pole digeser → junction dihapus (user sengaja memisahkan).
  const handleUpdateSavedPole = useCallback((layerId: number, poleIdx: number, newLatLng: [number, number]) => {
    setSavedLayers(prev => {
      // 1. Pindahkan pole yang di-drag
      let updated = prev.map(l => {
        if (l.id !== layerId) return l;
        const np = [...l.poles];
        np[poleIdx] = newLatLng;
        return { ...l, poles: np, line: np };
      });

      // 2. Cari semua junction di mana pole ini adalah HOST → pindahkan branch poles juga
      for (const j of junctions) {
        if (j.hostLayerId === layerId && j.hostPoleIdx === poleIdx) {
          updated = updated.map(l => {
            if (l.id !== j.branchLayerId) return l;
            const np = [...l.poles];
            np[j.branchPoleIdx] = [newLatLng[0], newLatLng[1]];
            return { ...l, poles: np, line: np };
          });
        }
      }

      return updated;
    });

    // 3. Update hostCoord pada semua junction yang host-nya adalah pole ini
    setJunctions(prev => prev.map(j => {
      if (j.hostLayerId === layerId && j.hostPoleIdx === poleIdx)
        return { ...j, hostCoord: newLatLng };
      return j;
    }));
  }, [junctions]);

  // ─── Rename layer tersimpan ───────────────────────────────────────────────
  const handleRenameLayer = useCallback((id: number, newLabel: string) => {
    setSavedLayers(prev => prev.map(l => l.id !== id ? l : { ...l, label: newLabel }));
  }, []);

  // ─── Rename grup jaringan ─────────────────────────────────────────────────
  const handleRenameGroup = useCallback((groupKey: string, newName: string) => {
    setGroupNames(prev => ({ ...prev, [groupKey]: newName }));
  }, []);

  // ─── Layer management ─────────────────────────────────────────────────────
  const saveCurrentAsLayer = (continueFromEnd = false) => {
    if (poles.length === 0) { alert("Belum ada jaringan yang di-generate!"); return; }
    commitHistory(activeEditLayerId !== null ? `Update layer "${saveName || jenisJaringan}"` : `Simpan layer baru`);
    // Gunakan saveName jika diisi, pastikan unique dengan index jika nama sudah ada
    const defaultLabel = `${jenisJaringan} ${statusJaringan} #${layerCounter}`;
    let label = saveName.trim() || defaultLabel;
    // Jika nama sudah dipakai layer lain, tambahkan suffix counter
    const existingLabels = savedLayers.filter(l => l.id !== (activeEditLayerId ?? -9999)).map(l => l.label);
    if (existingLabels.includes(label)) {
      let i = 2;
      while (existingLabels.includes(`${label} (${i})`)) i++;
      label = `${label} (${i})`;
    }
    const id = activeEditLayerId !== null ? activeEditLayerId : Date.now();
    const layer: NetworkLayer = {
      id, label, poles: [...poles], line: [...line],
      jenisJaringan, statusJaringan, offsetSide, jarakGawang, tinggiTiang, materialTiang,
      gardus: { ...gardus }, schoors: { ...schoors },
      konstruksiOverrides: { ...konstruksiOverrides },
      autoSchoor, autoSchoorThreshold,
    };
    setSavedLayers(prev => [...prev.filter(l => l.id !== id), layer]);
    if (activeEditLayerId === null) setLayerCounter(c => c + 1);

    // Remap junctions yang masih referensi ACTIVE_LAYER_ID ke real layer id
    setJunctions(prev => prev.map(j => {
      if (j.branchLayerId === ACTIVE_LAYER_ID) return { ...j, branchLayerId: id };
      if (j.hostLayerId === ACTIVE_LAYER_ID) return { ...j, hostLayerId: id };
      return j;
    }));

    // Auto-junction: snap titik awal (branch pole idx 0)
    if (snapStart && !snapStart.isMidLine && snapStart.poleIdx !== undefined) {
      const hostLayer = savedLayers.find(l => l.id === snapStart!.layerId);
      if (hostLayer) {
        const hc = hostLayer.poles[snapStart.poleIdx] as [number, number];
        setSavedLayers(prev => prev.map(l => {
          if (l.id !== id) return l;
          const np = [...l.poles]; np[0] = [hc[0], hc[1]];
          return { ...l, poles: np, line: np };
        }));
        setJunctions(prev => [
          ...prev.filter(j => !(j.branchLayerId === id && j.branchPoleIdx === 0)),
          { id: Date.now(), hostLayerId: snapStart!.layerId, hostPoleIdx: snapStart!.poleIdx!,
            branchLayerId: id, branchPoleIdx: 0, hostCoord: [hc[0], hc[1]] },
        ]);
      }
    } else if (snapStart?.isMidLine && startPos) {
      insertMidLineJunction(snapStart, id, 0, startPos);
    }

    // Auto-junction: snap titik akhir (branch pole idx = poles.length - 1)
    if (snapEnd && !snapEnd.isMidLine && snapEnd.poleIdx !== undefined) {
      const hostLayer = savedLayers.find(l => l.id === snapEnd!.layerId);
      if (hostLayer) {
        const hc = hostLayer.poles[snapEnd.poleIdx] as [number, number];
        const lastIdx = poles.length - 1;
        setSavedLayers(prev => prev.map(l => {
          if (l.id !== id) return l;
          const np = [...l.poles]; np[np.length - 1] = [hc[0], hc[1]];
          return { ...l, poles: np, line: np };
        }));
        setJunctions(prev => [
          ...prev.filter(j => !(j.branchLayerId === id && j.branchPoleIdx === lastIdx)),
          { id: Date.now() + 1, hostLayerId: snapEnd!.layerId, hostPoleIdx: snapEnd!.poleIdx!,
            branchLayerId: id, branchPoleIdx: lastIdx, hostCoord: [hc[0], hc[1]] },
        ]);
      }
    } else if (snapEnd?.isMidLine && endPos) {
      insertMidLineJunction(snapEnd, id, poles.length - 1, endPos);
    }

    if (continueFromEnd === true) {
      const lastPole = poles[poles.length - 1];
      setStartPos(lastPole); setSnapStart({ layerId: id, label });
      setEndPos(null); setSnapEnd(null); setMode("end");
    } else {
      setStartPos(null); setEndPos(null); setSnapStart(null); setSnapEnd(null); setMode(null);
    }
    setPoles([]); setLine([]); setRawRoute(null); setIsEdited(false);
    setGardus({}); setSchoors({}); setKonstruksiOverrides({}); setEditMode(null); setActiveEditLayerId(null);
    setAutoSchoor(false); setRoutingMode("jalan"); setSaveName("");
  };

  const loadLayerForEdit = (layer: NetworkLayer) => {
    if (poles.length > 0) {
      if (!window.confirm("Jaringan draft aktif akan disimpan dulu. Lanjutkan?")) return;
      saveCurrentAsLayer();
    }
    commitHistory(`Edit layer "${layer.label}"`);
    setPoles(layer.poles); setLine(layer.line);
    setJenisJaringan(layer.jenisJaringan); setStatusJaringan(layer.statusJaringan);
    setOffsetSide(layer.offsetSide); setJarakGawang(layer.jarakGawang);
    setTinggiTiang(layer.tinggiTiang); setMaterialTiang(layer.materialTiang);
    setGardus(layer.gardus); setSchoors(layer.schoors);
    setKonstruksiOverrides(layer.konstruksiOverrides ?? {});
    setAutoSchoor(layer.autoSchoor); setAutoSchoorThreshold(layer.autoSchoorThreshold);
    setSaveName(layer.label);
    setIsEdited(true); setRawRoute(null);
    setActiveEditLayerId(layer.id);
    setSavedLayers(prev => prev.filter(l => l.id !== layer.id));
    if (layer.poles.length > 0) setFlyTarget(layer.poles[0]);
  };

  // ─── Gabungkan semua layer dalam grup menjadi 1 layer aktif ──────────────
  const handleMergeGroup = useCallback((groupLayerIds: number[], groupName: string) => {
    const groupLayers = groupLayerIds
      .map(id => savedLayers.find(l => l.id === id))
      .filter((l): l is NetworkLayer => !!l);
    if (groupLayers.length < 2) return;
    commitHistory(`Gabung layer "${groupName}"`);

    const groupJunctions = junctions.filter(
      j => groupLayerIds.includes(j.hostLayerId) && groupLayerIds.includes(j.branchLayerId)
    );

    // ── Tentukan urutan layer menggunakan topologi junction ──────────────────
    // Layer yang TIDAK pernah jadi branch = layer pertama (awal rantai)
    const branchIds = new Set(groupJunctions.map(j => j.branchLayerId));
    const startLayer = groupLayers.find(l => !branchIds.has(l.id)) ?? groupLayers[0];

    // Bangun rantai terurut: start → next → next → ...
    const ordered: NetworkLayer[] = [];
    const juncInfo: { hostPoleIdx: number; branchPoleIdx: number }[] = [];
    const visited = new Set<number>();
    let currentId = startLayer.id;

    while (currentId !== undefined && !visited.has(currentId)) {
      visited.add(currentId);
      const layer = groupLayers.find(l => l.id === currentId);
      if (!layer) break;
      ordered.push(layer);
      // Cari junction yang keluar dari current layer (current = host)
      const nextJ = groupJunctions.find(j => j.hostLayerId === currentId);
      if (!nextJ) break;
      juncInfo.push({ hostPoleIdx: nextJ.hostPoleIdx, branchPoleIdx: nextJ.branchPoleIdx });
      currentId = nextJ.branchLayerId;
    }

    // ── Gabungkan poles & accessories ───────────────────────────────────────
    let mergedPoles: [number, number][] = [...ordered[0].poles];
    const mergedGardus: Record<number, GarduConfig> = { ...ordered[0].gardus };
    const mergedSchoors: Record<number, SchoorConfig> = { ...ordered[0].schoors };
    const mergedKonstruksiOverrides: Record<number, string> = { ...(ordered[0].konstruksiOverrides ?? {}) };
    let offset = ordered[0].poles.length;

    for (let i = 1; i < ordered.length; i++) {
      const layer = ordered[i];
      const conn = juncInfo[i - 1];
      // Skip branch pole yang identik dengan host pole (overlap di junction)
      const skip = conn.branchPoleIdx === 0 ? 1 : 0;
      const polesToAdd = layer.poles.slice(skip);
      const idxOffset = offset - skip;

      for (const [k, v] of Object.entries(layer.gardus)) {
        const ki = Number(k);
        if (ki >= skip) mergedGardus[idxOffset + ki] = v;
      }
      for (const [k, v] of Object.entries(layer.schoors)) {
        const ki = Number(k);
        if (ki >= skip) mergedSchoors[idxOffset + ki] = v;
      }
      for (const [k, v] of Object.entries(layer.konstruksiOverrides ?? {})) {
        const ki = Number(k);
        if (ki >= skip) mergedKonstruksiOverrides[idxOffset + ki] = v;
      }
      mergedPoles = [...mergedPoles, ...polesToAdd];
      offset += polesToAdd.length;
    }

    const first = ordered[0];
    const merged: NetworkLayer = {
      id: Date.now(), label: groupName,
      poles: mergedPoles, line: mergedPoles,
      jenisJaringan: first.jenisJaringan, statusJaringan: first.statusJaringan,
      offsetSide: first.offsetSide, jarakGawang: first.jarakGawang,
      tinggiTiang: first.tinggiTiang, materialTiang: first.materialTiang,
      gardus: mergedGardus, schoors: mergedSchoors,
      konstruksiOverrides: mergedKonstruksiOverrides,
      autoSchoor: first.autoSchoor, autoSchoorThreshold: first.autoSchoorThreshold,
    };

    // Konfirmasi
    if (!window.confirm(
      `Gabungkan ${groupLayers.length} layer menjadi 1 layer "${merged.label}" dengan ${mergedPoles.length} titik?\n\nSetelah digabungkan, kamu bisa edit semua titik sekaligus lalu simpan.`
    )) return;

    // Hapus child layers + internal junctions
    setSavedLayers(prev => prev.filter(l => !groupLayerIds.includes(l.id)));
    setJunctions(prev => prev.filter(
      j => !(groupLayerIds.includes(j.hostLayerId) && groupLayerIds.includes(j.branchLayerId))
    ));

    // Load merged sebagai layer aktif (edit mode)
    setPoles(merged.poles); setLine(merged.line);
    setJenisJaringan(merged.jenisJaringan); setStatusJaringan(merged.statusJaringan);
    setOffsetSide(merged.offsetSide); setJarakGawang(merged.jarakGawang);
    setTinggiTiang(merged.tinggiTiang); setMaterialTiang(merged.materialTiang);
    setGardus(merged.gardus); setSchoors(merged.schoors);
    setKonstruksiOverrides(merged.konstruksiOverrides ?? {});
    setAutoSchoor(merged.autoSchoor); setAutoSchoorThreshold(merged.autoSchoorThreshold);
    setIsEdited(true); setRawRoute(null);
    setActiveEditLayerId(merged.id);
    setSaveName(merged.label);
    if (merged.poles.length > 0) setFlyTarget(merged.poles[0]);
  }, [savedLayers, junctions]);

  // ─── Edit mode toggles ────────────────────────────────────────────────────
  const toggleEditMode = (selectedMode: "insert" | "delete" | "gardu" | "schoor" | "konstruksi") => {
    setMode(null); setEditMode(editMode === selectedMode ? null : selectedMode);
    setSelectedGarduIdx(null); setSelectedSchoorIdx(null); setSelectedKonstruksiIdx(null);
  };

  const activatePalette = (type: "schoor" | "gardu", subtype: string) => {
    setMode(null); setSelectedGarduIdx(null); setSelectedSchoorIdx(null);
    if (type === "schoor") {
      const jenis = subtype as SchoorConfig["jenis"];
      if (editMode === "schoor" && paletteSchoorJenis === jenis) setEditMode(null);
      else { setPaletteSchoorJenis(jenis); setEditMode("schoor"); }
    } else {
      const jenis = subtype as GarduConfig["jenis"];
      if (editMode === "gardu" && paletteGarduJenis === jenis) setEditMode(null);
      else { 
        setPaletteGarduJenis(jenis); 
        setEditMode("gardu"); 
        if (jenis === "Cantol" && parseInt(paletteGarduTrafo) > 50) {
          setPaletteGarduTrafo("50 kVA");
        }
      }
    }
  };

  const saveGardu = () => {
    if (selectedGarduIdx !== null) { commitHistory(`Pasang gardu ${tempGardu.jenis}`); setGardus(prev => ({ ...prev, [selectedGarduIdx]: tempGardu })); setSelectedGarduIdx(null); }
  };
  const removeGardu = () => {
    if (selectedGarduIdx !== null) { commitHistory("Hapus gardu"); const ng = { ...gardus }; delete ng[selectedGarduIdx]; setGardus(ng); setSelectedGarduIdx(null); }
  };
  const saveSchoor = () => {
    if (selectedSchoorIdx !== null) { commitHistory(`Pasang schoor ${tempSchoor.jenis}`); setSchoors(prev => ({ ...prev, [selectedSchoorIdx]: tempSchoor })); setSelectedSchoorIdx(null); }
  };
  const removeSchoor = () => {
    if (selectedSchoorIdx !== null) { commitHistory("Hapus schoor"); const ns = { ...schoors }; delete ns[selectedSchoorIdx]; setSchoors(ns); setSelectedSchoorIdx(null); }
  };

  // ─── Computed pole data ───────────────────────────────────────────────────
  // Kumulatif jarak per tiang untuk SKUTM (dipakai untuk mark Terminasi/2xTerminasi)
  const skutmCumDists: number[] = [];
  if (jenisJaringan === "SKUTM" && poles.length > 0) {
    skutmCumDists[0] = 0;
    for (let i = 1; i < poles.length; i++) {
      skutmCumDists[i] = skutmCumDists[i - 1] + haversineMeters(poles[i-1][0], poles[i-1][1], poles[i][0], poles[i][1]);
    }
  }

  const activeJunctionHostIdxs = new Set(
    junctions.filter(j => j.hostLayerId === ACTIVE_LAYER_ID).map(j => j.hostPoleIdx)
  );

  const poleData = poles.map((pos, idx) => {
    const isLast = idx === poles.length - 1;
    const ptCurrent = turf.point([pos[1], pos[0]]);
    let maxSpan = 0; let angle = 0; let turnSign = 0;
    if (idx < poles.length - 1) maxSpan = Math.max(maxSpan, turf.distance(ptCurrent, turf.point([poles[idx + 1][1], poles[idx + 1][0]]), { units: "meters" }));
    if (idx > 0) maxSpan = Math.max(maxSpan, turf.distance(ptCurrent, turf.point([poles[idx - 1][1], poles[idx - 1][0]]), { units: "meters" }));
    if (idx > 0 && idx < poles.length - 1) {
      const b1 = turf.bearing(turf.point([poles[idx - 1][1], poles[idx - 1][0]]), ptCurrent);
      const b2 = turf.bearing(ptCurrent, turf.point([poles[idx + 1][1], poles[idx + 1][0]]));
      let raw = b2 - b1;
      if (raw > 180) raw -= 360;
      else if (raw <= -180) raw += 360;
      angle = Math.abs(raw);
      turnSign = Math.sign(raw);
    }
    let jtrTypeShort = ""; let jtrTypeLong = "";
    if (jenisJaringan.includes("SKUTR") || jenisJaringan.includes("Underbuild")) {
      jtrTypeLong = "Suspension Assy (S)"; jtrTypeShort = "S";
      if (idx === 0) { jtrTypeLong = "Fix Dead End (FDE)"; jtrTypeShort = "FDE"; }
      else if (isLast) { jtrTypeLong = "Bundle End Protect + FDE (BDL+DE)"; jtrTypeShort = "BDL+DE"; }
      else if (angle > 15) { jtrTypeLong = `Large Angle Assy (LA) - Belok ${angle.toFixed(1)}°`; jtrTypeShort = "LA"; }
    }
    let jtmTypeShort = ""; let jtmTypeLong = "";
    if (jenisJaringan.includes("SUTM")) {
      jtmTypeLong = "A1 (Lurus)"; jtmTypeShort = "A1";
      if (activeJunctionHostIdxs.has(idx)) { jtmTypeLong = "A3 Branch (Tiang Cabang)"; jtmTypeShort = "A3 Branch"; }
      else if (idx === 0 || isLast) { jtmTypeLong = "A3 Pole (Tiang Ujung)"; jtmTypeShort = "A3 Pole"; }
      else {
        if (angle > 30) { jtmTypeLong = `2xA3 (Belok ${angle.toFixed(1)}°)`; jtmTypeShort = "2xA3"; }
        else if (angle >= 10 && angle <= 30) { jtmTypeLong = `A2 (Belok ${angle.toFixed(1)}°)`; jtmTypeShort = "A2"; }
        if ((idx + 1) % 10 === 0) { jtmTypeLong = "A3 (Tiang Tarik)"; jtmTypeShort = "A3"; }
      }
      if (maxSpan >= 70) { jtmTypeLong = "B3 (Span >= 70m)"; jtmTypeShort = "B3"; }
    }
    let kabelTypeShort = ""; let kabelTypeLong = "";
    if (jenisJaringan === "SKTM" || jenisJaringan === "SKTR") {
      if (idx === 0 || isLast) { kabelTypeShort = "TRM"; kabelTypeLong = "Terminasi"; }
      else { kabelTypeShort = "JNT"; kabelTypeLong = "Jointing"; }
    }
    let skutmTypeShort = ""; let skutmTypeLong = "";
    if (jenisJaringan === "SKUTM") {
      if (idx === 0 || isLast) { skutmTypeShort = "Trm"; skutmTypeLong = "Terminasi"; }
      else {
        const cumDist = skutmCumDists[idx] ?? 0;
        const mod1000 = cumDist % 1000;
        const mod500 = cumDist % 500;
        if (mod1000 < 25 || mod1000 > 975) { skutmTypeShort = "2xTrm"; skutmTypeLong = "2× Terminasi"; }
        else if (mod500 < 25 || mod500 > 475) { skutmTypeShort = "Trm"; skutmTypeLong = "Terminasi"; }
        else if (angle > 75) { skutmTypeShort = "2xTrm"; skutmTypeLong = `2× Terminasi (Belok ${angle.toFixed(1)}°)`; }
        else if (angle > 5) { skutmTypeShort = "LA"; skutmTypeLong = `LA (Belok ${angle.toFixed(1)}°)`; }
        else { skutmTypeShort = "S"; skutmTypeLong = "Suspension (S)"; }
      }
    }
    // Terapkan override konstruksi jika ada
    const override = konstruksiOverrides[idx];
    if (override) {
      if (jenisJaringan.includes("SUTM")) { jtmTypeShort = override; jtmTypeLong = override; }
      else if (jenisJaringan.includes("SKUTR") || jenisJaringan.includes("Underbuild")) { jtrTypeShort = override; jtrTypeLong = override; }
      else if (jenisJaringan === "SKUTM") { skutmTypeShort = override; skutmTypeLong = override; }
      else if (jenisJaringan === "SKTM" || jenisJaringan === "SKTR") { kabelTypeShort = override; kabelTypeLong = override; }
    }
    return { jtrTypeShort, jtrTypeLong, jtmTypeShort, jtmTypeLong, kabelTypeShort, kabelTypeLong, skutmTypeShort, skutmTypeLong, isGrounded: false, angle, turnSign };
  });

  // Grounding logic
  const groundedIndices = new Set<number>();
  const lastIdx = poles.length - 1;
  if (poles.length > 0) {
    groundedIndices.add(lastIdx);
    let nextTarget = 9;
    while (nextTarget < lastIdx) {
      let gi = nextTarget;
      const isStraight = (i: number) => poleData[i].jtrTypeShort === "S" || poleData[i].jtmTypeShort === "A1";
      if (!isStraight(gi)) {
        let si = nextTarget - 1;
        while (si > 0 && !isStraight(si) && poleData[si].jtrTypeShort !== "FDE" && poleData[si].jtmTypeShort !== "A3") si--;
        gi = si > 0 ? si : nextTarget - 1;
      }
      if (lastIdx - gi >= 5) groundedIndices.add(gi);
      nextTarget += 10;
    }
    groundedIndices.forEach(i => { if (poleData[i]) poleData[i].isGrounded = true; });
  }

  // Effective schoors (auto + manual, manual overrides)
  const effectiveSchoors: Record<number, SchoorConfig> = { ...schoors };
  if (autoSchoor && poles.length > 2) {
    poleData.forEach((pd, idx) => {
      const isEndpoint = idx === 0 || idx === poles.length - 1;
      if (!isEndpoint && pd.angle >= autoSchoorThreshold && !schoors[idx]) {
        const autoJenis: SchoorConfig["jenis"] = pd.turnSign > 0 ? "Treck" : "Druck";
        effectiveSchoors[idx] = { jenis: autoJenis };
      }
    });
  }
  const autoSchoorCount = autoSchoor
    ? poleData.filter((pd, idx) => !(idx === 0 || idx === poles.length - 1) && pd.angle >= autoSchoorThreshold && !schoors[idx]).length
    : 0;
  const totalLengthM = line.length > 1
    ? turf.length(turf.lineString(line.map(p => [p[1], p[0]])), { units: "kilometers" }) * 1000
    : 0;

  // ─── Line color / style ───────────────────────────────────────────────────
  let lineColor = "red"; let lineColor2: string | null = null; let lineColor3: string | null = null;
  let isDashed = false; let isDashed2 = false; let isDashed3 = false;
  let poleBackground = "#ffeb3b"; let poleBorder = "black"; let basePoleSize = 17;

  if (jenisJaringan === "SUTM" && statusJaringan === "Existing") {
    lineColor = "black"; poleBackground = "black"; poleBorder = "white";
  } else if (jenisJaringan === "SKUTR" && statusJaringan === "Existing") {
    lineColor = "black"; isDashed = true; poleBackground = "black"; poleBorder = "white";
  } else if (jenisJaringan === "SUTM" && statusJaringan === "Perluasan") {
    lineColor = "blue"; poleBackground = "white"; poleBorder = "blue";
  } else if (jenisJaringan === "SKUTR" && statusJaringan === "Perluasan") {
    lineColor = "blue"; isDashed = true; poleBackground = "blue"; poleBorder = "white";
  } else if (jenisJaringan === "SUTM + SKUTR" && statusJaringan === "Existing") {
    lineColor = "black"; lineColor2 = "black"; isDashed2 = true; poleBackground = "black"; poleBorder = "white";
  } else if (jenisJaringan === "SUTM + SKUTR" && statusJaringan === "Perluasan") {
    lineColor = "blue"; lineColor2 = "darkgreen"; isDashed2 = true; poleBackground = "linear-gradient(135deg, blue 50%, darkgreen 50%)"; poleBorder = "white";
  } else if (jenisJaringan === "SUTM Underbuild (2 Jaringan)" && statusJaringan === "Existing") {
    lineColor = "black"; lineColor2 = "black"; poleBackground = "black"; poleBorder = "white";
  } else if (jenisJaringan === "SUTM Underbuild (2 Jaringan)" && statusJaringan === "Perluasan") {
    lineColor = "blue"; lineColor2 = "blue"; poleBackground = "white"; poleBorder = "blue";
  } else if (jenisJaringan === "SUTM Underbuild (3 Jaringan)" && statusJaringan === "Existing") {
    lineColor = "black"; lineColor2 = "black"; lineColor3 = "black"; poleBackground = "black"; poleBorder = "white";
  } else if (jenisJaringan === "SUTM Underbuild (3 Jaringan)" && statusJaringan === "Perluasan") {
    lineColor = "blue"; lineColor2 = "blue"; lineColor3 = "blue"; poleBackground = "white"; poleBorder = "blue";
  } else if (jenisJaringan === "SKUTM" && statusJaringan === "Existing") {
    lineColor = "#6d28d9"; poleBackground = "#6d28d9"; poleBorder = "white";
  } else if (jenisJaringan === "SKUTM" && statusJaringan === "Perluasan") {
    lineColor = "#7c3aed"; poleBackground = "white"; poleBorder = "#7c3aed";
  } else if (jenisJaringan === "SKTM" && statusJaringan === "Existing") {
    lineColor = "#7c2d12"; poleBackground = "#7c2d12"; poleBorder = "white";
  } else if (jenisJaringan === "SKTM" && statusJaringan === "Perluasan") {
    lineColor = "#b45309"; poleBackground = "white"; poleBorder = "#b45309";
  } else if (jenisJaringan === "SKTR" && statusJaringan === "Existing") {
    lineColor = "#166534"; poleBackground = "#166534"; poleBorder = "white";
  } else if (jenisJaringan === "SKTR" && statusJaringan === "Perluasan") {
    lineColor = "#15803d"; poleBackground = "white"; poleBorder = "#15803d";
  }

  let line2Coords: [number, number][] | null = null;
  let line3Coords: [number, number][] | null = null;
  if (line.length > 1) {
    try {
      const lineGeo = turf.lineString(line.map(p => [p[1], p[0]]));
      if (lineColor2) {
        if (jenisJaringan === "SUTM + SKUTR") {
          line2Coords = turf.lineOffset(lineGeo, -0.8, { units: "meters" }).geometry.coordinates.map((p: number[]) => [p[1], p[0]] as [number, number]);
        } else {
          line2Coords = turf.lineOffset(lineGeo, 3.5, { units: "meters" }).geometry.coordinates.map((p: number[]) => [p[1], p[0]] as [number, number]);
        }
      }
      if (lineColor3) line3Coords = turf.lineOffset(lineGeo, -3.5, { units: "meters" }).geometry.coordinates.map((p: number[]) => [p[1], p[0]] as [number, number]);
    } catch (e) { console.error("Gagal membuat garis paralel", e); }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full font-sans text-gray-800">

      {/* MAP AREA */}
      <div className={`flex-1 relative z-0 ${editMode === "insert" ? "cursor-crosshair" : ""}`}>

        <RekapModal
          open={rekapOpen} onClose={() => setRekapOpen(false)}
          poles={poles} poleData={poleData}
          effectiveSchoors={effectiveSchoors} gardus={gardus}
          jenisJaringan={jenisJaringan} statusJaringan={statusJaringan}
          totalLengthM={totalLengthM}
          tinggiTiang={tinggiTiang} materialTiang={materialTiang} jarakGawang={jarakGawang}
        />

        {selectedGarduIdx !== null && (
          <GarduModal
            selectedGarduIdx={selectedGarduIdx} gardus={gardus} tempGardu={tempGardu}
            setTempGardu={setTempGardu} trafoOptions={trafoOptions}
            onSave={saveGardu} onRemove={removeGardu} onClose={() => setSelectedGarduIdx(null)}
          />
        )}

        {selectedSchoorIdx !== null && (
          <SchoorModal
            selectedSchoorIdx={selectedSchoorIdx} schoors={schoors} tempSchoor={tempSchoor}
            setTempSchoor={setTempSchoor} poleData={poleData} autoSchoor={autoSchoor}
            autoSchoorThreshold={autoSchoorThreshold}
            onSave={saveSchoor} onRemove={removeSchoor} onClose={() => setSelectedSchoorIdx(null)}
          />
        )}

        {/* Modal edit konstruksi — active layer */}
        {selectedKonstruksiIdx !== null && (() => {
          const pd = poleData[selectedKonstruksiIdx];
          if (!pd) return null;
          const computedShort = pd.jtmTypeShort || pd.jtrTypeShort || pd.skutmTypeShort || pd.kabelTypeShort;
          const computedLong = pd.jtmTypeLong || pd.jtrTypeLong || pd.skutmTypeLong || pd.kabelTypeLong;
          if (!computedShort) return null;
          return (
            <KonstruksiModal
              jenisJaringan={jenisJaringan}
              computedShort={computedShort}
              computedLong={computedLong}
              overrideValue={konstruksiOverrides[selectedKonstruksiIdx]}
              onSave={(val) => {
                commitHistory(`Edit konstruksi tiang #${selectedKonstruksiIdx + 1}`);
                setKonstruksiOverrides(prev => {
                  const next = { ...prev };
                  if (val === undefined) delete next[selectedKonstruksiIdx];
                  else next[selectedKonstruksiIdx] = val;
                  return next;
                });
                setSelectedKonstruksiIdx(null);
              }}
              onClose={() => setSelectedKonstruksiIdx(null)}
            />
          );
        })()}

        {/* Modal edit konstruksi — saved layer */}
        {selectedKonstruksiSaved !== null && (() => {
          const layer = savedLayers.find(l => l.id === selectedKonstruksiSaved.layerId);
          if (!layer) return null;
          const computedShort = computeKonstruksiShort(layer, selectedKonstruksiSaved.poleIdx);
          if (!computedShort) return null;
          return (
            <KonstruksiModal
              jenisJaringan={layer.jenisJaringan}
              computedShort={computedShort}
              computedLong={computedShort}
              overrideValue={(layer.konstruksiOverrides ?? {})[selectedKonstruksiSaved.poleIdx]}
              onSave={(val) => {
                commitHistory(`Edit konstruksi tiang tersimpan #${selectedKonstruksiSaved.poleIdx + 1}`);
                setSavedLayers(prev => prev.map(l => {
                  if (l.id !== selectedKonstruksiSaved.layerId) return l;
                  const overrides = { ...(l.konstruksiOverrides ?? {}) };
                  if (val === undefined) delete overrides[selectedKonstruksiSaved.poleIdx];
                  else overrides[selectedKonstruksiSaved.poleIdx] = val;
                  return { ...l, konstruksiOverrides: overrides };
                }));
                setSelectedKonstruksiSaved(null);
              }}
              onClose={() => setSelectedKonstruksiSaved(null)}
            />
          );
        })()}

        {/* ─── Indikator mode sambung aktif (Tugas 1) ─────────────────────── */}
        {/* Banner mengambang di bawah search bar saat user sedang memilih titik koneksi */}
        {connectMode && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1001] pointer-events-none
                          bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg
                          font-bold text-xs flex items-center gap-2">
            🔗 {connectFirst ? "Pilih titik ujung kedua untuk disambung" : "Pilih titik ujung jaringan pertama"}
          </div>
        )}

        {/* ─── Toast notifikasi sambungan berhasil (Tugas 1) ──────────────── */}
        {/* Muncul 2.5 detik setelah dua jaringan berhasil disambung, lalu hilang otomatis */}
        {connectNotif && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[2000] pointer-events-none
                          bg-green-600 text-white px-5 py-3 rounded-full shadow-2xl
                          font-bold text-sm flex items-center gap-2">
            {connectNotif}
          </div>
        )}

        <SearchBar
          searchInput={searchInput} setSearchInput={setSearchInput}
          searchResults={searchResults} isSearching={isSearching}
          searchFocused={searchFocused} setSearchFocused={setSearchFocused}
          activeResultIdx={activeResultIdx} setActiveResultIdx={setActiveResultIdx}
          onSelectLocation={handleSelectLocation} onKeyDown={handleSearchKeyDown}
          canUndo={history.length > 0} canRedo={redoStack.length > 0}
          onUndo={handleUndo} onRedo={handleRedo}
        />

        <MapContainer center={[-0.7893, 113.9213]} zoom={5} maxZoom={22} className="h-full w-full" ref={mapRef}>
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Google Maps (Jalan)">
              <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" maxNativeZoom={21} maxZoom={22} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Google Hybrid (Satelit + Label)">
              <TileLayer url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" maxNativeZoom={21} maxZoom={22} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Google Satelit Murni">
              <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" maxNativeZoom={21} maxZoom={22} />
            </LayersControl.BaseLayer>
          </LayersControl>

          <MapClickHandler mode={mode} setMode={setMode} editMode={editMode} handleMapClickForInsert={handleMapClickForInsert} onSnapClick={handleSnapClick} />
          <MapFlyTo target={flyTarget} zoom={flyZoom} />
          <MapCenterTracker centerRef={mapCenterRef} />

          <SavedLayersRenderer
            savedLayers={savedLayers} connections={connections} junctions={junctions} poles={poles}
            connectMode={connectMode} connectFirst={connectFirst}
            setConnectFirst={setConnectFirst} setConnectMode={setConnectMode}
            startPos={startPos} endPos={endPos}
            snapStart={snapStart} snapEnd={snapEnd} onLoadLayerForEdit={loadLayerForEdit}
            onConnected={handleConnected}
            onUpdateSchoorRotation={handleUpdateSchoorRotation}
            onUpdateSavedPole={handleUpdateSavedPole}
            onCreateJunction={handleCreateJunction}
            dragSource={dragSource}
            dragSnapTarget={dragSnapTarget}
            startDragConn={startDragConn}
            didDragRef={didDragRef}
            highlightedLayerIds={highlightedLayerIds}
            editMode={editMode}
            onPoleEdit={handleSavedPoleEdit}
            onEditKonstruksi={(layerId, poleIdx) => setSelectedKonstruksiSaved({ layerId, poleIdx })}
          />

          {/* Active network lines */}
          {line.length > 0 && (
            <Fragment key={`jalur-${lineColor}-${lineColor2}-${lineColor3}-${isDashed}-${jenisJaringan}`}>
              {isKabelTanah ? (
                <>
                  <Polyline positions={line} pathOptions={{ color: lineColor, weight: 8, opacity: 0.9 }} />
                  <Polyline positions={line} pathOptions={{ color: "white", weight: 3, opacity: 0.6, dashArray: "12, 8" }} />
                </>
              ) : (
                <>
                  {jenisJaringan === "SUTM + SKUTR" && line.length > 1 ? (() => {
                    try {
                      const lg = turf.lineString(line.map(p => [p[1], p[0]]));
                      const l1 = turf.lineOffset(lg, 0.8, { units: "meters" }).geometry.coordinates.map((p: number[]) => [p[1], p[0]] as [number, number]);
                      return <Polyline positions={l1} pathOptions={{ color: lineColor, weight: 4, opacity: 0.9 }} />;
                    } catch { return <Polyline positions={line} pathOptions={{ color: lineColor, weight: 4, opacity: 0.9 }} />; }
                  })() : (
                    <Polyline positions={line} pathOptions={{ color: lineColor, weight: 4, opacity: 0.9, dashArray: isDashed ? "8, 8" : undefined }} />
                  )}
                  {lineColor2 && line2Coords && <Polyline positions={line2Coords} pathOptions={{ color: lineColor2, weight: 4, opacity: 1, dashArray: isDashed2 ? "8, 8" : undefined }} />}
                  {lineColor3 && line3Coords && <Polyline positions={line3Coords} pathOptions={{ color: lineColor3, weight: 4, opacity: 1, dashArray: isDashed3 ? "8, 8" : undefined }} />}
                </>
              )}
            </Fragment>
          )}

          {/* Rubber band line saat drag-to-connect aktif */}
          {dragSource && dragMousePos && (
            <Polyline
              positions={[dragSource.pos, dragSnapTarget ? dragSnapTarget.pos : dragMousePos]}
              pathOptions={{
                color: dragSnapTarget ? "#22c55e" : "#f97316",
                weight: 2.5, dashArray: "6,4", opacity: 0.9,
              }}
            />
          )}

          {/* Active poles */}
          {poles.map((pos, idx) => {
            const isLast = idx === poles.length - 1;
            let segmentLabel = null;
            let dist = 0;
            if (!isLast) {
              const pt1 = turf.point([pos[1], pos[0]]);
              const pt2 = turf.point([poles[idx + 1][1], poles[idx + 1][0]]);
              dist = turf.distance(pt1, pt2, { units: "meters" });
              const mid = turf.midpoint(pt1, pt2);
              let displayAngle = turf.bearing(pt1, pt2) - 90;
              if (displayAngle > 90) displayAngle -= 180; else if (displayAngle < -90) displayAngle += 180;
              const labelIcon = L.divIcon({
                className: "bg-transparent border-0",
                html: `<div style="position: absolute; left: 0; top: 0; transform: translate(-50%, -50%) rotate(${displayAngle}deg) translateY(-14px); font-size: 13px; font-weight: 900; color: ${lineColor}; text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff; pointer-events: none; white-space: nowrap;">${dist.toFixed(0)} m</div>`,
                iconSize: [0, 0], iconAnchor: [0, 0],
              });
              segmentLabel = <Marker key={`label-${idx}`} position={[mid.geometry.coordinates[1], mid.geometry.coordinates[0]] as [number, number]} icon={labelIcon} interactive={false} />;
            }

            const pData = poleData[idx];
            const gardu = gardus[idx];
            const schoor = effectiveSchoors[idx];
            const isAutoSchoor = schoor && !schoors[idx];

            // Bisector / perpendicular angle for schoor
            let poleBearing = 0; let bisectorOutwardAngle = 0;
            if (poles.length > 1) {
              const perpAngle = (bearing: number) => bearing + (offsetSide >= 0 ? 90 : -90);
              if (idx === 0) {
                poleBearing = turf.bearing(turf.point([pos[1], pos[0]]), turf.point([poles[1][1], poles[1][0]]));
                bisectorOutwardAngle = perpAngle(poleBearing);
              } else if (isLast) {
                poleBearing = turf.bearing(turf.point([poles[idx - 1][1], poles[idx - 1][0]]), turf.point([pos[1], pos[0]]));
                bisectorOutwardAngle = perpAngle(poleBearing);
              } else {
                poleBearing = turf.bearing(turf.point([poles[idx - 1][1], poles[idx - 1][0]]), turf.point([pos[1], pos[0]]));
                const b1 = turf.bearing(turf.point([pos[1], pos[0]]), turf.point([poles[idx - 1][1], poles[idx - 1][0]])) * (Math.PI / 180);
                const b2 = turf.bearing(turf.point([pos[1], pos[0]]), turf.point([poles[idx + 1][1], poles[idx + 1][0]])) * (Math.PI / 180);
                const vx = Math.sin(b1) + Math.sin(b2); const vy = Math.cos(b1) + Math.cos(b2);
                if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) bisectorOutwardAngle = perpAngle(poleBearing);
                else bisectorOutwardAngle = Math.atan2(vx, vy) * (180 / Math.PI) + 180;
              }
            }

            const outwardAngleGrounding = poleBearing + (offsetSide > 0 ? 90 : -90);
            const poleSize = isLast ? basePoleSize + 4 : basePoleSize;
            const currentPoleBorder = isLast ? "#ff5722" : poleBorder;
            const groundingOffset = poleSize / 2 + 9;
            const isArrester = jenisJaringan.includes("SUTM") || jenisJaringan === "SKUTM";
            const isSkutmTerminasi = jenisJaringan === "SKUTM" && (pData.skutmTypeShort === "Trm" || pData.skutmTypeShort === "2xTrm");

            let mapLabelHtml = "";
            if (isKabelTanah) mapLabelHtml = pData.kabelTypeShort || "";
            else if (jenisJaringan === "SKUTM") mapLabelHtml = pData.skutmTypeShort || "";
            else if (pData.jtmTypeShort && pData.jtrTypeShort) mapLabelHtml = `${pData.jtmTypeShort}<br/>${pData.jtrTypeShort}`;
            else mapLabelHtml = `${pData.jtmTypeShort || pData.jtrTypeShort}`;
            if (gardu) mapLabelHtml += `<br/><span style="color:#7e22ce; font-size:10px;">Gardu ${gardu.jenis}<br/>${gardu.trafo}</span>`;
            if (schoor && isAutoSchoor) mapLabelHtml += `<br/><div style="color:#059669; background:#ecfdf5; padding:1px 4px; border-radius:4px; border:1px solid #6ee7b7; display:inline-block; margin-top:2px; font-size:9px;">⚡ AUTO</div>`;

            // Gardu SVG
            let visualGarduHtml = "";
            if (gardu) {
              visualGarduHtml = buildGarduSvg(gardu, poleSize, currentPoleBorder, isLast);
            }

            // Schoor SVG
            let visualSchoorHtml = "";
            if (schoor) {
              const rot = schoor.rotation !== undefined ? schoor.rotation : bisectorOutwardAngle;
              visualSchoorHtml = buildSchoorSvg(schoor, poleSize, rot, isAutoSchoor);
            }

            const isDragSrc = !!dragSource && dragSource.layerId === ACTIVE_LAYER_ID && dragSource.poleIdx === idx && dragSource.isFromActiveLayer;
            const isDragTgt = !!dragSnapTarget && dragSnapTarget.layerId === ACTIVE_LAYER_ID && dragSnapTarget.poleIdx === idx && dragSnapTarget.isFromActiveLayer;

            const customPoleIcon = L.divIcon({
              className: "custom-pole-icon",
              html: isDragSrc
                ? `<div style="position:relative;width:${poleSize}px;height:${poleSize}px;">
                     <div style="position:absolute;top:-6px;left:-6px;width:${poleSize+12}px;height:${poleSize+12}px;border:2.5px solid #f97316;border-radius:50%;opacity:0.6;"></div>
                     <div style="width:${poleSize}px;height:${poleSize}px;background:#f97316;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>
                   </div>`
                : isDragTgt
                ? `<div style="position:relative;width:${poleSize}px;height:${poleSize}px;">
                     <div style="position:absolute;top:-8px;left:-8px;width:${poleSize+16}px;height:${poleSize+16}px;border:3px solid #22c55e;border-radius:50%;opacity:0.7;"></div>
                     <div style="width:${poleSize}px;height:${poleSize}px;background:#22c55e;border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>
                   </div>`
                : `
                <div style="position: relative; width: ${poleSize}px; height: ${poleSize}px; z-index: 500; cursor: grab;">
                  ${visualGarduHtml}
                  ${visualSchoorHtml}
                  ${(isKabelTanah || isSkutmTerminasi) ? (() => {
                    const isTerminasi = isSkutmTerminasi || idx === 0 || idx === poles.length - 1;
                    const label = isSkutmTerminasi && pData.skutmTypeShort === "2xTrm" ? "2T" : "T";
                    const s = poleSize;
                    if (isTerminasi) {
                      return `<svg width="${s*2}" height="${s*2}" viewBox="-${s} -${s} ${s*2} ${s*2}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);overflow:visible;z-index:10;">
                        <polygon points="0,-${s*0.85} ${s*0.85},0 0,${s*0.85} -${s*0.85},0" fill="${poleBackground === "white" ? "white" : lineColor}" stroke="${poleBackground === "white" ? lineColor : "white"}" stroke-width="2.5"/>
                        <text x="0" y="1" text-anchor="middle" dominant-baseline="middle" font-size="${s*0.5}" font-weight="900" fill="${poleBackground === "white" ? lineColor : "white"}" font-family="monospace">${label}</text>
                      </svg>`;
                    } else {
                      const r = s * 0.85;
                      const pts = Array.from({ length: 8 }, (_, i) => { const a = (i * 45 - 22.5) * Math.PI / 180; return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`; }).join(" ");
                      return `<svg width="${s*2}" height="${s*2}" viewBox="-${s} -${s} ${s*2} ${s*2}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);overflow:visible;z-index:10;">
                        <polygon points="${pts}" fill="${poleBackground === "white" ? "white" : lineColor}" stroke="${poleBackground === "white" ? lineColor : "white"}" stroke-width="2"/>
                        <text x="0" y="1" text-anchor="middle" dominant-baseline="middle" font-size="${s*0.55}" font-weight="900" fill="${poleBackground === "white" ? lineColor : "white"}" font-family="monospace">J</text>
                      </svg>`;
                    }
                  })() : `<div style="background: ${poleBackground}; border: ${isLast ? "3px" : "2px"} solid ${currentPoleBorder}; width: 100%; height: 100%; border-radius: 50%; box-shadow: 0px 2px 4px rgba(0,0,0,0.5); position: relative; z-index: 10;"></div>`}
                  ${isSkutmTerminasi ? `
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(${outwardAngleGrounding}deg) translateY(-${groundingOffset}px); color: black; pointer-events: none; z-index: 5;">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(1px 1px 0px white);"><path d="M12 24v-6"/><path d="M8 18h8"/><path d="M8 14h8"/><path d="M12 14v-4"/><path d="M4 10h16"/><path d="M7 6h10"/><path d="M10 2h4"/></svg>
                    </div>
                  ` : pData.isGrounded ? `
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(${outwardAngleGrounding}deg) translateY(-${groundingOffset}px); color: black; pointer-events: none; z-index: 5;">
                      ${isArrester
                        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(1px 1px 0px white);"><path d="M12 24v-6"/><path d="M8 18h8"/><path d="M8 14h8"/><path d="M12 14v-4"/><path d="M4 10h16"/><path d="M7 6h10"/><path d="M10 2h4"/></svg>`
                        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(1px 1px 0px white);"><path d="M12 24v-10"/><path d="M4 14h16"/><path d="M7 10h10"/><path d="M10 6h4"/></svg>`
                      }
                    </div>
                  ` : ""}
                  ${mapLabelHtml ? `
                    <div style="position: absolute; top: ${poleSize + (gardu && gardu.jenis === "Portal" && gardu.orientasi === "Vertikal" ? 18 : 2)}px; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 900; color: #c2410c; text-align: center; line-height: 1.1; text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff; pointer-events: none; white-space: nowrap; z-index: 20;">
                      ${mapLabelHtml}
                    </div>
                  ` : ""}
                </div>
              `,
              iconSize: [poleSize, poleSize],
              iconAnchor: [poleSize / 2, poleSize / 2],
            });

            return (
              <Fragment key={`pole-group-${idx}`}>
                {segmentLabel}
                <Marker position={pos} icon={customPoleIcon} draggable={editMode === null && !rotatingSchoor}
                  eventHandlers={{
                    mousedown: (e) => {
                      const target = e.originalEvent.target as HTMLElement;
                      if (target.closest('.schoor-handle')) {
                        L.DomEvent.preventDefault(e.originalEvent);
                        L.DomEvent.stopPropagation(e.originalEvent);
                        const rect = (e.originalEvent.target as HTMLElement).closest('.custom-pole-icon')!.getBoundingClientRect();
                        const cx = rect.left + rect.width / 2;
                        const cy = rect.top + rect.height / 2;
                        commitHistory("Rotasi schoor");
                        setRotatingSchoor({ poleIdx: idx, cx, cy });
                        return;
                      }
                    },
                    click: () => {
                      if (didDragRef.current) { didDragRef.current = false; return; }
                      if (editMode === "delete") handleDeletePole(idx);
                      else if (editMode === "gardu") {
                        if (gardus[idx]) setSelectedGarduIdx(idx);
                        else { commitHistory(`Pasang gardu ${paletteGarduJenis}`); setGardus(prev => ({ ...prev, [idx]: { jenis: paletteGarduJenis, orientasi: paletteGarduOrientasi, trafo: paletteGarduTrafo } })); }
                      } else if (editMode === "schoor") {
                        if (schoors[idx]) setSelectedSchoorIdx(idx);
                        else { commitHistory(`Pasang schoor ${paletteSchoorJenis}`); setSchoors(prev => ({ ...prev, [idx]: { jenis: paletteSchoorJenis, rotation: bisectorOutwardAngle } })); }
                      } else if (editMode === "konstruksi") {
                        setSelectedKonstruksiIdx(idx);
                      }
                    },
                    dragend: (e) => {
                      if (editMode === null) handlePoleDrag(idx, [e.target.getLatLng().lat, e.target.getLatLng().lng]);
                    },
                  }}
                >
                  {editMode === null && (
                    <Popup>
                      <div className="text-center w-56">
                        <b className="text-[14px] text-blue-700">
                          {isKabelTanah
                            ? (idx === 0 || isLast ? `Terminasi ${idx === 0 ? "Awal" : "Akhir"}` : `Jointing #${idx}`)
                            : (isLast ? "Tiang Akhir (N)" : `Tiang ${jenisJaringan} #${idx + 1}`)}
                        </b><br />
                        {gardu && (
                          <div className="bg-purple-100 p-2 mt-2 border border-purple-300 rounded text-purple-900 font-bold text-xs shadow-sm">
                            ⚡ GARDU {gardu.jenis.toUpperCase()} <br />Trafo Kapasitas {gardu.trafo}
                          </div>
                        )}
                        {schoor && (
                          <div className={`p-2 mt-2 border rounded font-bold text-xs shadow-sm ${isAutoSchoor ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-emerald-100 border-emerald-300 text-emerald-900"}`}>
                            ⚓ PENOPANG: {schoor.jenis.toUpperCase()}
                            {isAutoSchoor && <span className="ml-1 bg-emerald-200 text-emerald-700 px-1 rounded text-[10px]">AUTO ⚡</span>}
                          </div>
                        )}
                        <div className="bg-gray-50 p-2.5 rounded-md mt-2 text-left text-xs border border-gray-200 flex flex-col gap-1 shadow-sm">
                          <p><span className="text-gray-500 font-semibold w-16 inline-block">Status</span>: <span className="font-bold">{statusJaringan}</span></p>
                          {!isKabelTanah && <>
                            <p><span className="text-gray-500 font-semibold w-16 inline-block">Material</span>: Tiang {materialTiang}</p>
                            <p><span className="text-gray-500 font-semibold w-16 inline-block">Tinggi</span>: {tinggiTiang} Meter</p>
                          </>}
                          <p><span className="text-gray-500 font-semibold w-16 inline-block">{isKabelTanah ? "Seksi" : "Gawang"}</span>: {isLast ? "Ujung" : dist.toFixed(1) + " m"}</p>
                          {pData.angle > 0 && (
                            <p><span className="text-gray-500 font-semibold w-16 inline-block">Sudut</span>: <span className={pData.angle >= autoSchoorThreshold && autoSchoor ? "text-emerald-700 font-bold" : ""}>{pData.angle.toFixed(1)}°</span></p>
                          )}
                          {!isKabelTanah && <div className="border-t border-gray-200 my-1 pt-1">
                            <p className="text-orange-600 font-bold mb-1">⚙️ Konstruksi Jaringan:</p>
                            <div className="flex flex-col gap-1">
                              {pData.jtmTypeLong && (<div className="bg-blue-100 p-1.5 rounded"><span className="font-bold text-blue-800">TM:</span> {pData.jtmTypeLong}</div>)}
                              {pData.jtrTypeLong && (
                                <div className="bg-orange-100 p-1.5 rounded flex items-center justify-between">
                                  <div><span className="font-bold text-orange-800">TR:</span> {pData.jtrTypeLong}</div>
                                  {pData.isGrounded && (
                                    <span title={isArrester ? "Terpasang Arrester (LA)" : "Terpasang Grounding (Arde)"}>
                                      {isArrester
                                        ? <svg className="w-5 h-5 ml-1 text-black" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 24v-6" /><path d="M8 18h8" /><path d="M8 14h8" /><path d="M12 14v-4" /><path d="M4 10h16" /><path d="M7 6h10" /><path d="M10 2h4" /></svg>
                                        : <svg className="w-5 h-5 ml-1 text-black" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 24v-10" /><path d="M4 14h16" /><path d="M7 10h10" /><path d="M10 6h4" /></svg>
                                      }
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>}
                          {isKabelTanah && (
                            <div className="border-t border-gray-200 my-1 pt-1">
                              <p className="text-amber-700 font-bold mb-1">🔌 Konstruksi SKTM/SKTR:</p>
                              <div className={`p-1.5 rounded text-xs ${idx === 0 || isLast ? "bg-amber-100" : "bg-orange-50"}`}>
                                <span className="font-bold">{idx === 0 || isLast ? "◆ TERMINASI" : "⬡ JOINTING"}</span>
                                <br />{idx === 0 || isLast ? "Sambungan ujung kabel ke peralatan / jaringan overhead" : "Sambungan kabel bawah tanah antar seksi"}
                              </div>
                            </div>
                          )}
                        </div>
                        {(pData.jtmTypeShort || pData.jtrTypeShort || pData.skutmTypeShort || pData.kabelTypeShort) && (
                          <div className="mt-2 flex justify-center">
                            <button
                              onClick={() => setSelectedKonstruksiIdx(idx)}
                              className="text-[11px] bg-orange-500 text-white px-3 py-1 rounded-full font-bold hover:bg-orange-600"
                            >
                              ✏️ Konstruksi{konstruksiOverrides[idx] ? " (override)" : ""}
                            </button>
                          </div>
                        )}
                      </div>
                    </Popup>
                  )}
                </Marker>
              </Fragment>
            );
          })}
        </MapContainer>

      </div>

      {/* SIDEBAR */}
      <div className="w-[420px] bg-white shadow-2xl p-6 flex flex-col gap-4 z-10 overflow-y-auto">
        <div className="border-b pb-2">
          <h1 className="text-3xl font-extrabold text-blue-700 tracking-tight">SPARK</h1>
          <p className="text-sm text-gray-500 font-medium">Sistem Pemetaan Pintar Rencana Kelistrikan</p>
        </div>

        <ComponentPalette
          poles={poles} editMode={editMode} isKabelTanah={isKabelTanah}
          paletteGarduJenis={paletteGarduJenis} paletteGarduTrafo={paletteGarduTrafo}
          setPaletteGarduTrafo={setPaletteGarduTrafo} paletteGarduOrientasi={paletteGarduOrientasi}
          setPaletteGarduOrientasi={setPaletteGarduOrientasi} trafoOptions={trafoOptions}
          paletteSchoorJenis={paletteSchoorJenis}
          savedLayers={savedLayers} connections={connections} connectMode={connectMode}
          connectFirst={connectFirst} setConnections={setConnections}
          setConnectMode={setConnectMode} setConnectFirst={setConnectFirst}
          activatePalette={activatePalette} toggleEditMode={toggleEditMode}
          highlightedLayerIds={highlightedLayerIds}
        />

        {junctions.length > 0 && (
          <div className="border border-purple-200 p-3 rounded-xl bg-purple-50 flex items-start gap-2">
            <span className="text-purple-500 text-lg flex-shrink-0">⑂</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-purple-700">
                {junctions.length} Junction Aktif
              </p>
              <p className="text-[10px] text-purple-500 mt-0.5">
                Tiang tergabung secara topologis
              </p>
            </div>
            <button
              onClick={() => setJunctions([])}
              className="text-[10px] text-red-400 hover:text-red-600 font-bold flex-shrink-0"
              title="Hapus semua junction"
            >
              ✕
            </button>
          </div>
        )}

        {!isKabelTanah && (
          <AutoSchoorCard
            autoSchoor={autoSchoor} setAutoSchoor={setAutoSchoor}
            autoSchoorThreshold={autoSchoorThreshold} setAutoSchoorThreshold={setAutoSchoorThreshold}
            autoSchoorCount={autoSchoorCount} polesLength={poles.length}
          />
        )}

        {poles.length > 0 && (
          <button
            onClick={() => setRekapOpen(true)}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all shadow-md
              bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 hover:shadow-lg active:scale-[0.98]"
          >
            <span>📋</span> Rekap Konstruksi Gambar
          </button>
        )}

        <NetworkSettings
          jenisJaringan={jenisJaringan} setJenisJaringan={setJenisJaringan}
          statusJaringan={statusJaringan} setStatusJaringan={setStatusJaringan}
          jarakGawang={jarakGawang} setJarakGawang={setJarakGawang}
          tinggiTiang={tinggiTiang} setTinggiTiang={setTinggiTiang}
          materialTiang={materialTiang} setMaterialTiang={setMaterialTiang}
          offsetSide={offsetSide} setOffsetSide={setOffsetSide}
          isKabelTanah={isKabelTanah}
        />

        <TentikanTitikCard
          mode={mode} snapStart={snapStart} snapEnd={snapEnd}
          onSetStart={() => { setMode("start"); setEditMode(null); setSnapStart(null); }}
          onSetEnd={() => { setMode("end"); setEditMode(null); setSnapEnd(null); }}
          onClearStart={() => setSnapStart(null)}
          onClearEnd={() => setSnapEnd(null)}
        />

        <LayerManager
          savedLayers={savedLayers} junctions={junctions} poles={poles}
          jenisJaringan={jenisJaringan} statusJaringan={statusJaringan}
          activeEditLayerId={activeEditLayerId}
          saveName={saveName} setSaveName={setSaveName}
          groupNames={groupNames}
          onLoadLayer={loadLayerForEdit}
          onDeleteLayer={handleDeleteLayer}
          onSave={() => saveCurrentAsLayer()}
          onRenameLayer={handleRenameLayer}
          onRenameGroup={handleRenameGroup}
          onMergeGroup={handleMergeGroup}
          highlightedLayerIds={highlightedLayerIds}
          onSetHighlightedLayerIds={setHighlightedLayerIds}
        />

        {/* ─── Undo / Redo ─────────────────────────────────────────────────── */}
        <div className="border-2 border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
          <div className="flex gap-1.5 px-3 pt-3 pb-2">
            <button onClick={handleUndo} disabled={history.length === 0} title="Undo (Ctrl+Z)"
              className={`flex-1 py-1.5 text-xs rounded-lg font-bold border transition-all flex items-center justify-center gap-1 ${history.length > 0 ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-100" : "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed"}`}>
              ↩ Undo {history.length > 0 && <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full text-[9px] font-bold">{history.length}</span>}
            </button>
            <button onClick={handleRedo} disabled={redoStack.length === 0} title="Redo (Ctrl+Y)"
              className={`flex-1 py-1.5 text-xs rounded-lg font-bold border transition-all flex items-center justify-center gap-1 ${redoStack.length > 0 ? "bg-white border-amber-300 text-amber-700 hover:bg-amber-50" : "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed"}`}>
              ↪ Redo {redoStack.length > 0 && <span className="bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold">{redoStack.length}</span>}
            </button>
            <button onClick={() => setUndoLogOpen(v => !v)} disabled={history.length === 0 && redoStack.length === 0}
              className={`px-2.5 text-xs rounded-lg border transition-all ${history.length > 0 || redoStack.length > 0 ? "bg-white border-gray-300 text-gray-500 hover:bg-gray-100" : "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed"}`}
              title="Riwayat aksi">☰</button>
          </div>
          {undoLogOpen && (
            <div className="border-t border-gray-200 px-3 pb-3">
              <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mt-2 mb-1">Riwayat — klik untuk lompat</p>
              <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
                {[...redoStack].reverse().map((h, i) => (
                  <div key={`r${i}`} className="text-[10px] px-2 py-0.5 text-amber-400 italic flex items-center gap-1 opacity-70">
                    <span className="text-[9px]">⟳</span><span>{h.description}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1 py-0.5">
                  <div className="flex-1 border-t border-blue-300" />
                  <span className="text-[9px] text-blue-500 font-bold">sekarang</span>
                  <div className="flex-1 border-t border-blue-300" />
                </div>
                {[...history].reverse().map((h, ri) => {
                  const oi = history.length - 1 - ri;
                  return (
                    <button key={`h${oi}`} onClick={() => handleJumpTo(oi)}
                      className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 w-full text-left transition-colors ${ri === 0 ? "bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}>
                      {ri === 0 && <span className="text-[9px]">▶</span>}
                      <span className={ri === 0 ? "" : "ml-3"}>{h.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <ExecCard
          routingMode={routingMode} setRoutingMode={setRoutingMode}
          isLoading={isLoading} onGenerate={handleGenerate} onClear={handleClear}
        />
      </div>
    </div>
  );
}
