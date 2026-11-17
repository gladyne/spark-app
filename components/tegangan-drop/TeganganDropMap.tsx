"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import {
  LayersControl,
  MapContainer,
  ScaleControl,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type {
  NetworkDataset,
  PreparedPoint,
  ReportProposal,
} from "@/types/tegangan-drop";
import {
  fmtId,
  fmtInt,
  fmtShortDate,
  nearKey,
  normCode,
  SEVERITY_HEX,
  sevOf,
} from "@/lib/tegangan-drop/calculations";
import {
  createCanvasHeatLayer,
  type CanvasHeatLayerInstance,
} from "@/lib/tegangan-drop/heatLayer";

export interface MapFocusRequest {
  points: PreparedPoint[];
  nonce: number;
}

interface LayerVisibility {
  heat: boolean;
  jur: boolean;
  jtr: boolean;
  gd: boolean;
  jtm: boolean;
}

interface TeganganDropMapProps {
  pts: PreparedPoint[];
  network: NetworkDataset | null;
  networkLoading: boolean;
  networkError: string | null;
  onRetryNetwork: () => void;
  proposals: ReportProposal[];
  selectedId: string | null;
  onSelectPoint: (id: string) => void;
  focusRequest: MapFocusRequest | null;
}

const SEV_POPUP_LABEL: Record<string, string> = {
  crit: "Kritis <180 V",
  warn: "Di bawah batas",
  ok: "Normal",
  na: "Belum ada nilai",
};

function buildPopupElement(
  p: PreparedPoint,
  proposals: ReportProposal[]
): HTMLElement {
  const root = document.createElement("div");
  root.className = "td-pp";

  const title = document.createElement("h4");
  title.textContent = `${p.id} · ${p.wilayah}${p.kec && p.kec !== "-" ? `, ${p.kec}` : ""}`;
  root.appendChild(title);

  const pill = document.createElement("span");
  pill.className = "td-pill";
  pill.style.background = SEVERITY_HEX[p.sev];
  pill.textContent = SEV_POPUP_LABEL[p.sev] || p.sev;
  root.appendChild(pill);

  const big = document.createElement("div");
  big.className = "td-big";
  big.textContent = p.v == null ? "–" : `${fmtId(p.v)} V `;
  if (p.drop != null) {
    const dropSpan = document.createElement("span");
    dropSpan.className = "td-drop";
    dropSpan.textContent = `${fmtId(p.drop)}% dari 220 V`;
    big.appendChild(dropSpan);
  }
  root.appendChild(big);

  const dl = document.createElement("dl");
  const addRow = (dtText: string, ddText: string) => {
    const dt = document.createElement("dt");
    dt.textContent = dtText;
    const dd = document.createElement("dd");
    dd.textContent = ddText;
    dl.appendChild(dt);
    dl.appendChild(dd);
  };

  if (p.v3) {
    addRow(
      "Fasa-netral",
      `R ${fmtId(p.v3.RN)} · S ${fmtId(p.v3.SN)} · T ${fmtId(p.v3.TN)} V`
    );
  }
  addRow(
    "Tanggal",
    `${fmtShortDate(p.tgl)}/2026 ${p.jam || ""}`.trim()
  );
  if (p.aduan) addRow("No. aduan", p.aduan);
  addRow(
    "Gardu / jurusan",
    `${p.gardu} · ${p.jur}${p.penyulang ? ` · ${p.penyulang}` : ""}`
  );
  addRow("JTR terdekat", `${fmtInt(p.dJtr)} m · ${p.kawat}`);
  addRow(
    "Jarak ke gardu",
    p.dGardu == null ? "gardu tidak ada di layer" : `${fmtInt(p.dGardu)} m (garis lurus)`
  );
  addRow("Panjang jurusan", `${fmtInt(p.jurM)} m`);
  root.appendChild(dl);

  if (p.catatan) {
    const note = document.createElement("div");
    note.className = "td-pp-note";
    note.textContent = p.catatan;
    root.appendChild(note);
  }

  const prop = proposals.find((item) => item.id === p.id);
  if (prop && prop.items.length > 0) {
    const ul = document.createElement("ul");
    for (const item of prop.items) {
      const li = document.createElement("li");
      li.textContent = `${item.jenis} `;
      const tag = document.createElement("span");
      tag.className = "td-pp-basis";
      tag.textContent = `(${item.basis === "lap" ? "lapangan" : "data"})`;
      li.appendChild(tag);
      ul.appendChild(li);
    }
    root.appendChild(ul);
  }

  const linkWrap = document.createElement("p");
  linkWrap.className = "td-pp-link";
  const link = document.createElement("a");
  link.href = `https://www.google.com/maps?q=${p.lat},${p.lon}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Buka di Google Maps ↗";
  linkWrap.appendChild(link);
  root.appendChild(linkWrap);

  return root;
}

interface OverlayControllerProps {
  pts: PreparedPoint[];
  network: NetworkDataset | null;
  proposals: ReportProposal[];
  visibility: LayerVisibility;
  onSelectPoint: (id: string) => void;
  focusRequest: MapFocusRequest | null;
}

function MapOverlayController({
  pts,
  network,
  proposals,
  visibility,
  onSelectPoint,
  focusRequest,
}: OverlayControllerProps) {
  const map = useMap();
  const proposalsRef = useRef<ReportProposal[]>(proposals);
  const onSelectRef = useRef(onSelectPoint);

  useEffect(() => {
    proposalsRef.current = proposals;
  }, [proposals]);

  useEffect(() => {
    onSelectRef.current = onSelectPoint;
  }, [onSelectPoint]);

  const layersRef = useRef<{
    jtr: L.LayerGroup;
    jtm: L.LayerGroup;
    gd: L.LayerGroup;
    jur: L.LayerGroup;
    hi: L.LayerGroup;
    ev: L.LayerGroup;
  } | null>(null);
  const heatRef = useRef<CanvasHeatLayerInstance | null>(null);
  const markersRef = useRef<Record<string, L.CircleMarker>>({});
  const fittedRef = useRef(false);
  const canvasRef = useRef<L.Canvas | null>(null);

  // Initialize layers, custom heat pane, canvas renderer, and ResizeObserver once
  useEffect(() => {
    if (!map.getPane("heatPane")) {
      const pane = map.createPane("heatPane");
      pane.style.zIndex = "350";
      pane.style.pointerEvents = "none";
    }

    const cv = L.canvas({ padding: 0.5, tolerance: 4 });
    canvasRef.current = cv;

    const groups = {
      jtr: L.layerGroup().addTo(map),
      jtm: L.layerGroup(),
      gd: L.layerGroup().addTo(map),
      jur: L.layerGroup().addTo(map),
      hi: L.layerGroup().addTo(map),
      ev: L.layerGroup().addTo(map),
    };
    layersRef.current = groups;

    // Report markers + heatmap (from laporan pts, available before heavy network loads)
    const evMarkers: Record<string, L.CircleMarker> = {};
    for (const p of pts) {
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: 9,
        color: "#ffffff",
        weight: 2.5,
        fillColor: SEVERITY_HEX[p.sev],
        fillOpacity: 1,
      })
        .bindPopup(() => buildPopupElement(p, proposalsRef.current), {
          maxWidth: 320,
        })
        .addTo(groups.ev);

      marker.bindTooltip(p.v == null ? p.id : fmtId(p.v), {
        permanent: true,
        direction: "top",
        offset: [0, -9],
        className: "td-vtag",
      });
      marker.on("popupopen", () => onSelectRef.current(p.id));
      evMarkers[p.id] = marker;
    }
    markersRef.current = evMarkers;

    const heatPts: [number, number, number][] = pts
      .filter((p): p is PreparedPoint & { v: number } => p.v != null)
      .map((p) => [
        p.lat,
        p.lon,
        Math.max(0.15, Math.min(1, (220 - p.v) / 60)),
      ]);

    const heat = createCanvasHeatLayer(L, heatPts, {
      radius: 20,
      blur: 14,
      max: 1,
      maxZoom: 1,
      minOpacity: 0.3,
      pane: "heatPane",
      gradient: {
        0.2: "#ffe08a",
        0.5: "#ffb340",
        0.75: "#e07b00",
        1: "#c62828",
      },
    });
    heatRef.current = heat;

    const fitHeatRadius = () => {
      const z = map.getZoom();
      const mpp =
        (156543.03 * Math.cos((10.18 * Math.PI) / 180)) / Math.pow(2, z);
      const r = Math.min(70, Math.max(10, Math.round(650 / mpp)));
      heat.setOptions({ radius: r, blur: Math.round(r * 0.7) });
    };

    const onZoomEnd = () => {
      if (map.hasLayer(heat.layer)) fitHeatRadius();
    };
    map.on("zoomend", onZoomEnd);
    heat.layer.addTo(map);
    fitHeatRadius();

    const fitAll = () => {
      if (pts.length === 0) return;
      const container = map.getContainer();
      if (!container.offsetWidth) return;
      map.fitBounds(
        L.latLngBounds(pts.map((p) => [p.lat, p.lon] as [number, number])).pad(
          0.25
        )
      );
      fittedRef.current = true;
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        map.invalidateSize({ pan: false });
        if (!fittedRef.current) fitAll();
      });
      ro.observe(map.getContainer());
    }

    const t = window.setTimeout(() => {
      map.invalidateSize({ pan: false });
      fitAll();
    }, 150);

    return () => {
      window.clearTimeout(t);
      ro?.disconnect();
      map.off("zoomend", onZoomEnd);
      if (map.hasLayer(heat.layer)) map.removeLayer(heat.layer);
      Object.values(groups).forEach((g) => {
        g.clearLayers();
        if (map.hasLayer(g)) map.removeLayer(g);
      });
      layersRef.current = null;
      heatRef.current = null;
    };
  }, [map, pts]);

  // Draw network layers when GIS data finishes loading
  useEffect(() => {
    const groups = layersRef.current;
    const cv = canvasRef.current;
    if (!groups || !cv || !network) return;

    groups.jtr.clearLayers();
    groups.jur.clearLayers();
    groups.gd.clearLayers();
    groups.jtm.clearLayers();

    const keyMinV = new Map<string, number | null>();
    for (const p of pts) {
      const prev = keyMinV.get(p.key);
      if (prev === undefined) keyMinV.set(p.key, p.v);
      else if (p.v != null) keyMinV.set(p.key, prev == null ? p.v : Math.min(prev, p.v));
    }

    for (const [co, gd, kaw, jur, , pj] of network.jtr) {
      const k = `${normCode(gd)}|${jur}`;
      const hit = keyMinV.has(k) && nearKey(pts, k, co);
      const latlngs = co.map((c) => [c[1], c[0]] as [number, number]);

      L.polyline(latlngs, {
        renderer: cv,
        color: "#64748b",
        weight: kaw.includes("70") ? 2.4 : 1.3,
        opacity: 0.7,
        interactive: false,
      }).addTo(groups.jtr);

      if (hit) {
        const minV = keyMinV.get(k) ?? null;
        L.polyline(latlngs, {
          color: "#0f172a",
          weight: 9,
          opacity: 0.85,
          interactive: false,
        }).addTo(groups.jur);

        L.polyline(latlngs, {
          color: SEVERITY_HEX[sevOf(minV)],
          weight: 5,
          opacity: 1,
        })
          .bindTooltip(
            `JTR ${gd} jurusan ${jur} · ${kaw} · ${fmtInt(pj)} m`,
            { sticky: true }
          )
          .addTo(groups.jur);
      }
    }

    const affectedGardu = new Set(pts.map((p) => normCode(p.gardu)));
    for (const [x, y, kode, nama] of network.gardu) {
      if (affectedGardu.has(normCode(kode))) {
        L.circleMarker([y, x], {
          radius: 6,
          color: "#ffffff",
          weight: 2,
          fillColor: "#38bdf8",
          fillOpacity: 1,
        })
          .bindTooltip(kode, {
            permanent: true,
            direction: "right",
            offset: [6, 0],
            className: "td-lbl",
          })
          .addTo(groups.gd);
      } else {
        L.circleMarker([y, x], {
          renderer: cv,
          radius: 2.5,
          stroke: false,
          fillColor: "#94a3b8",
          fillOpacity: 0.75,
        })
          .bindTooltip(`Gardu ${kode} · ${nama}`)
          .addTo(groups.gd);
      }
    }

    for (const [x, y, kode, idxP] of network.jtm.tiang) {
      const penyulangName = network.jtm.penyulang[idxP] ?? "-";
      L.circleMarker([y, x], {
        renderer: cv,
        radius: 1.5,
        stroke: false,
        fillColor: "#94a3b8",
        fillOpacity: 0.85,
      })
        .bindTooltip(`Tiang TM ${kode} · ${penyulangName}`)
        .addTo(groups.jtm);
    }
  }, [network, pts]);

  // Sync layer visibility toggles
  useEffect(() => {
    const groups = layersRef.current;
    const heat = heatRef.current;
    if (!groups) return;

    const toggle = (layer: L.Layer, show: boolean) => {
      if (show) {
        if (!map.hasLayer(layer)) layer.addTo(map);
      } else if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };

    toggle(groups.jur, visibility.jur);
    toggle(groups.jtr, visibility.jtr);
    toggle(groups.gd, visibility.gd);
    toggle(groups.jtm, visibility.jtm);
    if (heat) toggle(heat.layer, visibility.heat);
  }, [map, visibility]);

  // Focus & highlight jurusan when focusRequest changes
  useEffect(() => {
    const groups = layersRef.current;
    if (!groups || !focusRequest || focusRequest.points.length === 0) return;

    groups.hi.clearLayers();
    const boundsCoords: [number, number][] = [];
    const keys = new Set(focusRequest.points.map((p) => p.key));

    if (network) {
      for (const [co, gd, , jur] of network.jtr) {
        const kk = `${normCode(gd)}|${jur}`;
        if (!keys.has(kk) || !nearKey(pts, kk, co)) continue;
        const latlngs = co.map((c) => [c[1], c[0]] as [number, number]);
        boundsCoords.push(...latlngs);
        L.polyline(latlngs, {
          color: "#38bdf8",
          weight: 9,
          opacity: 0.55,
          interactive: false,
        }).addTo(groups.hi);
      }
    }

    for (const p of focusRequest.points) {
      boundsCoords.push([p.lat, p.lon]);
    }

    const timer = window.setTimeout(() => {
      map.invalidateSize({ pan: false });
      fittedRef.current = true;
      const targetPoint =
        focusRequest.points.length === 1 ? focusRequest.points[0] : null;
      const marker = targetPoint ? markersRef.current[targetPoint.id] : null;

      let opened = false;
      const openTarget = () => {
        if (opened || !marker) return;
        opened = true;
        marker.openPopup();
      };

      if (targetPoint) {
        onSelectRef.current(targetPoint.id);
        map.once("moveend", openTarget);
      }

      map.fitBounds(L.latLngBounds(boundsCoords).pad(0.18), {
        maxZoom: 17,
      });

      if (targetPoint) {
        window.setTimeout(openTarget, 350);
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [focusRequest, map, network, pts]);

  return null;
}

export default function TeganganDropMap({
  pts,
  network,
  networkLoading,
  networkError,
  onRetryNetwork,
  proposals,
  selectedId,
  onSelectPoint,
  focusRequest,
}: TeganganDropMapProps) {
  const [visibility, setVisibility] = useState<LayerVisibility>({
    heat: true,
    jur: true,
    jtr: true,
    gd: true,
    jtm: false,
  });

  const toggleLayer = (key: keyof LayerVisibility) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="td-mapbox relative rounded-xl border border-slate-700/70 bg-slate-900 overflow-hidden shadow-lg">
      <style>{`
        .td-mapbox .leaflet-container {
          background: #0f172a;
          font-family: var(--font-geist-sans), system-ui, sans-serif;
        }
        .td-mapbox .leaflet-popup-content-wrapper,
        .td-mapbox .leaflet-popup-tip {
          background: #0f172a;
          color: #e2e8f0;
          border: 1px solid rgba(148, 163, 184, 0.25);
        }
        .td-mapbox .leaflet-popup-content {
          margin: 12px 14px;
          width: 290px !important;
        }
        .td-mapbox .leaflet-container a.leaflet-popup-close-button {
          color: #94a3b8;
        }
        .td-mapbox .leaflet-container a.leaflet-popup-close-button:hover {
          color: #f8fafc;
        }
        .td-mapbox .leaflet-tooltip.td-lbl {
          background: rgba(15, 23, 42, 0.86);
          border: 1px solid rgba(56, 189, 248, 0.45);
          border-radius: 4px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
          color: #e0f2fe;
          font: 600 10.5px var(--font-geist-mono), ui-monospace, monospace;
          padding: 1px 5px;
        }
        .td-mapbox .leaflet-tooltip.td-lbl::before {
          display: none;
        }
        .td-mapbox .leaflet-tooltip.td-vtag {
          background: rgba(15, 23, 42, 0.92);
          color: #f8fafc;
          border: 1px solid rgba(148, 163, 184, 0.45);
          border-radius: 4px;
          font: 600 11px var(--font-geist-mono), ui-monospace, monospace;
          padding: 1px 5px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        }
        .td-mapbox .leaflet-tooltip.td-vtag::before {
          display: none;
        }
        .td-pp h4 {
          margin: 0 0 6px;
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
        }
        .td-pill {
          display: inline-block;
          padding: 2px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          color: #ffffff;
        }
        .td-pp .td-big {
          font: 700 22px var(--font-geist-mono), ui-monospace, monospace;
          margin: 6px 0 4px;
          color: #f8fafc;
        }
        .td-pp .td-drop {
          font-size: 12px;
          font-weight: 500;
          color: #94a3b8;
        }
        .td-pp dl {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 3px 10px;
          margin: 8px 0;
          font-size: 12px;
        }
        .td-pp dt {
          color: #94a3b8;
        }
        .td-pp dd {
          margin: 0;
          color: #e2e8f0;
        }
        .td-pp-note {
          font-size: 11.5px;
          color: #cbd5e1;
          background: rgba(30, 41, 59, 0.8);
          border-left: 2px solid #38bdf8;
          padding: 4px 8px;
          border-radius: 4px;
          margin-top: 6px;
        }
        .td-pp ul {
          margin: 6px 0 0;
          padding-left: 16px;
          font-size: 12px;
          color: #e2e8f0;
        }
        .td-pp-basis {
          color: #94a3b8;
          font-size: 11px;
        }
        .td-pp-link {
          margin: 8px 0 0;
        }
        .td-pp-link a {
          color: #38bdf8;
          font-weight: 600;
          text-decoration: none;
        }
        .td-pp-link a:hover {
          text-decoration: underline;
        }
      `}</style>

      {/* Network status badge */}
      {networkLoading && (
        <div className="absolute top-3 left-3 z-[800] flex items-center gap-2 rounded-lg border border-sky-500/40 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-sky-200 backdrop-blur-md shadow">
          <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
          Memuat layer GIS (JTR, Gardu, Tiang TM)...
        </div>
      )}
      {networkError && (
        <div className="absolute top-3 left-3 z-[800] flex items-center gap-2 rounded-lg border border-red-500/50 bg-slate-900/95 px-3 py-1.5 text-xs text-red-200 shadow">
          <span>Layer jaringan gagal dimuat: {networkError}</span>
          <button
            type="button"
            onClick={onRetryNetwork}
            className="rounded bg-red-500/20 px-2 py-0.5 font-semibold text-red-100 hover:bg-red-500/35 cursor-pointer"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Map canvas */}
      <div className="h-[620px] max-[900px]:h-[440px] w-full">
        <MapContainer
          center={[-10.175, 123.62]}
          zoom={12}
          maxZoom={21}
          zoomSnap={0.25}
          zoomDelta={0.5}
          preferCanvas
          attributionControl={false}
          className="h-full w-full"
          aria-label="Peta sebaran tegangan drop dan jaringan GIS ULP Kupang"
          data-selected={selectedId || ""}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Google Maps (Jalan)">
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                attribution="&copy; Google Maps"
                maxNativeZoom={21}
                maxZoom={21}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Google Hybrid (Satelit + Label)">
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                attribution="&copy; Google Maps"
                maxNativeZoom={21}
                maxZoom={21}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Google Satelit Murni">
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                attribution="&copy; Google Maps"
                maxNativeZoom={21}
                maxZoom={21}
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <ScaleControl imperial={false} position="bottomright" />

          <MapOverlayController
            pts={pts}
            network={network}
            proposals={proposals}
            visibility={visibility}
            onSelectPoint={onSelectPoint}
            focusRequest={focusRequest}
          />
        </MapContainer>
      </div>

      {/* Layer toggles: floating bottom-left on desktop, static bar below map on <= 900px */}
      <div
        role="group"
        aria-label="Layer peta"
        className="z-[800] flex flex-col gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/92 px-3 py-2.5 text-xs text-slate-100 shadow-lg backdrop-blur-md min-[901px]:absolute min-[901px]:bottom-3 min-[901px]:left-3 max-[900px]:static max-[900px]:flex-row max-[900px]:flex-wrap max-[900px]:gap-x-4 max-[900px]:gap-y-2 max-[900px]:rounded-none max-[900px]:border-x-0 max-[900px]:border-b-0 max-[900px]:shadow-none"
      >
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={visibility.heat}
            onChange={() => toggleLayer("heat")}
            className="accent-sky-400 cursor-pointer"
          />
          <span
            className="h-3 w-3 rounded-full shrink-0"
            style={{
              background: "linear-gradient(90deg, #ffe08a, #c62828)",
            }}
          />
          <span>Heatmap drop</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={visibility.jur}
            onChange={() => toggleLayer("jur")}
            className="accent-sky-400 cursor-pointer"
          />
          <span className="w-4 border-t-[3px] border-red-500 shrink-0" />
          <span>Jurusan terdampak</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={visibility.jtr}
            onChange={() => toggleLayer("jtr")}
            className="accent-sky-400 cursor-pointer"
          />
          <span className="w-4 border-t-[3px] border-slate-500 shrink-0" />
          <span>JTR</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={visibility.gd}
            onChange={() => toggleLayer("gd")}
            className="accent-sky-400 cursor-pointer"
          />
          <span className="h-3 w-3 rounded-full bg-slate-400 shrink-0" />
          <span>Gardu</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={visibility.jtm}
            onChange={() => toggleLayer("jtm")}
            className="accent-sky-400 cursor-pointer"
          />
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0 mx-0.5" />
          <span>Tiang TM</span>
        </label>
      </div>
    </div>
  );
}
