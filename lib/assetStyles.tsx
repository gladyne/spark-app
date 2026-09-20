import React from "react";
import type { GarduConfig, SchoorConfig } from "../types/spark";

/**
 * SPARK Asset Styles & Constants
 * Single Source of Truth yang diekstrak langsung dari SparkMap.tsx & svgUtils.ts.
 * Dipakai secara identik baik di SparkMap (mode peta) maupun SchematicCanvas (mode skematik).
 */

export const SPARK_ASSET_COLORS = {
  // 1. Tiang (Skema Warna Baru SPARK 2026)
  // Fill = Status Jaringan (Putih = Rencana, Hitam = Existing)
  // Border = Material Tiang (Hijau = Beton, Abu-abu/Silver = Baja/Besi)
  POLE: {
    size: 17,
    rencanaBg: "#ffffff",      // Putih untuk status Rencana
    existingBg: "#000000",     // Hitam untuk status Existing
    borderBeton: "#16a34a",    // Hijau untuk Tiang Beton
    borderBaja: "#9ca3af",     // Abu-abu/Silver untuk Tiang Baja
    lastAccentRing: "#ff5722", // Aksen oranye khusus Tiang Ujung (Dead-end)
    selectedHalo: "#f97316",
    selectedRing: "#ff5722",
  },

  // 2. Gardu Distribusi (dari svgUtils.ts)
  GARDU: {
    stroke: "#9333ea",
    fill: "#f3e8ff",
    strokeWidth: 3,
  },

  // 3. Schoor / Penopang (dari svgUtils.ts)
  SCHOOR: {
    treck: "#dc2626",      // Merah panah tarik keluar
    druck: "#0284c7",      // Biru panah dorong ke dalam
    kontramast: "#059669", // Hijau tiang jangkar & kawat
    autoTreck: "#34d399",
    autoDruck: "#22d3ee",
    autoKontramast: "#86efac",
  },

  // 4. Kabel & Konduktor (dari SparkMap.tsx & layerColors.ts)
  CABLE: {
    sutmRencana: "#2563eb",   // Biru / Merah TM
    sutmExisting: "#000000",  // Hitam solid
    skutrRencana: "#15803d",  // Hijau TR
    skutrExisting: "#000000", // Hitam dashed
    skutm: "#7c3aed",         // Ungu
    sktm: "#b45309",          // Cokelat kabel tanah
    sktr: "#166534",          // Hijau tanah
    existingDash: "8, 8",
  },

  // 5. Box APP (kWh Meter)
  BOX_APP: {
    border: "#2563eb",
    bg: "#dbeafe",
    accent: "#93c5fd",
    text: "#1e3a8a",
  },
} as const;

// Legacy alias compatibility
export const ASSET_COLORS = {
  GARDU: {
    primary: SPARK_ASSET_COLORS.GARDU.stroke,
    bg: SPARK_ASSET_COLORS.GARDU.fill,
    fill: "#d8b4fe",
    border: SPARK_ASSET_COLORS.GARDU.stroke,
    text: "#7e22ce",
  },
  TIANG_TM: {
    border: "#16a34a",
    core: "#ffffff",
    color: "#16a34a",
  },
  TIANG_TR: {
    border: "#16a34a",
    core: "#ffffff",
    color: "#16a34a",
  },
  TIANG_EXISTING: {
    border: "#16a34a",
    core: "#000000",
    color: "#16a34a",
  },
  TIANG_BAJA_RENCANA: {
    border: "#9ca3af",
    core: "#ffffff",
    color: "#9ca3af",
  },
  TIANG_BAJA_EXISTING: {
    border: "#9ca3af",
    core: "#000000",
    color: "#9ca3af",
  },
  KABEL_TM: {
    stroke: "#dc2626",
  },
  KABEL_TR: {
    stroke: "#15803d",
  },
  KABEL_EXISTING: {
    stroke: "#000000",
    dashArray: "8, 8",
  },
  BOX_APP: {
    primary: "#2563eb",
    bg: "#dbeafe",
    border: "#2563eb",
    text: "#1e3a8a",
  },
  KONTRAMAST: {
    primary: "#059669",
    stroke: "#059669",
    fill: "#ffffff",
  },
  SELECTED: {
    stroke: "#f97316",
    halo: "rgba(249, 115, 22, 0.4)",
  },
} as const;

/**
 * Mendapatkan style garis kabel persis SparkMap.tsx & layerColors.ts
 */
export function getCableStyle(jenisJaringan: string = "SUTM", isExisting: boolean = false) {
  const jj = jenisJaringan.toUpperCase();

  if (isExisting) {
    const isDashed = jj.includes("TR") || jj.includes("SKUTR");
    return {
      stroke: "#000000",
      strokeDasharray: isDashed ? "8, 8" : undefined,
      strokeWidth: 3,
    };
  }

  if (jj === "SKUTM") {
    return { stroke: "#7c3aed", strokeDasharray: undefined, strokeWidth: 3.5 };
  }
  if (jj === "SKTM") {
    return { stroke: "#b45309", strokeDasharray: undefined, strokeWidth: 4.5 };
  }
  if (jj === "SKTR") {
    return { stroke: "#15803d", strokeDasharray: undefined, strokeWidth: 3.5 };
  }
  if (jj.includes("TR") || jj.includes("SKUTR") || jj.includes("SUTR")) {
    return { stroke: "#15803d", strokeDasharray: "8, 8", strokeWidth: 3.2 };
  }

  // SUTM Rencana (Merah atau Biru TM)
  return { stroke: "#dc2626", strokeDasharray: undefined, strokeWidth: 3.2 };
}

/**
 * ─── RAW SVG RENDERERS (Persis SparkMap.tsx & svgUtils.ts) ──────────────────
 */

/**
 * Render Simbol Tiang (Beton / Baja / Existing / Terminasi)
 */
/**
 * Parameter untuk kalkulasi style tiang
 */
export interface PoleStyleParams {
  material?: string;
  status?: string;
  isExisting?: boolean;
  isLast?: boolean;
  size?: number;
}

export interface PoleStyleResult {
  bg: string;
  border: string;
  size: number;
  borderWidth: number;
  isExisting: boolean;
  isBaja: boolean;
  isLast: boolean;
  accentRingColor: string | null;
}

/**
 * Single Source of Truth untuk styling Tiang di SPARK:
 * 1. Fill (isi lingkaran):
 *    - Rencana: Putih (#ffffff)
 *    - Existing: Hitam (#000000)
 * 2. Border (garis tepi):
 *    - Beton: Hijau (#16a34a)
 *    - Baja/Besi: Abu-abu/Silver (#9ca3af)
 * 3. Tiang Ujung (isLast / Dead-end):
 *    - Ukuran lebih besar (21px vs 17px)
 *    - Border lebih tebal (3px vs 2px)
 *    - Aksen ring oranye (#ff5722)
 */
export function getPoleStyle({
  material = "Beton",
  status = "Rencana",
  isExisting,
  isLast = false,
  size = 17,
}: PoleStyleParams): PoleStyleResult {
  const existing = isExisting !== undefined
    ? isExisting
    : (status ? status.toLowerCase().includes("exist") : false);
  const isBaja = material.toLowerCase().includes("baja") || material.toLowerCase().includes("besi");

  const bg = existing ? SPARK_ASSET_COLORS.POLE.existingBg : SPARK_ASSET_COLORS.POLE.rencanaBg;
  const border = isBaja ? SPARK_ASSET_COLORS.POLE.borderBaja : SPARK_ASSET_COLORS.POLE.borderBeton;
  const finalSize = isLast ? size + 4 : size;
  const borderWidth = isLast ? 3 : 2;

  return {
    bg,
    border,
    size: finalSize,
    borderWidth,
    isExisting: existing,
    isBaja,
    isLast,
    accentRingColor: isLast ? SPARK_ASSET_COLORS.POLE.lastAccentRing : null,
  };
}

/**
 * Render Simbol Tiang (Beton / Baja / Existing / Terminasi)
 */
export function renderPoleSvg({
  material = "Beton",
  status = "Rencana",
  isExisting,
  isTerminasi = false,
  isLast = false,
  isSelected = false,
  size = 17,
}: {
  material?: string;
  status?: string;
  isExisting?: boolean;
  isTerminasi?: boolean;
  isLast?: boolean;
  isSelected?: boolean;
  size?: number;
}) {
  const style = getPoleStyle({ material, status, isExisting, isLast, size });
  const r = size / 2;

  // Diamond shape jika terminasi kabel tanah (Persis SparkMap.tsx)
  if (isTerminasi) {
    const s = r * 1.5;
    return (
      <g>
        <polygon
          points={`0,-${s * 0.85} ${s * 0.85},0 0,${s * 0.85} -${s * 0.85},0`}
          fill={style.bg}
          stroke={style.border}
          strokeWidth={style.borderWidth}
        />
        <text
          x="0"
          y="1"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={s * 0.55}
          fontWeight="900"
          fill={style.isExisting ? "#ffffff" : style.border}
          fontFamily="monospace"
        >
          T
        </text>
      </g>
    );
  }

  return (
    <g>
      {/* Aksen Tiang Ujung (Outer orange accent ring) */}
      {style.isLast && (
        <circle
          r={r + 3}
          fill="none"
          stroke={style.accentRingColor || "#ff5722"}
          strokeWidth={2}
          strokeDasharray="3,2"
        />
      )}
      {/* Circle Tiang: Fill Status (Putih/Hitam) + Border Material (Hijau/Abu-abu) */}
      <circle
        r={r}
        fill={style.bg}
        stroke={style.border}
        strokeWidth={style.borderWidth}
      />
    </g>
  );
}

/**
 * ─── KATALOG SPESIFIKASI TIANG RAB KHS 2026 ─────────────────────────────────
 * Diekstrak langsung dari rab_katalog_dengan_harga.json (Section: MATERIAL UTAMA, "Mendirikan Tiang")
 * Menjadi Single Source of Truth kombinasi valid [material + tinggi + kekuatan daN]
 * untuk SparkMap.tsx, SchematicCanvas.tsx, NetworkSettings.tsx, dan rabMapper.ts.
 */
export type MaterialTiang = "Beton" | "Baja";

export interface TiangKatalogSpec {
  material: MaterialTiang;
  tinggi: number;
  kekuatan: number;
  rowKhs: number;
  label: string;
}

export const TIANG_KATALOG_SPECS: TiangKatalogSpec[] = [
  // ─── Tiang Beton (5 Kombinasi Valid KHS) ───
  { material: "Beton", tinggi: 9, kekuatan: 200, rowKhs: 19, label: "9m 200 daN (JTR Standar)" },
  { material: "Beton", tinggi: 12, kekuatan: 200, rowKhs: 20, label: "12m 200 daN (JTM Tumpu)" },
  { material: "Beton", tinggi: 12, kekuatan: 350, rowKhs: 21, label: "12m 350 daN (JTM Sudut/Trafo)" },
  { material: "Beton", tinggi: 13, kekuatan: 350, rowKhs: 22, label: "13m 350 daN" },
  { material: "Beton", tinggi: 14, kekuatan: 350, rowKhs: 23, label: "14m 350 daN" },

  // ─── Tiang Baja (8 Kombinasi Valid KHS) ───
  { material: "Baja", tinggi: 7, kekuatan: 100, rowKhs: 24, label: "7m 100 daN" },
  { material: "Baja", tinggi: 9, kekuatan: 100, rowKhs: 25, label: "9m 100 daN" },
  { material: "Baja", tinggi: 9, kekuatan: 200, rowKhs: 26, label: "9m 200 daN" },
  { material: "Baja", tinggi: 11, kekuatan: 200, rowKhs: 27, label: "11m 200 daN" },
  { material: "Baja", tinggi: 12, kekuatan: 200, rowKhs: 28, label: "12m 200 daN" },
  { material: "Baja", tinggi: 12, kekuatan: 350, rowKhs: 29, label: "12m 350 daN" },
  { material: "Baja", tinggi: 13, kekuatan: 350, rowKhs: 30, label: "13m 350 daN" },
  { material: "Baja", tinggi: 14, kekuatan: 350, rowKhs: 31, label: "14m 350 daN" },
];

/**
 * Mendapatkan daftar tinggi tiang yang valid berdasarkan material
 */
export function getValidTinggiTiang(material: string): number[] {
  const isBaja = material.toLowerCase().includes("baja") || material.toLowerCase().includes("besi");
  const mat: MaterialTiang = isBaja ? "Baja" : "Beton";
  const heights = Array.from(
    new Set(TIANG_KATALOG_SPECS.filter(s => s.material === mat).map(s => s.tinggi))
  );
  return heights.sort((a, b) => a - b);
}

/**
 * Mendapatkan daftar kekuatan (daN) yang valid berdasarkan material & tinggi
 */
export function getValidKekuatanTiang(material: string, tinggi: number): number[] {
  const isBaja = material.toLowerCase().includes("baja") || material.toLowerCase().includes("besi");
  const mat: MaterialTiang = isBaja ? "Baja" : "Beton";
  const specs = TIANG_KATALOG_SPECS.filter(s => s.material === mat && s.tinggi === tinggi);
  const dans = Array.from(new Set(specs.map(s => s.kekuatan)));
  return dans.sort((a, b) => a - b);
}

/**
 * Memastikan kombinasi material, tinggi, dan kekuatan selalu valid sesuai katalog KHS
 */
export function getValidTiangCombo(material: string, tinggi?: number, kekuatan?: number): {
  material: MaterialTiang;
  tinggi: number;
  kekuatan: number;
} {
  const isBaja = material.toLowerCase().includes("baja") || material.toLowerCase().includes("besi");
  const mat: MaterialTiang = isBaja ? "Baja" : "Beton";
  const validHeights = getValidTinggiTiang(mat);

  const chosenTinggi = tinggi && validHeights.includes(tinggi)
    ? tinggi
    : (validHeights.includes(12) ? 12 : validHeights[0]);

  const validDans = getValidKekuatanTiang(mat, chosenTinggi);
  const chosenKekuatan = kekuatan && validDans.includes(kekuatan)
    ? kekuatan
    : validDans[0];

  return {
    material: mat,
    tinggi: chosenTinggi,
    kekuatan: chosenKekuatan,
  };
}

/**
 * Mendapatkan daftar material tiang yang didukung katalog
 */
export function getValidMaterials(): MaterialTiang[] {
  return ["Beton", "Baja"];
}

/**
 * Helper transisi cascading ketika material tiang diubah
 */
export function handleTiangMaterialChange(
  newMaterial: string,
  curTinggi?: number,
  curKekuatan?: number
): { material: MaterialTiang; tinggi: number; kekuatan: number } {
  return getValidTiangCombo(newMaterial, curTinggi, curKekuatan);
}

/**
 * Helper transisi cascading ketika tinggi tiang diubah
 */
export function handleTiangTinggiChange(
  newTinggi: number,
  curMaterial: string,
  curKekuatan?: number
): { tinggi: number; kekuatan: number } {
  const isBaja = curMaterial.toLowerCase().includes("baja") || curMaterial.toLowerCase().includes("besi");
  const mat: MaterialTiang = isBaja ? "Baja" : "Beton";
  const validDans = getValidKekuatanTiang(mat, newTinggi);
  const nextKekuatan = curKekuatan && validDans.includes(curKekuatan) ? curKekuatan : validDans[0];
  return { tinggi: newTinggi, kekuatan: nextKekuatan };
}

/**
 * Konfigurasi Kapasitas & Opsi Gardu Distribusi
 * Sumber kebenaran tunggal yang dipakai bersama oleh:
 * SparkMap.tsx, SchematicCanvas.tsx, GarduModal.tsx, ComponentPalette.tsx.
 */
export const CANTOL_MAX_KVA = 100;

export const GARDU_JENIS_OPTIONS = [
  { value: "Cantol", label: "Cantol (1 Tiang – Maks 100 kVA)", maxKva: 100 },
  { value: "Portal", label: "Portal (2 Tiang – s/d 1000 kVA)", maxKva: 1000 },
] as const;

export const GARDU_TRAFO_OPTIONS = [
  "25 kVA",
  "50 kVA",
  "100 kVA",
  "160 kVA",
  "200 kVA",
  "250 kVA",
  "400 kVA",
  "630 kVA",
  "1000 kVA",
] as const;

export function parseKva(trafoLabelOrNum: string | number | undefined): number {
  if (typeof trafoLabelOrNum === "number") return trafoLabelOrNum;
  if (!trafoLabelOrNum) return 0;
  return parseInt(String(trafoLabelOrNum).replace(/[^0-9]/g, ""), 10) || 0;
}

export function isKvaAllowedForGardu(jenis: "Cantol" | "Portal", kva: number): boolean {
  if (jenis === "Cantol") return kva <= CANTOL_MAX_KVA;
  return true;
}

export function getValidTrafoOptions(jenis: "Cantol" | "Portal", customOptions?: string[]): string[] {
  const baseList = customOptions && customOptions.length > 0 ? customOptions : (GARDU_TRAFO_OPTIONS as unknown as string[]);
  if (jenis === "Cantol") {
    return baseList.filter(t => parseKva(t) <= CANTOL_MAX_KVA);
  }
  return [...baseList];
}

/**
 * Render Simbol Gardu (Cantol / Portal) - Persis SparkMap.tsx & svgUtils.ts
 * Mendukung rotasi bebas (0-360°) dan offset visual (offsetX, offsetY) dari tiang induk.
 */
export function renderGarduSvg({
  jenis = "Portal",
  orientasi = "Horizontal",
  rotationDeg,
  offsetX = 0,
  offsetY = 0,
  trafoKva = 100,
  poleSize = 17,
  renderMainPole = true,
  isSelected = false,
  showHandles = false,
  onRotateMouseDown,
  onOffsetMouseDown,
}: {
  jenis?: "Cantol" | "Portal";
  orientasi?: "Horizontal" | "Vertikal";
  rotationDeg?: number;
  offsetX?: number;
  offsetY?: number;
  trafoKva?: number;
  poleSize?: number;
  renderMainPole?: boolean;
  isSelected?: boolean;
  showHandles?: boolean;
  onRotateMouseDown?: (e: React.MouseEvent) => void;
  onOffsetMouseDown?: (e: React.MouseEvent) => void;
}) {
  const trafoColor = SPARK_ASSET_COLORS.GARDU.stroke;
  const trafoBg = SPARK_ASSET_COLORS.GARDU.fill;
  const r = poleSize / 2; // 8.5
  const gap = 3;

  const effectiveRot =
    typeof rotationDeg === "number"
      ? rotationDeg
      : orientasi === "Vertikal"
      ? 90
      : 0;

  const hasOffset = Math.abs(offsetX) > 0.5 || Math.abs(offsetY) > 0.5;

  if (jenis === "Cantol") {
    // 1 Tiang dengan segitiga trafo duduk pas di atas tiang (tinggi 14px, lebar 17px)
    return (
      <g>
        {/* Titik jangkar tiang induk asli jika ada offset */}
        {hasOffset && (
          <>
            <line
              x1={0}
              y1={0}
              x2={offsetX}
              y2={offsetY}
              stroke={trafoColor}
              strokeWidth={1.5}
              strokeDasharray="3,3"
              opacity={0.65}
            />
            <circle cx={0} cy={0} r={3} fill={trafoColor} opacity={0.8} />
          </>
        )}

        {/* Simbol Gardu Cantol pada posisi offset + rotasi */}
        <g transform={`translate(${offsetX}, ${offsetY})`}>
          <g transform={`rotate(${effectiveRot})`}>
            {renderMainPole && (
              <circle cx="0" cy="0" r={r} fill="white" stroke="#000000" strokeWidth={2} />
            )}
            <polygon
              points={`0,-${r + 14} ${r},-${r - 1} -${r},-${r - 1}`}
              fill={trafoBg}
              stroke={trafoColor}
              strokeWidth={2}
              strokeLinejoin="round"
            />

            {/* Handle Rotasi On-Canvas saat terseleksi */}
            {showHandles && (
              <g
                className="cursor-grab hover:scale-125 transition-transform"
                onMouseDown={onRotateMouseDown}
              >
                <line
                  x1={0}
                  y1={-(r + 14)}
                  x2={0}
                  y2={-(r + 26)}
                  stroke={trafoColor}
                  strokeWidth={1.5}
                  strokeDasharray="2,2"
                />
                <circle
                  cx={0}
                  cy={-(r + 26)}
                  r={5}
                  fill="#9333ea"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              </g>
            )}
          </g>

          {/* Handle Offset On-Canvas saat terseleksi */}
          {showHandles && (
            <g
              className="cursor-move hover:scale-110 transition-transform"
              onMouseDown={onOffsetMouseDown}
            >
              <title>Drag untuk geser posisi dari tiang</title>
              <circle
                cx={0}
                cy={0}
                r={6}
                fill="#a855f7"
                fillOpacity={0.25}
                stroke="#9333ea"
                strokeWidth={1.5}
                strokeDasharray="2,2"
              />
            </g>
          )}
        </g>
      </g>
    );
  }

  // Portal: 2 Tiang berdampingan dengan bentang trafo di atas kedua tiang
  const offset = -(poleSize + gap); // -(17 + 3) = -20
  return (
    <g>
      {/* Titik jangkar tiang induk asli jika ada offset */}
      {hasOffset && (
        <>
          <line
            x1={0}
            y1={0}
            x2={offsetX}
            y2={offsetY}
            stroke={trafoColor}
            strokeWidth={1.5}
            strokeDasharray="3,3"
            opacity={0.65}
          />
          <circle cx={0} cy={0} r={3} fill={trafoColor} opacity={0.8} />
        </>
      )}

      {/* Simbol Gardu Portal pada posisi offset + rotasi bebas */}
      <g transform={`translate(${offsetX}, ${offsetY})`}>
        <g transform={`rotate(${effectiveRot})`}>
          {renderMainPole && (
            <>
              <circle cx="0" cy="0" r={r} fill="white" stroke="#000000" strokeWidth={2} />
              <circle cx={offset} cy="0" r={r} fill="white" stroke="#000000" strokeWidth={2} />
            </>
          )}
          {/* Balok / Segitiga trafo di atas kedua tiang */}
          <polygon
            points={`
              ${offset / 2},-${r + 14}
              ${r * 0.8},-${r - 1}
              ${offset - r * 0.8},-${r - 1}
            `}
            fill={trafoBg}
            stroke={trafoColor}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />

          {/* Handle Rotasi On-Canvas saat terseleksi */}
          {showHandles && (
            <g
              className="cursor-grab hover:scale-125 transition-transform"
              onMouseDown={onRotateMouseDown}
            >
              <title>{`Drag untuk rotasi bebas (${Math.round(effectiveRot)}°)`}</title>
              <line
                x1={offset / 2}
                y1={-(r + 14)}
                x2={offset / 2}
                y2={-(r + 26)}
                stroke={trafoColor}
                strokeWidth={1.5}
                strokeDasharray="2,2"
              />
              <circle
                cx={offset / 2}
                cy={-(r + 26)}
                r={5.5}
                fill="#9333ea"
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </g>
          )}
        </g>

        {/* Handle Offset On-Canvas saat terseleksi */}
        {showHandles && (
          <g
            className="cursor-move hover:scale-110 transition-transform"
            onMouseDown={onOffsetMouseDown}
          >
            <title>Drag untuk geser posisi dari tiang</title>
            <circle
              cx={offset / 2}
              cy={0}
              r={7}
              fill="#a855f7"
              fillOpacity={0.25}
              stroke="#9333ea"
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
          </g>
        )}
      </g>
    </g>
  );
}

/**
 * Render Simbol Schoor / Penopang - Persis buildSchoorSvg di svgUtils.ts
 */
export function renderSchoorSvg({
  jenis = "Treck",
  tipe = "Standar",
  rot = 0,
  poleSize = 17,
  isAutoSchoor = false,
}: {
  jenis: "Treck" | "Druck" | "Kontramast";
  tipe?: "Standar" | "Tolak Pinggang";
  rot?: number;
  poleSize?: number;
  isAutoSchoor?: boolean;
}) {
  const ph = poleSize / 2;
  let sColor: string = isAutoSchoor ? SPARK_ASSET_COLORS.SCHOOR.autoTreck : SPARK_ASSET_COLORS.SCHOOR.treck;
  if (jenis === "Druck") sColor = isAutoSchoor ? SPARK_ASSET_COLORS.SCHOOR.autoDruck : SPARK_ASSET_COLORS.SCHOOR.druck;
  if (jenis === "Kontramast") sColor = isAutoSchoor ? SPARK_ASSET_COLORS.SCHOOR.autoKontramast : SPARK_ASSET_COLORS.SCHOOR.kontramast;

  return (
    <g transform={`rotate(${rot})`}>
      {/* 1. Treckschoor Standar (Panah tarik keluar menjauhi tiang) */}
      {jenis === "Treck" && tipe !== "Tolak Pinggang" && (
        <g>
          <line x1="0" y1={-ph} x2="0" y2="-36" stroke={sColor} strokeWidth="2.2" strokeLinecap="round" />
          <polygon points="-3.5,-28 0,-36 3.5,-28" fill={sColor} />
        </g>
      )}

      {/* 1b. Treckschoor Tolak Pinggang (Dengan batang penopang samping di tengah kawat) */}
      {jenis === "Treck" && tipe === "Tolak Pinggang" && (
        <g>
          {/* Batang tolak pinggang */}
          <line x1="0" y1="-18" x2="14" y2="-18" stroke={sColor} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="14" cy="-18" r="2" fill={sColor} />
          {/* Kawat tarik melalui ujung penopang tolak pinggang ke jangkar */}
          <line x1="0" y1={-ph} x2="14" y2="-18" stroke={sColor} strokeWidth="1.8" />
          <line x1="14" y1="-18" x2="0" y2="-38" stroke={sColor} strokeWidth="2.2" strokeLinecap="round" />
          <polygon points="-3.5,-30 0,-38 3.5,-30" fill={sColor} />
        </g>
      )}

      {/* 2. Drukschoor (Panah dorong mengarah ke tiang) */}
      {jenis === "Druck" && (
        <g>
          <line x1="0" y1={-(ph + 8)} x2="0" y2="-36" stroke={sColor} strokeWidth="2.2" strokeLinecap="round" />
          <polygon points={`-3.5,-${ph + 8} 0,-${ph} 3.5,-${ph + 8}`} fill={sColor} />
        </g>
      )}

      {/* 3. Kontramast (Kawat putus-putus ke tiang jangkar seberang + treckschoor) */}
      {jenis === "Kontramast" && (
        <g>
          {/* Span kawat ke tiang jangkar seberang */}
          <line x1="0" y1={-ph} x2="0" y2="-40" stroke={sColor} strokeWidth="1.8" strokeDasharray="4 2" />
          {/* Tiang jangkar seberang */}
          <circle cx="0" cy="-46" r="5.5" fill="white" stroke={sColor} strokeWidth="2" />
          {/* Kawat penarik ke tanah dari tiang jangkar */}
          <line x1="0" y1="-51.5" x2="0" y2="-72" stroke={sColor} strokeWidth="1.8" strokeLinecap="round" />
          <polygon points="-3,-64 0,-72 3,-64" fill={sColor} />
        </g>
      )}
    </g>
  );
}

/**
 * Render Simbol Box APP (kWh Meter PLN)
 */
export function renderBoxAppSvg({
  boxKva = 197,
  size = 18,
}: {
  boxKva?: number;
  size?: number;
}) {
  const hs = size / 2;
  return (
    <g>
      <rect
        x={-hs}
        y={-hs}
        width={size}
        height={size}
        fill={SPARK_ASSET_COLORS.BOX_APP.bg}
        stroke={SPARK_ASSET_COLORS.BOX_APP.border}
        strokeWidth={2}
        rx={2}
      />
      <rect
        x={-hs * 0.65}
        y={-hs * 0.65}
        width={size * 0.65}
        height={size * 0.28}
        fill={SPARK_ASSET_COLORS.BOX_APP.accent}
        rx={1}
      />
      <text
        x="0"
        y={hs * 0.6}
        textAnchor="middle"
        fontSize={size * 0.35}
        fontWeight="900"
        fill={SPARK_ASSET_COLORS.BOX_APP.text}
        fontFamily="sans-serif"
      >
        APP
      </text>
    </g>
  );
}

/**
 * Helper memformat teks label komponen persis format SparkMap.tsx (Image 1)
 */
export function getNodeLabelConfig(node: {
  id: string;
  type: string;
  label?: string;
  konstruksi?: string;
  garduJenis?: string;
  trafoKva?: number;
  boxKva?: number;
}): {
  primaryText: string;
  primaryColor: string;
  garduText?: string;
  trafoText?: string;
  secondaryText?: string;
} {
  if (node.type === "gardu") {
    const ktr = node.konstruksi || "A1";
    const gType = `Gardu ${node.garduJenis || "Portal"}`;
    const kva = `${node.trafoKva || 100} kVA`;
    return {
      primaryText: ktr,
      primaryColor: "#c2410c",
      garduText: gType,
      trafoText: kva,
    };
  }

  if (node.type === "box-app") {
    return {
      primaryText: "BOX APP",
      primaryColor: "#1e3a8a",
      trafoText: `${node.boxKva || 197} kVA`,
    };
  }

  if (node.type === "treck-schoor" || node.type === "druck-schoor" || node.type === "kontramast") {
    const name = node.type === "treck-schoor" ? "Treck" : node.type === "druck-schoor" ? "Druck" : "Kontramast";
    return {
      primaryText: node.label || name,
      primaryColor: node.type === "kontramast" ? "#059669" : node.type === "druck-schoor" ? "#0284c7" : "#dc2626",
    };
  }

  // Tiang
  const isExist = node.type === "tiang-existing";
  const ktr = node.konstruksi || (isExist ? "Exist" : "A1");
  const lbl = node.label || "";

  // Jika label beda dengan konstruksi (misal "T.01")
  if (lbl && lbl !== ktr && !lbl.toLowerCase().includes("tiang")) {
    return {
      primaryText: ktr,
      primaryColor: isExist ? "#475569" : "#c2410c",
      secondaryText: lbl,
    };
  }

  return {
    primaryText: ktr,
    primaryColor: isExist ? "#475569" : "#c2410c",
  };
}
