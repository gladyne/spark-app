/**
 * SPARK Asset Styles & Constants
 * Sumber tunggal konsistensi visual aset kelistrikan antara Mode Peta (FieldMap) dan Mode Skematik (SchematicCanvas).
 */

export const ASSET_COLORS = {
  // 1. Gardu Distribusi: Kotak / Segitiga Ungu (#9333ea)
  GARDU: {
    primary: "#9333ea",
    bg: "#f3e8ff",
    fill: "#d8b4fe",
    border: "#9333ea",
    text: "#7e22ce",
    label: "Gardu Distribusi",
  },

  // 2. Tiang TM (Tegangan Menengah / JTM): Titik hitam dengan core kuning (#eab308)
  TIANG_TM: {
    border: "#0f172a",
    core: "#eab308",
    color: "#0f172a",
    text: "#0f172a",
    label: "Tiang TM",
  },

  // 3. Tiang TR (Tegangan Rendah / JTR): Titik putih (#ffffff) dengan border biru (#0284c7)
  TIANG_TR: {
    border: "#0284c7",
    core: "#ffffff",
    color: "#0284c7",
    text: "#0369a1",
    label: "Tiang TR",
  },

  // 4. Tiang Existing: Titik solid gelap (#0f172a / #334155)
  TIANG_EXISTING: {
    border: "#0f172a",
    core: "#334155",
    color: "#0f172a",
    text: "#1e293b",
    label: "Tiang Existing",
  },

  // 5. Kabel TM: Garis Merah (#b91c1c)
  KABEL_TM: {
    stroke: "#b91c1c",
    label: "Kabel TM (SUTM/SKUTM)",
    dashArray: "",
  },

  // 6. Kabel TR: Garis Hijau (#15803d)
  KABEL_TR: {
    stroke: "#15803d",
    label: "Kabel TR (SKUTR/SUTR)",
    dashArray: "",
  },

  // 7. Kabel Existing: Garis Gelap / Netral
  KABEL_EXISTING: {
    stroke: "#475569",
    label: "Kabel Existing",
    dashArray: "6,4",
  },

  // 8. Box APP (kWh Meter): Oranye PLN (#ea580c)
  BOX_APP: {
    primary: "#ea580c",
    bg: "#ffedd5",
    border: "#c2410c",
    text: "#9a3412",
    label: "Box APP",
  },

  // 9. Kontramast / Guy Wire Penopang
  KONTRAMAST: {
    primary: "#64748b",
    stroke: "#475569",
    fill: "#f8fafc",
    label: "Kontramast",
  },

  // 10. Selection highlight (Orange)
  SELECTED: {
    stroke: "#f97316",
    halo: "rgba(249, 115, 22, 0.4)",
  },
} as const;

/**
 * Mendapatkan warna kabel berdasarkan jenis jaringan dan tipe
 */
export function getCableStyle(jenisJaringan: string, isExisting: boolean = false) {
  if (isExisting) {
    return {
      stroke: ASSET_COLORS.KABEL_EXISTING.stroke,
      strokeDasharray: ASSET_COLORS.KABEL_EXISTING.dashArray,
      isTM: false,
    };
  }

  const upper = jenisJaringan.toUpperCase();
  const isTR =
    upper.includes("TR") ||
    upper.includes("SKUTR") ||
    upper.includes("SUTR") ||
    upper.includes("RENDAH");

  if (isTR) {
    return {
      stroke: ASSET_COLORS.KABEL_TR.stroke,
      strokeDasharray: "",
      isTM: false,
    };
  }

  return {
    stroke: ASSET_COLORS.KABEL_TM.stroke,
    strokeDasharray: "",
    isTM: true,
  };
}

/**
 * Mendapatkan style tiang berdasarkan tipe node
 */
export function getPoleStyle(nodeType: string, kategori?: "TM" | "TR") {
  if (nodeType === "tiang-existing") {
    return ASSET_COLORS.TIANG_EXISTING;
  }
  if (nodeType === "tiang-tr" || kategori === "TR") {
    return ASSET_COLORS.TIANG_TR;
  }
  // Default rencana adalah TM
  return ASSET_COLORS.TIANG_TM;
}
