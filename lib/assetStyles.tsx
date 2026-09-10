import React from "react";
import type { GarduConfig, SchoorConfig } from "../types/spark";

/**
 * SPARK Asset Styles & Constants
 * Single Source of Truth yang diekstrak langsung dari SparkMap.tsx & svgUtils.ts.
 * Dipakai secara identik baik di SparkMap (mode peta) maupun SchematicCanvas (mode skematik).
 */

export const SPARK_ASSET_COLORS = {
  // 1. Tiang
  POLE: {
    size: 17,
    rencanaBg: "#ffeb3b", // Kuning khas SparkMap.tsx
    rencanaBorder: "#000000",
    existingBg: "#000000",
    existingBorder: "#ffffff",
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
    border: "#000000",
    core: "#ffeb3b",
    color: "#000000",
  },
  TIANG_TR: {
    border: "#0284c7",
    core: "#ffffff",
    color: "#0284c7",
  },
  TIANG_EXISTING: {
    border: "#ffffff",
    core: "#000000",
    color: "#000000",
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
export function renderPoleSvg({
  material = "Beton",
  isExisting = false,
  isTerminasi = false,
  isLast = false,
  isSelected = false,
  size = 17,
}: {
  material?: string;
  isExisting?: boolean;
  isTerminasi?: boolean;
  isLast?: boolean;
  isSelected?: boolean;
  size?: number;
}) {
  const r = size / 2;
  const isBaja = material.toLowerCase().includes("baja") || material.toLowerCase().includes("besi");
  const bg = isExisting ? "#000000" : "#ffeb3b";
  const border = isLast ? "#ff5722" : isExisting ? "#ffffff" : "#000000";
  const strokeW = isLast ? 3 : 2;

  // Diamond shape jika terminasi kabel tanah (Persis SparkMap.tsx baris 1701)
  if (isTerminasi) {
    const s = r * 1.5;
    return (
      <g>
        <polygon
          points={`0,-${s * 0.85} ${s * 0.85},0 0,${s * 0.85} -${s * 0.85},0`}
          fill={bg}
          stroke={border}
          strokeWidth={strokeW}
        />
        <text
          x="0"
          y="1"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={s * 0.55}
          fontWeight="900"
          fill={border}
          fontFamily="monospace"
        >
          T
        </text>
      </g>
    );
  }

  return (
    <g>
      {/* Outer Circle Tiang */}
      <circle
        r={r}
        fill={bg}
        stroke={border}
        strokeWidth={strokeW}
      />
      {/* Jika Tiang Baja: Double-ring konsentris untuk membedakan dengan Tiang Beton */}
      {isBaja && (
        <circle
          r={r * 0.6}
          fill="none"
          stroke={border}
          strokeWidth={1.5}
        />
      )}
    </g>
  );
}

/**
 * Render Simbol Gardu (Cantol / Portal) - Persis SparkMap.tsx & svgUtils.ts
 * Tanpa teks bertumpuk di dalam segitiga trafo.
 */
export function renderGarduSvg({
  jenis = "Portal",
  orientasi = "Horizontal",
  trafoKva = 100,
  poleSize = 17,
  renderMainPole = true,
}: {
  jenis?: "Cantol" | "Portal";
  orientasi?: "Horizontal" | "Vertikal";
  trafoKva?: number;
  poleSize?: number;
  renderMainPole?: boolean;
}) {
  const trafoColor = SPARK_ASSET_COLORS.GARDU.stroke;
  const trafoBg = SPARK_ASSET_COLORS.GARDU.fill;
  const r = poleSize / 2; // 8.5
  const gap = 3;

  if (jenis === "Cantol") {
    // 1 Tiang dengan segitiga trafo duduk pas di atas tiang (tinggi 14px, lebar 17px)
    return (
      <g>
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
      </g>
    );
  }

  // Portal: 2 Tiang berdampingan dengan bentang trafo di atas kedua tiang
  const offset = -(poleSize + gap); // -(17 + 3) = -20
  return (
    <g>
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
