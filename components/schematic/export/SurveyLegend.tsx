"use client";

import React, { useMemo } from "react";
import type { SchematicData } from "../../../types/schematic";
import { SPARK_ASSET_COLORS } from "../../../lib/assetStyles";

interface Props {
  schematic: SchematicData;
  columns?: number;
  compact?: boolean;
}

interface LegendEntry {
  id: string;
  label: string;
  renderIcon: () => React.ReactNode;
}

/**
 * Kotak "Keterangan Simbol :" untuk Lembar Gambar Survei UP3 Kupang (A2).
 * Sesuai persyaratan:
 * - Menggunakan simbol SPARK resmi yang tergambar di canvas.
 * - HANYA menampilkan simbol yang benar-benar dipakai di gambar.
 * - Elemen Obstacle (Bangunan, Jalan Raya, Gang) tampil jika ada di canvas.
 */
export default function SurveyLegend({ schematic, columns = 3, compact = false }: Props) {
  const { nodes = [], edges = [], obstacles = [] } = schematic;

  const usedSymbols = useMemo<LegendEntry[]>(() => {
    const list: LegendEntry[] = [];

    // 1. Tiang JTM Rencana Beton
    const hasTiangJtmBeton = nodes.some(n => {
      const isExist = n.type === "tiang-existing";
      const isBaja = (n.materialTiang || "Beton").toLowerCase().includes("baja");
      const isTM = n.type === "tiang-tm" || n.kategori === "TM" || (!n.kategori && n.type !== "tiang-tr");
      return !isExist && !isBaja && isTM;
    });
    if (hasTiangJtmBeton) {
      list.push({
        id: "tiang-jtm-beton",
        label: "Tiang JTM",
        renderIcon: () => (
          <svg width="18" height="18" viewBox="-12 -12 24 24" className="inline-block flex-shrink-0">
            <circle r="7.5" fill="#ffffff" stroke={SPARK_ASSET_COLORS.POLE.borderBeton} strokeWidth="2" />
          </svg>
        ),
      });
    }

    // 2. Tiang JTR Rencana Beton
    const hasTiangJtrBeton = nodes.some(n => {
      const isExist = n.type === "tiang-existing";
      const isBaja = (n.materialTiang || "Beton").toLowerCase().includes("baja");
      const isTR = n.type === "tiang-tr" || n.kategori === "TR";
      return !isExist && !isBaja && isTR;
    });
    if (hasTiangJtrBeton) {
      list.push({
        id: "tiang-jtr-beton",
        label: "Tiang JTR",
        renderIcon: () => (
          <svg width="18" height="18" viewBox="-12 -12 24 24" className="inline-block flex-shrink-0">
            <circle r="7.5" fill="#ffffff" stroke={SPARK_ASSET_COLORS.POLE.borderBeton} strokeWidth="2" />
            <circle r="2.5" fill={SPARK_ASSET_COLORS.POLE.borderBeton} />
          </svg>
        ),
      });
    }

    // 3. Tiang JTM Rencana Baja
    const hasTiangJtmBaja = nodes.some(n => {
      const isExist = n.type === "tiang-existing";
      const isBaja = (n.materialTiang || "").toLowerCase().includes("baja") || (n.materialTiang || "").toLowerCase().includes("besi");
      const isTM = n.type === "tiang-tm" || n.kategori === "TM" || (!n.kategori && n.type !== "tiang-tr");
      return !isExist && isBaja && isTM;
    });
    if (hasTiangJtmBaja) {
      list.push({
        id: "tiang-jtm-baja",
        label: "Tiang JTM Besi/Baja",
        renderIcon: () => (
          <svg width="18" height="18" viewBox="-12 -12 24 24" className="inline-block flex-shrink-0">
            <circle r="7.5" fill="#ffffff" stroke={SPARK_ASSET_COLORS.POLE.borderBaja} strokeWidth="2" />
          </svg>
        ),
      });
    }

    // 4. Tiang JTR Rencana Baja
    const hasTiangJtrBaja = nodes.some(n => {
      const isExist = n.type === "tiang-existing";
      const isBaja = (n.materialTiang || "").toLowerCase().includes("baja") || (n.materialTiang || "").toLowerCase().includes("besi");
      const isTR = n.type === "tiang-tr" || n.kategori === "TR";
      return !isExist && isBaja && isTR;
    });
    if (hasTiangJtrBaja) {
      list.push({
        id: "tiang-jtr-baja",
        label: "Tiang JTR Besi/Baja",
        renderIcon: () => (
          <svg width="18" height="18" viewBox="-12 -12 24 24" className="inline-block flex-shrink-0">
            <circle r="7.5" fill="#ffffff" stroke={SPARK_ASSET_COLORS.POLE.borderBaja} strokeWidth="2" />
            <circle r="2.5" fill={SPARK_ASSET_COLORS.POLE.borderBaja} />
          </svg>
        ),
      });
    }

    // 5. Tiang JTM Existing (Lingkaran Hitam border hijau/baja)
    const hasTiangJtmExist = nodes.some(n => {
      const isExist = n.type === "tiang-existing";
      const isTM = n.type === "tiang-tm" || n.kategori === "TM" || (!n.kategori && n.type !== "tiang-tr");
      return isExist && isTM;
    });
    if (hasTiangJtmExist) {
      list.push({
        id: "tiang-jtm-existing",
        label: "Tiang JTM Existing",
        renderIcon: () => (
          <svg width="18" height="18" viewBox="-12 -12 24 24" className="inline-block flex-shrink-0">
            <circle r="7.5" fill="#000000" stroke={SPARK_ASSET_COLORS.POLE.borderBeton} strokeWidth="2" />
          </svg>
        ),
      });
    }

    // 6. Tiang JTR Existing
    const hasTiangJtrExist = nodes.some(n => {
      const isExist = n.type === "tiang-existing";
      const isTR = n.type === "tiang-tr" || n.kategori === "TR";
      return isExist && isTR;
    });
    if (hasTiangJtrExist) {
      list.push({
        id: "tiang-jtr-existing",
        label: "Tiang JTR Existing",
        renderIcon: () => (
          <svg width="18" height="18" viewBox="-12 -12 24 24" className="inline-block flex-shrink-0">
            <circle r="7.5" fill="#000000" stroke={SPARK_ASSET_COLORS.POLE.borderBeton} strokeWidth="2" />
            <circle r="2.5" fill="#ffffff" />
          </svg>
        ),
      });
    }

    // 7. Gardu Portal
    const hasGarduPortal = nodes.some(n => n.type === "gardu" && (n.garduJenis === "Portal" || !n.garduJenis));
    if (hasGarduPortal) {
      list.push({
        id: "gardu-portal",
        label: "Gardu Portal",
        renderIcon: () => (
          <svg width="24" height="20" viewBox="-15 -18 30 26" className="inline-block flex-shrink-0">
            <circle cx="-6" cy="0" r="4.5" fill="white" stroke="#000000" strokeWidth="1.6" />
            <circle cx="6" cy="0" r="4.5" fill="white" stroke="#000000" strokeWidth="1.6" />
            <polygon
              points="0,-15 10,-4 -10,-4"
              fill={SPARK_ASSET_COLORS.GARDU.fill}
              stroke={SPARK_ASSET_COLORS.GARDU.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        ),
      });
    }

    // 8. Gardu Cantol
    const hasGarduCantol = nodes.some(n => n.type === "gardu" && n.garduJenis === "Cantol");
    if (hasGarduCantol) {
      list.push({
        id: "gardu-cantol",
        label: "Gardu Cantol",
        renderIcon: () => (
          <svg width="18" height="20" viewBox="-12 -18 24 26" className="inline-block flex-shrink-0">
            <circle cx="0" cy="0" r="4.5" fill="white" stroke="#000000" strokeWidth="1.6" />
            <polygon
              points="0,-15 7.5,-4 -7.5,-4"
              fill={SPARK_ASSET_COLORS.GARDU.fill}
              stroke={SPARK_ASSET_COLORS.GARDU.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        ),
      });
    }

    // 9. Treck Schoor
    const hasTreckSchoor = nodes.some(n =>
      n.type === "treck-schoor" || (n.schoor && n.schoor.jenis === "Treck")
    );
    if (hasTreckSchoor) {
      list.push({
        id: "treck-schoor",
        label: "Treck Schoor",
        renderIcon: () => (
          <svg width="18" height="18" viewBox="-15 -22 30 30" className="inline-block flex-shrink-0">
            <circle cx="0" cy="0" r="3.5" fill="#ffffff" stroke={SPARK_ASSET_COLORS.POLE.borderBeton} strokeWidth="1.5" />
            <line x1="0" y1="-3.5" x2="0" y2="-20" stroke={SPARK_ASSET_COLORS.SCHOOR.treck} strokeWidth="2.2" strokeLinecap="round" />
            <polygon points="-3,-13 0,-20 3,-13" fill={SPARK_ASSET_COLORS.SCHOOR.treck} />
          </svg>
        ),
      });
    }

    // 10. Druck Schoor
    const hasDruckSchoor = nodes.some(n =>
      n.type === "druck-schoor" || (n.schoor && n.schoor.jenis === "Druck")
    );
    if (hasDruckSchoor) {
      list.push({
        id: "druck-schoor",
        label: "Durck Schoor",
        renderIcon: () => (
          <svg width="18" height="18" viewBox="-15 -22 30 30" className="inline-block flex-shrink-0">
            <circle cx="0" cy="0" r="3.5" fill="#ffffff" stroke={SPARK_ASSET_COLORS.POLE.borderBeton} strokeWidth="1.5" />
            <line x1="0" y1="-18" x2="0" y2="-3.5" stroke={SPARK_ASSET_COLORS.SCHOOR.druck} strokeWidth="2.2" strokeLinecap="round" />
            <polygon points="-3,-10 0,-3.5 3,-10" fill={SPARK_ASSET_COLORS.SCHOOR.druck} />
          </svg>
        ),
      });
    }

    // 11. Kontramast
    const hasKontramast = nodes.some(n =>
      n.type === "kontramast" || (n.schoor && n.schoor.jenis === "Kontramast")
    );
    if (hasKontramast) {
      list.push({
        id: "kontramast",
        label: "Kontramast",
        renderIcon: () => (
          <svg width="18" height="20" viewBox="-15 -28 30 36" className="inline-block flex-shrink-0">
            <circle cx="0" cy="0" r="3" fill="#ffffff" stroke={SPARK_ASSET_COLORS.POLE.borderBeton} strokeWidth="1.2" />
            <line x1="0" y1="-3" x2="0" y2="-14" stroke={SPARK_ASSET_COLORS.SCHOOR.kontramast} strokeWidth="1.5" strokeDasharray="2 1.5" />
            <circle cx="0" cy="-17" r="3" fill="#ffffff" stroke={SPARK_ASSET_COLORS.SCHOOR.kontramast} strokeWidth="1.5" />
            <line x1="0" y1="-20" x2="0" y2="-28" stroke={SPARK_ASSET_COLORS.SCHOOR.kontramast} strokeWidth="1.5" />
            <polygon points="-2.5,-23 0,-28 2.5,-23" fill={SPARK_ASSET_COLORS.SCHOOR.kontramast} />
          </svg>
        ),
      });
    }

    // 12. Box APP (kWh Meter)
    const hasBoxApp = nodes.some(n => n.type === "box-app");
    if (hasBoxApp) {
      list.push({
        id: "box-app",
        label: "Box APP",
        renderIcon: () => (
          <svg width="18" height="18" viewBox="-12 -12 24 24" className="inline-block flex-shrink-0">
            <rect x="-9" y="-9" width="18" height="18" fill={SPARK_ASSET_COLORS.BOX_APP.bg} stroke={SPARK_ASSET_COLORS.BOX_APP.border} strokeWidth="1.8" rx="2" />
            <rect x="-5" y="-6" width="10" height="4" fill={SPARK_ASSET_COLORS.BOX_APP.accent} />
            <text x="0" y="5" textAnchor="middle" fontSize="5.5" fontWeight="900" fill={SPARK_ASSET_COLORS.BOX_APP.text}>APP</text>
          </svg>
        ),
      });
    }

    // 13. Kabel JTM Rencana (SUTM/SKUTM/SKTM garis solid biru/merah)
    const hasKabelJtm = edges.some(e => {
      const isExist = e.type === "kabel-existing";
      const isTR = e.type === "kabel-tr" || (e.jenisJaringan && (e.jenisJaringan.includes("TR") || e.jenisJaringan.includes("SKUTR")));
      return !isExist && !isTR;
    });
    if (hasKabelJtm) {
      list.push({
        id: "kabel-jtm",
        label: "Kabel JTM",
        renderIcon: () => (
          <div className="w-7 h-[3px] bg-blue-600 rounded-full inline-block flex-shrink-0 shadow-xs" />
        ),
      });
    }

    // 14. Kabel JTR Rencana (Garis putus-putus hijau)
    const hasKabelJtr = edges.some(e => {
      const isExist = e.type === "kabel-existing";
      const isTR = e.type === "kabel-tr" || (e.jenisJaringan && (e.jenisJaringan.includes("TR") || e.jenisJaringan.includes("SKUTR")));
      return !isExist && isTR;
    });
    if (hasKabelJtr) {
      list.push({
        id: "kabel-jtr",
        label: "Kabel JTR",
        renderIcon: () => (
          <div className="w-7 border-b-[2.5px] border-dashed border-green-600 inline-block flex-shrink-0" />
        ),
      });
    }

    // 15. Kabel JTM Existing (Garis solid hitam)
    const hasKabelJtmExist = edges.some(e => {
      const isExist = e.type === "kabel-existing";
      const isTR = e.type === "kabel-tr" || (e.jenisJaringan && (e.jenisJaringan.includes("TR") || e.jenisJaringan.includes("SKUTR")));
      return isExist && !isTR;
    });
    if (hasKabelJtmExist) {
      list.push({
        id: "kabel-jtm-exist",
        label: "Kabel JTM Existing",
        renderIcon: () => (
          <div className="w-7 h-[2.5px] bg-black rounded-full inline-block flex-shrink-0" />
        ),
      });
    }

    // 16. Kabel JTR Existing (Garis dashed hitam)
    const hasKabelJtrExist = edges.some(e => {
      const isExist = e.type === "kabel-existing";
      const isTR = e.type === "kabel-tr" || (e.jenisJaringan && (e.jenisJaringan.includes("TR") || e.jenisJaringan.includes("SKUTR")));
      return isExist && isTR;
    });
    if (hasKabelJtrExist) {
      list.push({
        id: "kabel-jtr-exist",
        label: "Kabel JTR Existing",
        renderIcon: () => (
          <div className="w-7 border-b-[2.5px] border-dashed border-black inline-block flex-shrink-0" />
        ),
      });
    }

    // 17. Obstacle: Bangunan (Keterangan visual)
    const hasBuilding = obstacles.some(o => o.obstacleType === "building");
    if (hasBuilding) {
      list.push({
        id: "obstacle-building",
        label: "Bangunan",
        renderIcon: () => (
          <svg width="20" height="16" viewBox="-12 -9 24 18" className="inline-block flex-shrink-0">
            <rect x="-10" y="-7" width="20" height="14" rx="2" fill="#ea580c" stroke="#9a3412" strokeWidth="1" />
            <line x1="-5" y1="0" x2="5" y2="0" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        ),
      });
    }

    // 18. Obstacle: Jalan Raya
    const hasRoad = obstacles.some(o => o.obstacleType === "road");
    if (hasRoad) {
      list.push({
        id: "obstacle-road",
        label: "Jalan Raya",
        renderIcon: () => (
          <svg width="22" height="12" viewBox="0 0 22 12" className="inline-block flex-shrink-0">
            <rect width="22" height="12" fill="#334155" rx="1" />
            <line x1="2" y1="6" x2="8" y2="6" stroke="#fbbf24" strokeWidth="1.5" />
            <line x1="14" y1="6" x2="20" y2="6" stroke="#fbbf24" strokeWidth="1.5" />
          </svg>
        ),
      });
    }

    // 19. Obstacle: Gang
    const hasAlley = obstacles.some(o => o.obstacleType === "alley");
    if (hasAlley) {
      list.push({
        id: "obstacle-alley",
        label: "Gang",
        renderIcon: () => (
          <svg width="22" height="10" viewBox="0 0 22 10" className="inline-block flex-shrink-0">
            <rect width="22" height="10" fill="#94a3b8" rx="1" />
            <line x1="1" y1="5" x2="21" y2="5" stroke="#ffffff" strokeWidth="1" strokeDasharray="3 2" />
          </svg>
        ),
      });
    }

    return list;
  }, [nodes, edges, obstacles]);

  // Hitung jumlah baris per kolom
  const effectiveCols = Math.max(1, Math.min(columns, 4));

  return (
    <div className="border border-slate-900 bg-white p-2.5 text-slate-900 font-sans select-none flex flex-col justify-start">
      <div className="font-bold text-[12px] text-slate-900 mb-1.5 pb-0.5 border-b border-slate-300 uppercase tracking-tight">
        Keterangan Simbol :
      </div>

      {usedSymbols.length === 0 ? (
        <div className="text-[11px] text-slate-400 italic py-2">
          (Belum ada simbol di kanvas)
        </div>
      ) : (
        <div
          className={`grid gap-x-4 gap-y-1.5 items-center`}
          style={{
            gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))`,
          }}
        >
          {usedSymbols.map(sym => (
            <div key={sym.id} className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-5 flex items-center justify-center flex-shrink-0">
                {sym.renderIcon()}
              </div>
              <span className="text-[11px] font-semibold text-slate-900 truncate">
                : {sym.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
