"use client";
import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import { Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import type { NetworkLayer, Connection, ConnectFirstState, JunctionInfo, DragSource, DragTarget } from "../../types/spark";
import { getLayerColor } from "../../lib/layerColors";
import { buildSchoorSvg, buildGarduSvg } from "../../lib/svgUtils";

interface Props {
  savedLayers: NetworkLayer[];
  connections: Connection[];
  junctions: JunctionInfo[];
  connectMode: boolean;
  connectFirst: ConnectFirstState;
  setConnectFirst: (v: ConnectFirstState) => void;
  setConnectMode: (v: boolean) => void;
  startPos: [number, number] | null;
  endPos: [number, number] | null;
  poles: [number, number][];
  snapStart: { layerId: number; label: string; isMidLine?: boolean } | null;
  snapEnd: { layerId: number; label: string; isMidLine?: boolean } | null;
  onLoadLayerForEdit: (layer: NetworkLayer) => void;
  onConnected?: () => void;
  onUpdateSchoorRotation: (layerId: number, poleIdx: number, rotation: number) => void;
  onUpdateSavedPole: (layerId: number, poleIdx: number, newLatLng: [number, number]) => void;
  onCreateJunction: (hostLayerId: number, hostPoleIdx: number, branchLayerId: number, branchPoleIdx: number) => void;

  // Props for drag-to-connect (managed by parent SparkMap)
  dragSource: DragSource | null;
  dragSnapTarget: DragTarget | null;
  startDragConn: (layerId: number, label: string, pos: [number, number], poleIdx: number, isFromActiveLayer?: boolean) => void;
  didDragRef: React.MutableRefObject<boolean>;
  /** Layer IDs yang di-highlight saat mode group-edit aktif */
  highlightedLayerIds: Set<number>;
  editMode?: "insert" | "delete" | "gardu" | "schoor" | "konstruksi" | null;
  onPoleEdit?: (layerId: number, poleIdx: number, mode: string) => void;
  onEditKonstruksi?: (layerId: number, poleIdx: number) => void;
}

// ─── Tipe data untuk state rotasi aktif ──────────────────────────────────────
interface RotatingState {
  layerId: number; poleIdx: number; centerX: number; centerY: number;
}

// ─── Helper: hitung sudut bisector/tegak-lurus untuk schoor ─────────────────
function computeBisectorAngle(
  poles: [number, number][],
  idx: number,
  offsetSide: number
): number {
  if (poles.length < 2) return 0;
  const pt = (p: [number, number]) => turf.point([p[1], p[0]]);
  const isLast = idx === poles.length - 1;
  const perpAngle = (b: number) => b + (offsetSide >= 0 ? 90 : -90);

  if (idx === 0) return perpAngle(turf.bearing(pt(poles[0]), pt(poles[1])));
  if (isLast)   return perpAngle(turf.bearing(pt(poles[idx - 1]), pt(poles[idx])));

  const poleBearing = turf.bearing(pt(poles[idx - 1]), pt(poles[idx]));
  const b1 = turf.bearing(pt(poles[idx]), pt(poles[idx - 1])) * (Math.PI / 180);
  const b2 = turf.bearing(pt(poles[idx]), pt(poles[idx + 1])) * (Math.PI / 180);
  const vx = Math.sin(b1) + Math.sin(b2);
  const vy = Math.cos(b1) + Math.cos(b2);
  if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) return perpAngle(poleBearing);
  return Math.atan2(vx, vy) * (180 / Math.PI) + 180;
}

export default function SavedLayersRenderer({
  savedLayers, connections, junctions, connectMode, connectFirst,
  setConnectFirst, setConnectMode,
  startPos, endPos, snapStart, snapEnd, onLoadLayerForEdit,
  onConnected, onUpdateSchoorRotation, onUpdateSavedPole, onCreateJunction, poles,
  dragSource, dragSnapTarget, startDragConn, didDragRef,
  highlightedLayerIds, editMode, onPoleEdit, onEditKonstruksi
}: Props) {
  const map = useMap();
  const mapContainerRef = useRef<HTMLElement | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const rotatingRef = useRef<RotatingState | null>(null);
  const rafRef = useRef<number | null>(null);
  // ─── Pending drag-to-connect (200ms delay, cancelled by Leaflet dragstart) ───
  const pendingDragConnRef = useRef<{ layerId: number; label: string; pos: [number,number]; poleIdx: number } | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleDragConn = useCallback((layerId: number, label: string, pos: [number,number], poleIdx: number) => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingDragConnRef.current = { layerId, label, pos, poleIdx };
    pendingTimerRef.current = setTimeout(() => {
      const p = pendingDragConnRef.current;
      if (p) { startDragConn(p.layerId, p.label, p.pos, p.poleIdx); pendingDragConnRef.current = null; }
    }, 200);
  }, [startDragConn]);

  const cancelPendingDragConn = useCallback(() => {
    if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
    pendingDragConnRef.current = null;
  }, []);

  useEffect(() => {
    mapContainerRef.current = map.getContainer();
  }, [map]);

  // ─── Mulai mode rotasi schoor ─────────────────────────────────────────────
  const startRotation = useCallback((layerId: number, poleIdx: number, pos: [number, number]) => {
    const containerPoint = map.latLngToContainerPoint(L.latLng(pos[0], pos[1]));
    rotatingRef.current = { layerId, poleIdx, centerX: containerPoint.x, centerY: containerPoint.y };
    map.dragging.disable();
    map.getContainer().style.cursor = "crosshair";
    setIsRotating(true);
  }, [map]);

  // ─── Effect: listener mouse saat rotasi aktif ─────────────────────────────
  useEffect(() => {
    if (!isRotating) return;
    const container = mapContainerRef.current;
    if (!container) return;

    const onMouseMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const state = rotatingRef.current;
        if (!state) return;
        const rect = container.getBoundingClientRect();
        const dx = (e.clientX - rect.left) - state.centerX;
        const dy = (e.clientY - rect.top) - state.centerY;
        const rawAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        const snapped = Math.round(((rawAngle % 360) + 360) % 360 / 5) * 5 % 360;
        onUpdateSchoorRotation(state.layerId, state.poleIdx, snapped);
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      map.dragging.enable();
      map.getContainer().style.cursor = "";
      setIsRotating(false);
      rotatingRef.current = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRotating, onUpdateSchoorRotation, map]);

  // Pre-compute junction sets
  const suppressedPoles = new Set<string>();
  const a3HostPoles = new Set<string>();
  for (const j of junctions) {
    suppressedPoles.add(`${j.branchLayerId}-${j.branchPoleIdx}`);
    a3HostPoles.add(`${j.hostLayerId}-${j.hostPoleIdx}`);
  }

  // Pole dragging is allowed only when NOT in connect mode and NOT rotating
  const isDraggablePole = !connectMode && !isRotating;

  return (
    <>
      {savedLayers.map(layer => {
        const isKT = layer.jenisJaringan === "SKTM" || layer.jenisJaringan === "SKTR";
        const isSkutm = layer.jenisJaringan === "SKUTM";
        const lc = getLayerColor(layer.jenisJaringan, layer.statusJaringan);
        const isDash = layer.jenisJaringan === "SKUTR";

        // Pre-compute cumulative distances untuk SKUTM
        const skutmCumDists: number[] = [];
        if (isSkutm && layer.poles.length > 0) {
          skutmCumDists[0] = 0;
          for (let i = 1; i < layer.poles.length; i++) {
            const a = layer.poles[i - 1]; const b = layer.poles[i];
            const R = 6371000;
            const dLat = (b[0] - a[0]) * Math.PI / 180;
            const dLon = (b[1] - a[1]) * Math.PI / 180;
            const s = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180) * Math.cos(b[0]*Math.PI/180) * Math.sin(dLon/2)**2;
            skutmCumDists[i] = skutmCumDists[i - 1] + R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
          }
        }
        return (
          <Fragment key={`saved-layer-${layer.id}`}>
            {isKT ? (
              <>
                <Polyline positions={layer.line} pathOptions={{ color: lc, weight: 8, opacity: 0.75 }} />
                <Polyline positions={layer.line} pathOptions={{ color: "white", weight: 3, opacity: 0.5, dashArray: "12,8" }} />
              </>
            ) : layer.jenisJaringan === "SUTM + SKUTR" ? (
              // Dua garis paralel ±1.5m — cukup rapat sehingga keduanya menembus lingkaran tiang
              (() => {
                const skutrColor = layer.statusJaringan === "Perluasan" ? "darkgreen" : lc;
                if (layer.line.length < 2) return <Polyline positions={layer.line} pathOptions={{ color: lc, weight: 4, opacity: 0.75 }} />;
                try {
                  const lg = turf.lineString(layer.line.map(p => [p[1], p[0]]));
                  const l1 = turf.lineOffset(lg,  0.8, { units: "meters" }).geometry.coordinates.map((p: number[]) => [p[1], p[0]] as [number, number]);
                  const l2 = turf.lineOffset(lg, -0.8, { units: "meters" }).geometry.coordinates.map((p: number[]) => [p[1], p[0]] as [number, number]);
                  return (<>
                    <Polyline positions={l1} pathOptions={{ color: lc, weight: 4, opacity: 0.75 }} />
                    <Polyline positions={l2} pathOptions={{ color: skutrColor, weight: 4, opacity: 0.75, dashArray: "8,8" }} />
                  </>);
                } catch {
                  return <Polyline positions={layer.line} pathOptions={{ color: lc, weight: 4, opacity: 0.75 }} />;
                }
              })()
            ) : layer.jenisJaringan.includes("Underbuild") ? (
              // Underbuild: garis paralel di-offset kiri/kanan
              (() => {
                let line2: [number,number][] | null = null;
                let line3: [number,number][] | null = null;
                if (layer.line.length > 1) {
                  try {
                    const lg = turf.lineString(layer.line.map(p => [p[1], p[0]]));
                    line2 = turf.lineOffset(lg, 3.5, { units: "meters" }).geometry.coordinates.map((p: number[]) => [p[1], p[0]] as [number, number]);
                    if (layer.jenisJaringan.includes("3 Jaringan"))
                      line3 = turf.lineOffset(lg, -3.5, { units: "meters" }).geometry.coordinates.map((p: number[]) => [p[1], p[0]] as [number, number]);
                  } catch { /* abaikan error geometri */ }
                }
                return (<>
                  <Polyline positions={layer.line} pathOptions={{ color: lc, weight: 4, opacity: 0.75 }} />
                  {line2 && <Polyline positions={line2} pathOptions={{ color: lc, weight: 4, opacity: 0.75, dashArray: "8,8" }} />}
                  {line3 && <Polyline positions={line3} pathOptions={{ color: lc, weight: 4, opacity: 0.75, dashArray: "4,4" }} />}
                </>);
              })()
            ) : (
              <Polyline positions={layer.line} pathOptions={{ color: lc, weight: 4, opacity: 0.75, dashArray: isDash ? "8,8" : undefined }} />
            )}

            {/* Segment labels (Distance) */}
            {layer.poles.map((pos, idx) => {
              if (idx === layer.poles.length - 1) return null;
              const p1 = turf.point([pos[1], pos[0]]);
              const p2 = turf.point([layer.poles[idx + 1][1], layer.poles[idx + 1][0]]);
              const dist = turf.distance(p1, p2, { units: "meters" });
              const mid = turf.midpoint(p1, p2);
              let angle = turf.bearing(p1, p2) - 90;
              if (angle > 90) angle -= 180; else if (angle < -90) angle += 180;
              
              const labelIcon = L.divIcon({
                className: "bg-transparent border-0",
                html: `<div style="position: absolute; left: 0; top: 0; transform: translate(-50%, -50%) rotate(${angle}deg) translateY(-14px); font-size: 13px; font-weight: 900; color: ${lc}; text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff; pointer-events: none; white-space: nowrap;">${dist.toFixed(0)} m</div>`,
                iconSize: [0, 0], iconAnchor: [0, 0],
              });
              
              return (
                <Marker
                  key={`dist-${layer.id}-${idx}`}
                  position={[mid.geometry.coordinates[1], mid.geometry.coordinates[0]] as [number, number]}
                  icon={labelIcon}
                  interactive={false}
                />
              );
            })}

            {layer.poles.map((pos, idx) => {
              if (suppressedPoles.has(`${layer.id}-${idx}`)) return null;

              const isLastP = idx === layer.poles.length - 1;
              const isJunctionHost = a3HostPoles.has(`${layer.id}-${idx}`);
              const isTerminasi = isKT && (idx === 0 || isLastP);
              // Deteksi dini: SUTM host yang tersambung ke SKTM → tampil sebagai terminasi
              const overrideToTerminasi = isJunctionHost && !isKT && junctions.some(j => {
                if (j.hostLayerId !== layer.id || j.hostPoleIdx !== idx) return false;
                const bj = savedLayers.find(l => l.id === j.branchLayerId)?.jenisJaringan;
                return bj === "SKTM" || bj === "SKTR";
              });
              const sz = 17;
              const bg = layer.statusJaringan === "Existing" ? lc : "white";
              const bd = layer.statusJaringan === "Existing" ? "white" : lc;

              const schoor = layer.schoors[idx];
              const schoorHtml = schoor
                ? (() => {
                    const bisector = computeBisectorAngle(layer.poles, idx, layer.offsetSide);
                    const rot = schoor.rotation !== undefined ? schoor.rotation : bisector;
                    return buildSchoorSvg(schoor, sz, rot, false);
                  })()
                : "";

              // ── Sudut dan span — dihitung lebih awal agar bisa dipakai SKUTM dan poleBodyHtml ──
              const ptCurrent = turf.point([pos[1], pos[0]]);
              let maxSpan = 0; let angle = 0;
              if (idx < layer.poles.length - 1) maxSpan = Math.max(maxSpan, turf.distance(ptCurrent, turf.point([layer.poles[idx + 1][1], layer.poles[idx + 1][0]]), { units: "meters" }));
              if (idx > 0) maxSpan = Math.max(maxSpan, turf.distance(ptCurrent, turf.point([layer.poles[idx - 1][1], layer.poles[idx - 1][0]]), { units: "meters" }));
              if (idx > 0 && idx < layer.poles.length - 1) {
                const b1 = turf.bearing(turf.point([layer.poles[idx - 1][1], layer.poles[idx - 1][0]]), ptCurrent);
                const b2 = turf.bearing(ptCurrent, turf.point([layer.poles[idx + 1][1], layer.poles[idx + 1][0]]));
                let diff = Math.abs(b2 - b1); if (diff > 180) diff = 360 - diff; angle = diff;
              }

              const terminasiDiamondSvg = (fill: string, stroke: string, label = "T") =>
                `<svg width="${sz*2}" height="${sz*2}" viewBox="-${sz} -${sz} ${sz*2} ${sz*2}" style="overflow:visible;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;"><polygon points="0,-${sz*0.85} ${sz*0.85},0 0,${sz*0.85} -${sz*0.85},0" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/><text x="0" y="1" text-anchor="middle" dominant-baseline="middle" font-size="${sz*0.5}" font-weight="900" fill="${stroke}" font-family="monospace">${label}</text></svg>`;

              // Hitung SKUTM construction type (angle sudah tersedia di atas)
              let skutmType = "";
              if (isSkutm) {
                if (idx === 0 || isLastP) { skutmType = "Trm"; }
                else {
                  const cumDist = skutmCumDists[idx] ?? 0;
                  const mod1000 = cumDist % 1000; const mod500 = cumDist % 500;
                  if (mod1000 < 25 || mod1000 > 975) skutmType = "2xTrm";
                  else if (mod500 < 25 || mod500 > 475) skutmType = "Trm";
                  else if (angle > 75) skutmType = "2xTrm";
                  else if (angle > 5) skutmType = "LA";
                  else skutmType = "S";
                }
              }
              const isSkutmTerminasi = isSkutm && (skutmType === "Trm" || skutmType === "2xTrm");

              const poleBodyHtml = overrideToTerminasi
                ? terminasiDiamondSvg(bg === "white" ? "white" : lc, bg === "white" ? lc : "white")
                : isSkutmTerminasi
                ? terminasiDiamondSvg(bg === "white" ? "white" : lc, bg === "white" ? lc : "white", skutmType === "2xTrm" ? "2T" : "T")
                : isKT
                ? (() => {
                    if (isTerminasi) return terminasiDiamondSvg(bg === "white" ? "white" : lc, bg === "white" ? lc : "white");
                    const r = sz * 0.85;
                    const pts = Array.from({ length: 8 }, (_, i) => { const a = (i * 45 - 22.5) * Math.PI / 180; return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`; }).join(" ");
                    return `<svg width="${sz*2}" height="${sz*2}" viewBox="-${sz} -${sz} ${sz*2} ${sz*2}" style="overflow:visible;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;"><polygon points="${pts}" fill="${bg === "white" ? "white" : lc}" stroke="${bg === "white" ? lc : "white"}" stroke-width="2"/><text x="0" y="1" text-anchor="middle" dominant-baseline="middle" font-size="${sz*0.55}" font-weight="900" fill="${bg === "white" ? lc : "white"}" font-family="monospace">J</text></svg>`;
                  })()
                : `<div style="width:${sz}px;height:${sz}px;background:${bg};border:2px solid ${bd};border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.4);position:relative;z-index:10;"></div>`;

              const isConnectTarget = connectMode;
              const isConnectFirstPole = connectFirst !== null && connectFirst.layerId === layer.id && connectFirst.poleIdx === idx;
              const isDragSrc = !!dragSource && dragSource.layerId === layer.id && dragSource.poleIdx === idx && !dragSource.isFromActiveLayer;
              const isDragTgt = !!dragSnapTarget && dragSnapTarget.layerId === layer.id && dragSnapTarget.poleIdx === idx && !dragSnapTarget.isFromActiveLayer;

              // ── Konstruksi Jaringan Label (A1/A2, dll) ──
              let jtrType = "";
              if (layer.jenisJaringan.includes("SKUTR") || layer.jenisJaringan.includes("Underbuild")) {
                jtrType = "S";
                if (idx === 0) jtrType = "FDE";
                else if (isLastP) jtrType = "BDL+DE";
                else if (angle > 15) jtrType = "LA";
              }
              let jtmType = "";
              if (layer.jenisJaringan.includes("SUTM")) {
                if (layer.poles.length < 2) jtmType = "A1";
                else if (maxSpan >= 70) jtmType = "B3";
                else if (idx === 0 || isLastP || (idx + 1) % 10 === 0) jtmType = "A3";
                else if (angle > 30) jtmType = "2xA3";
                else if (angle >= 10) jtmType = "A2";
                else jtmType = "A1";
              }

              // Terapkan override konstruksi jika ada
              const konstruksiOverride = (layer.konstruksiOverrides ?? {})[idx];
              if (konstruksiOverride) {
                if (layer.jenisJaringan.includes("SUTM")) jtmType = konstruksiOverride;
                else if (layer.jenisJaringan.includes("SKUTR") || layer.jenisJaringan.includes("Underbuild")) jtrType = konstruksiOverride;
                else if (layer.jenisJaringan === "SKUTM") skutmType = konstruksiOverride;
              }
              
              // Hitung konstruksi gabungan untuk junction host
              let combinedSuffix = "";
              if (isJunctionHost && !overrideToTerminasi) {
                const hostJunctions = junctions.filter(j => j.hostLayerId === layer.id && j.hostPoleIdx === idx);
                const branchParts = hostJunctions.map(j => {
                  const bLayer = savedLayers.find(l => l.id === j.branchLayerId);
                  if (!bLayer) return "";
                  if (bLayer.jenisJaringan === "SKTM" || bLayer.jenisJaringan === "SKTR") return "";
                  if (!bLayer.jenisJaringan.includes("SUTM") || bLayer.poles.length < 2) return "";
                  const bIdx = j.branchPoleIdx;
                  const bPoles = bLayer.poles;
                  const bIsEnd = bIdx === 0 || bIdx === bPoles.length - 1;
                  const bPt = turf.point([bPoles[bIdx][1], bPoles[bIdx][0]]);

                  // Hitung sudut belokan branch
                  let bAngle = 0;
                  if (bIdx > 0 && bIdx < bPoles.length - 1) {
                    const bb1 = turf.bearing(turf.point([bPoles[bIdx - 1][1], bPoles[bIdx - 1][0]]), bPt);
                    const bb2 = turf.bearing(bPt, turf.point([bPoles[bIdx + 1][1], bPoles[bIdx + 1][0]]));
                    let bdiff = Math.abs(bb2 - bb1); if (bdiff > 180) bdiff = 360 - bdiff;
                    bAngle = bdiff;
                  }

                  // jtmType untuk SUTM
                  let bJtm = "";
                  if (bLayer.jenisJaringan.includes("SUTM")) {
                    let bMaxSpan = 0;
                    if (bIdx < bPoles.length - 1) bMaxSpan = Math.max(bMaxSpan, turf.distance(bPt, turf.point([bPoles[bIdx + 1][1], bPoles[bIdx + 1][0]]), { units: "meters" }));
                    if (bIdx > 0) bMaxSpan = Math.max(bMaxSpan, turf.distance(bPt, turf.point([bPoles[bIdx - 1][1], bPoles[bIdx - 1][0]]), { units: "meters" }));
                    if (bMaxSpan >= 70) bJtm = "B3";
                    else if (bIsEnd || (bIdx + 1) % 10 === 0) bJtm = "A3";
                    else if (bAngle > 30) bJtm = "2xA3";
                    else if (bAngle >= 10) bJtm = "A2";
                    else bJtm = "A1";
                  }

                  // jtrType untuk SKUTR / Underbuild
                  let bJtr = "";
                  if (bLayer.jenisJaringan.includes("SKUTR") || bLayer.jenisJaringan.includes("Underbuild")) {
                    if (bIdx === 0) bJtr = "FDE";
                    else if (bIsEnd) bJtr = "BDL+DE";
                    else if (bAngle > 15) bJtr = "LA";
                    else bJtr = "S";
                  }

                  if (bJtm && bJtr) return `${bJtm}+${bJtr}`;
                  return bJtm || bJtr;
                }).filter(Boolean);
                if (!overrideToTerminasi && branchParts.length > 0) combinedSuffix = " + " + branchParts.join(" + ");
              }

              let mapLabelHtml = "";
              if (overrideToTerminasi) {
                mapLabelHtml = "T"; // diamond sudah menampilkan T, label di bawah tetap "T" seperti terminasi normal
              } else if (combinedSuffix) {
                const baseConstruct = jtmType || jtrType || "";
                mapLabelHtml = baseConstruct + combinedSuffix;
                if (jtmType && jtrType) mapLabelHtml += `<br/>${jtrType}`;
              } else if (isKT) {
                mapLabelHtml = isTerminasi ? "T" : "J";
              } else if (jtmType && jtrType) {
                mapLabelHtml = `${jtmType}<br/>${jtrType}`;
              } else {
                mapLabelHtml = jtmType || jtrType;
              }

              const gardu = layer.gardus[idx];
              if (gardu) {
                mapLabelHtml += `<br/><span style="color:#7e22ce;font-size:10px;">Gardu ${gardu.jenis}<br/>${gardu.trafo}</span>`;
              }

              const labelDiv = mapLabelHtml
                ? `<div style="position:absolute;top:${sz+3}px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:900;color:#c2410c;text-shadow:-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;white-space:nowrap;pointer-events:none;z-index:20;text-align:center;line-height:1.1;">${mapLabelHtml}</div>`
                : "";
                
              const garduHtml = gardu ? buildGarduSvg(gardu, sz, bd, isLastP) : "";

              const finalIcon = isDragSrc
                ? L.divIcon({
                    className: "",
                    html: `<div style="position:relative;width:${sz}px;height:${sz}px;">
                             <div style="position:absolute;top:-6px;left:-6px;width:${sz+12}px;height:${sz+12}px;border:2.5px solid #f97316;border-radius:50%;opacity:0.6;"></div>
                             <div style="width:${sz}px;height:${sz}px;background:#f97316;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>
                             ${labelDiv}
                           </div>`,
                    iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
                  })
                : isDragTgt
                ? L.divIcon({
                    className: "",
                    html: `<div style="position:relative;width:${sz}px;height:${sz}px;">
                             <div style="position:absolute;top:-8px;left:-8px;width:${sz+16}px;height:${sz+16}px;border:3px solid #22c55e;border-radius:50%;opacity:0.7;"></div>
                             <div style="width:${sz}px;height:${sz}px;background:#22c55e;border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>
                             ${labelDiv}
                           </div>`,
                    iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
                  })
                : isConnectFirstPole
                ? L.divIcon({
                    className: "",
                    html: `<div style="position:relative;width:${sz}px;height:${sz}px;cursor:pointer;">
                             <div style="position:absolute;top:-4px;left:-4px;width:${sz+8}px;height:${sz+8}px;background:#f97316;border:3px solid white;border-radius:50%;box-shadow:0 0 0 3px #f97316,0 2px 8px rgba(0,0,0,0.4);"></div>
                             ${labelDiv}
                           </div>`,
                    iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
                  })
                : isConnectTarget
                ? L.divIcon({
                    className: "",
                    html: `<div style="position:relative;width:${sz}px;height:${sz}px;cursor:pointer;">
                             <div style="position:absolute;top:-2px;left:-2px;width:${sz+4}px;height:${sz+4}px;background:#f97316;border:2px solid white;border-radius:50%;box-shadow:0 0 0 2px #fb923c,0 2px 6px rgba(0,0,0,0.4);"></div>
                             ${labelDiv}
                           </div>`,
                    iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
                  })
                : L.divIcon({
                    className: "",
                    html: (() => {
                      const isHighlighted = highlightedLayerIds.has(layer.id);
                      const highlightRing = isHighlighted
                        ? `<div style="position:absolute;top:-5px;left:-5px;width:${sz+10}px;height:${sz+10}px;border:2.5px solid #6366f1;border-radius:50%;opacity:0.8;pointer-events:none;z-index:14;"></div>`
                        : "";
                      return `<div style="position:relative;width:${sz}px;height:${sz}px;cursor:${isDraggablePole ? "grab" : "pointer"}">
                                ${isJunctionHost ? `<div style="position:absolute;top:-5px;left:-5px;width:${sz+10}px;height:${sz+10}px;border:2.5px solid #7c3aed;border-radius:50%;opacity:0.9;pointer-events:none;z-index:15;"></div>` : ""}
                                ${highlightRing}${schoorHtml}${garduHtml}${poleBodyHtml}${labelDiv}
                              </div>`;
                    })(),
                    iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
                  });

              return (
                <Marker
                  key={`sl-${layer.id}-${idx}`}
                  position={pos}
                  icon={finalIcon}
                  // ── Draggable saat tidak dalam mode connect / drag-to-connect ────
                  draggable={isDraggablePole}
                  eventHandlers={{
                    mousedown: (e) => {
                      const target = e.originalEvent.target as HTMLElement;
                      if (target.closest('.schoor-handle')) {
                        L.DomEvent.preventDefault(e.originalEvent);
                        L.DomEvent.stopPropagation(e.originalEvent);
                        startRotation(layer.id, idx, pos);
                        return;
                      }
                    },
                    // Drag selesai → update posisi pole
                    dragend: (e) => {
                      cancelPendingDragConn();
                      const latlng = e.target.getLatLng();
                      let newLatLng: [number, number] = [latlng.lat, latlng.lng];

                      // ── Auto-snap & connect jika digeser dekat tiang layer lain ──
                      let snapTarget: { layerId: number; poleIdx: number; coord: [number, number] } | null = null;
                      const ptCurrent = turf.point([latlng.lng, latlng.lat]);
                      
                      for (const l of savedLayers) {
                        if (l.id === layer.id) continue; // Abaikan tiang di layer yang sama
                        for (let i = 0; i < l.poles.length; i++) {
                          const p = l.poles[i];
                          const ptTarget = turf.point([p[1], p[0]]);
                          const dist = turf.distance(ptCurrent, ptTarget, { units: "meters" });
                          
                          if (dist < 5) {
                            // Cek apakah kedua tiang ini SUDAH berstatus junction
                            const isAlreadyConnected = junctions.some(j => 
                              (j.hostLayerId === l.id && j.hostPoleIdx === i && j.branchLayerId === layer.id && j.branchPoleIdx === idx) ||
                              (j.hostLayerId === layer.id && j.hostPoleIdx === idx && j.branchLayerId === l.id && j.branchPoleIdx === i)
                            );
                            
                            if (!isAlreadyConnected) {
                              snapTarget = { layerId: l.id, poleIdx: i, coord: p };
                              break;
                            }
                          }
                        }
                        if (snapTarget) break;
                      }

                      if (snapTarget) {
                        // Notifikasi prompt sesuai request user
                        if (window.confirm("Apakah Anda ingin sambung jaringan ini?")) {
                          newLatLng = snapTarget.coord; // Snap koordinat
                          onCreateJunction(snapTarget.layerId, snapTarget.poleIdx, layer.id, idx);
                        }
                      }

                      onUpdateSavedPole(layer.id, idx, newLatLng);
                    },
                    // Klik: mode sambung jaringan atau eksekusi tool edit (Group Edit Mode)
                    click: () => {
                      if (didDragRef.current) { didDragRef.current = false; return; }
                      if (connectMode) {
                        if (!connectFirst) {
                          setConnectFirst({ layerId: layer.id, poleIdx: idx, coord: pos });
                        } else if (connectFirst.layerId !== layer.id || connectFirst.poleIdx !== idx) {
                          onCreateJunction(layer.id, idx, connectFirst.layerId, connectFirst.poleIdx);
                          setConnectFirst(null);
                          setConnectMode(false);
                          if (onConnected) onConnected();
                        }
                      } else if (editMode && highlightedLayerIds.has(layer.id) && onPoleEdit) {
                        onPoleEdit(layer.id, idx, editMode);
                      }
                    },
                  }}
                >
                  {!connectMode && (
                    <Popup>
                      <div className="text-xs w-52">
                        {/* Header */}
                        <div className="text-center mb-2">
                          <b className="text-blue-700 text-sm block">{layer.label}</b>
                          <span className="text-gray-500 text-[11px]">
                            {isKT
                              ? (isTerminasi ? "◆ Terminasi" : "⬡ Jointing")
                              : (isLastP ? "🏁 Tiang Akhir" : `📍 Tiang #${idx + 1}`)}
                          </span>
                        </div>

                        {/* Atribut Jaringan */}
                        <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1.5 mb-1.5 flex flex-col gap-0.5">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Jenis</span>
                            <span className="font-semibold text-blue-700">{layer.jenisJaringan}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Status</span>
                            <span className={`font-semibold ${layer.statusJaringan === "Existing" ? "text-gray-700" : "text-green-700"}`}>
                              {layer.statusJaringan}
                            </span>
                          </div>
                          {!isKT && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Material</span>
                                <span className="font-semibold">Tiang {layer.materialTiang}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Tinggi</span>
                                <span className="font-semibold">{layer.tinggiTiang} m</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Jarak gawang</span>
                                <span className="font-semibold">{layer.jarakGawang} m</span>
                              </div>
                            </>
                          )}
                          {/* Total panjang jaringan */}
                          <div className="flex justify-between border-t border-gray-200 mt-0.5 pt-0.5">
                            <span className="text-gray-500">Panjang total</span>
                            <span className="font-bold text-indigo-700">
                              {(() => {
                                const pts = layer.poles;
                                if (pts.length < 2) return "—";
                                let total = 0;
                                for (let i = 1; i < pts.length; i++) {
                                  const a = turf.point([pts[i-1][1], pts[i-1][0]]);
                                  const b = turf.point([pts[i][1], pts[i][0]]);
                                  total += turf.distance(a, b, { units: "meters" });
                                }
                                return total >= 1000
                                  ? `${(total / 1000).toFixed(2)} km`
                                  : `${total.toFixed(0)} m`;
                              })()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Jumlah titik</span>
                            <span className="font-semibold">{layer.poles.length} {isKT ? "titik" : "tiang"}</span>
                          </div>
                          {/* Konstruksi tiang */}
                          {(jtmType || jtrType || skutmType || isKT) && (() => {
                            const ktDisplay = konstruksiOverride && isKT ? konstruksiOverride : (isTerminasi ? "TRM" : "JNT");
                            const display = jtmType || jtrType || skutmType || ktDisplay;
                            return (
                              <div className="flex justify-between items-center border-t border-gray-200 mt-0.5 pt-0.5">
                                <span className="text-gray-500">Konstruksi</span>
                                <span className="font-bold text-orange-700 flex items-center gap-1">
                                  {display}
                                  {konstruksiOverride && (
                                    <span className="bg-orange-100 text-orange-700 text-[8px] px-1 rounded-full border border-orange-300">✏️</span>
                                  )}
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Schoor info */}
                        {schoor && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded px-2 py-1 text-[10px] text-emerald-700 font-semibold mb-1.5">
                            ⚓ {schoor.jenis}
                            {schoor.rotation !== undefined ? ` — ${schoor.rotation}° (manual)` : " — Auto arah"}
                            <br />
                            <span className="text-emerald-500 font-normal">Klik kanan + tahan untuk putar</span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="bg-blue-50 border border-blue-100 rounded px-2 py-1 text-[10px] text-blue-600 mb-1.5">
                          🖱️ Drag tiang untuk geser posisi
                        </div>
                        <div className="flex gap-1.5 justify-center">
                          <button
                            onClick={() => onLoadLayerForEdit(layer)}
                            className="text-[11px] bg-blue-600 text-white px-3 py-1 rounded-full font-bold hover:bg-blue-700"
                          >
                            ✏️ Edit Layer
                          </button>
                          {onEditKonstruksi && (jtmType || jtrType || skutmType || isKT) && (
                            <button
                              onClick={() => onEditKonstruksi(layer.id, idx)}
                              className="text-[11px] bg-orange-500 text-white px-3 py-1 rounded-full font-bold hover:bg-orange-600"
                            >
                              ✏️ Konstruksi
                            </button>
                          )}
                        </div>
                      </div>
                    </Popup>
                  )}

                </Marker>
              );
            })}
          </Fragment>
        );
      })}

      {/* ─── Garis koneksi antar layer ─────────────────────────────────────── */}
      {connections.map(conn => (
        <Fragment key={`conn-${conn.id}`}>
          <Polyline
            positions={[conn.from, conn.to]}
            pathOptions={{ color: "#f97316", weight: 3, dashArray: "8,5", opacity: 0.9 }}
          />
        </Fragment>
      ))}

      {/* ─── Marker titik awal ─────────────────────────────────────────────── */}
      {startPos && poles.length === 0 && (() => {
        const isSnapped = !!snapStart;
        const isMidLine = snapStart?.isMidLine;
        const markerHtml = isMidLine
          ? `<div style="position:relative;width:20px;height:20px;">
               <svg width="24" height="24" viewBox="-12 -12 24 24" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);overflow:visible;">
                 <polygon points="0,-10 10,0 0,10 -10,0" fill="#0d9488" stroke="white" stroke-width="2.5"/>
               </svg>
               <div style="position:absolute;top:-6px;left:-6px;width:32px;height:32px;border:2.5px solid #0d9488;border-radius:50%;opacity:0.5;"></div>
             </div>`
          : `<div style="position:relative;width:20px;height:20px;"><div style="width:20px;height:20px;background:${isSnapped ? "#22c55e" : "#3b82f6"};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>${isSnapped ? `<div style="position:absolute;top:-4px;left:-4px;width:28px;height:28px;border:2.5px solid #22c55e;border-radius:50%;opacity:0.6;"></div>` : ""}</div>`;
        const icon = L.divIcon({ className: "", html: markerHtml, iconSize: [20, 20], iconAnchor: [10, 10] });
        return (
          <Marker position={startPos} icon={icon}>
            <Popup>
              <b>Titik Awal</b>
              {isSnapped && <><br /><span style={{ color: isMidLine ? "#0f766e" : "#16a34a", fontWeight: "bold" }}>{isMidLine ? "⑂ Cabang dari" : "⚡ Tersambung ke"}: {snapStart!.label}</span></>}
            </Popup>
          </Marker>
        );
      })()}

      {/* ─── Marker titik akhir ────────────────────────────────────────────── */}
      {endPos && poles.length === 0 && (() => {
        const isSnapped = !!snapEnd;
        const isMidLine = snapEnd?.isMidLine;
        const markerHtml = isMidLine
          ? `<div style="position:relative;width:20px;height:20px;">
               <svg width="24" height="24" viewBox="-12 -12 24 24" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);overflow:visible;">
                 <polygon points="0,-10 10,0 0,10 -10,0" fill="#0d9488" stroke="white" stroke-width="2.5"/>
               </svg>
             </div>`
          : `<div style="position:relative;width:20px;height:20px;"><div style="width:20px;height:20px;background:${isSnapped ? "#22c55e" : "#ef4444"};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>${isSnapped ? `<div style="position:absolute;top:-4px;left:-4px;width:28px;height:28px;border:2.5px solid #22c55e;border-radius:50%;opacity:0.6;"></div>` : ""}</div>`;
        const icon = L.divIcon({ className: "", html: markerHtml, iconSize: [20, 20], iconAnchor: [10, 10] });
        return (
          <Marker position={endPos} icon={icon}>
            <Popup>
              <b>Titik Akhir</b>
              {isSnapped && <><br /><span style={{ color: isMidLine ? "#0f766e" : "#16a34a", fontWeight: "bold" }}>{isMidLine ? "⑂ Cabang dari" : "⚡ Tersambung ke"}: {snapEnd!.label}</span></>}
            </Popup>
          </Marker>
        );
      })()}
    </>
  );
}
