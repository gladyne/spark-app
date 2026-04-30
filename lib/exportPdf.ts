import { haversineMeters } from "./geo";
import type { LayerStat } from "../components/modals/RekapModal";
import type { PoleData, SchoorConfig, GarduConfig } from "../types/spark";
import type { PoleTypeResult } from "./computePoleData";

// ── Constants ──────────────────────────────────────────────────────────────

const CONDUCTOR_TIPE: Record<string, string> = {
  "SUTM": "AAACS", "SUTM + SKUTR": "AAACS",
  "SUTM Underbuild (2 Jaringan)": "AAACS", "SUTM Underbuild (3 Jaringan)": "AAACS",
  "SKUTM": "NFA2XSY-T", "SKTM": "NA2XSEBY",
  "SKUTR": "NFA2X", "SKTR": "NFA2X",
};

const KONSTRUKSI_LABEL: Record<string, string> = {
  "A3 Pole":   "A3 Pole (Tiang Ujung / Tarik)",
  "A3 Branch": "A3 Branch (Titik Sambungan)",
  "A3":        "A3 (Tiang Tarik)",
  "A2":        "A2 (Tiang Sudut)",
  "A1":        "A1 (Tiang Lurus / Suspensi)",
  "2xA3":      "2x A3 (Tarik Ganda)",
  "S":         "Suspession Assy",
  "LA":        "Large Angel Assy",
  "FDE":       "Fix Dead End Assy",
  "BDL+DE":   "Bundle End Protection",
  "Trm":       "Termination Assy",
  "2xTrm":     "2x Termination Assy",
  "JNT":       "Joint Sleeve",
};

const KONSTRUKSI_ORDER = [
  "A3 Pole","A3 Branch","A3","2xA3","A2","A1","S","LA","FDE","BDL+DE","Trm","2xTrm","JNT",
];

const TYPE_COLOR: Record<string, string> = {
  A1:          "#3b82f6",
  A2:          "#f59e0b",
  A3:          "#ef4444",
  "A3 Pole":   "#ef4444",
  "A3 Branch": "#8b5cf6",
  "2xA3":      "#dc2626",
  S:           "#0ea5e9",
  LA:          "#d97706",
  FDE:         "#16a34a",
  "BDL+DE":    "#0d9488",
  Trm:         "#6366f1",
};

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface LayerDrawData {
  id: number;
  label: string;
  poles: [number, number][];
  line:  [number, number][];      // route line from OSRM / lurus
  poleTypes: PoleTypeResult[];    // per-pole construction type
  jenisJaringan: string;
  statusJaringan: string;
}

export interface ExportPdfOptions {
  projectTitle: string;
  layers: LayerDrawData[];
  // stats for BOM panel
  poles: [number, number][];
  poleData: PoleData[];
  effectiveSchoors: Record<number, SchoorConfig>;
  gardus: Record<number, GarduConfig>;
  jenisJaringan: string;
  statusJaringan: string;
  totalLengthM: number;
  tinggiTiang: number;
  materialTiang: string;
  jarakGawang: number;
  kondukturUkuran: number;
  activeBranchCount: number;
  savedLayerStats: LayerStat[];
}

// ── Schematic drawing ──────────────────────────────────────────────────────

function drawSchematic(
  canvas: HTMLCanvasElement,
  layers: LayerDrawData[],
  SCALE: number,
): void {
  const ctx = canvas.getContext("2d")!;
  const CW = canvas.width  / SCALE;
  const CH = canvas.height / SCALE;

  // ── Coordinate projection — use poles only as source of truth ──────────
  const allCoords: [number, number][] = layers.flatMap(l => l.poles);
  if (allCoords.length === 0) return;

  const lats = allCoords.map(c => c[0]);
  const lngs = allCoords.map(c => c[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const cos = Math.cos((midLat * Math.PI) / 180); // lng correction

  // Project to a flat cartesian plane (correct aspect ratio for small areas)
  const toFlat = (lat: number, lng: number) => ({
    x: (lng - minLng) * cos,
    y: -(lat - minLat),           // flip so north = up
  });

  const flatAll = allCoords.map(([la, ln]) => toFlat(la, ln));
  const fxArr  = flatAll.map(f => f.x);
  const fyArr  = flatAll.map(f => f.y);
  const minFX  = Math.min(...fxArr), maxFX = Math.max(...fxArr);
  const minFY  = Math.min(...fyArr), maxFY = Math.max(...fyArr);
  const dFX = (maxFX - minFX) || 0.0001;
  const dFY = (maxFY - minFY) || 0.0001;

  const PAD  = 0.14; // 14% padding each side
  const useW = CW * (1 - 2 * PAD);
  const useH = CH * (1 - 2 * PAD);

  // Uniform scale: fit the larger dimension
  const s = Math.min(useW / dFX, useH / dFY);

  // Centre the drawing
  const drawW  = dFX * s;
  const drawH  = dFY * s;
  const baseX  = (CW - drawW) / 2 - minFX * s;
  const baseY  = (CH - drawH) / 2 - minFY * s;

  const project = (lat: number, lng: number): [number, number] => {
    const f = toFlat(lat, lng);
    return [f.x * s + baseX, f.y * s + baseY];
  };

  // ── Background ───────────────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CW, CH);

  // Subtle dot grid
  ctx.fillStyle = "#e2e8f0";
  for (let gx = 20; gx < CW; gx += 24) {
    for (let gy = 20; gy < CH; gy += 24) {
      ctx.beginPath();
      ctx.arc(gx, gy, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Draw layers — everything derived from poles only ─────────────────────
  // Pass 1: network lines + distance labels (drawn under poles)
  layers.forEach(layer => {
    if (layer.poles.length < 2) return;
    const isExisting = layer.statusJaringan === "Existing";
    const lineColor  = isExisting ? "#374151" : "#2563eb";

    const pts = layer.poles.map(([la, ln]) => project(la, ln));

    // Road glow (soft halo under network line for road feel)
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.strokeStyle = isExisting ? "#9ca3af" : "#93c5fd";
    ctx.lineWidth   = 12;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.globalAlpha = 0.22;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Network line
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.setLineDash(isExisting ? [] : [10, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Distance labels (perpendicular offset from segment midpoint)
    ctx.font = "bold 7.5px Arial, sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dist  = haversineMeters(layer.poles[i][0], layer.poles[i][1], layer.poles[i+1][0], layer.poles[i+1][1]);
      const label = `${Math.round(dist)} m`;

      // Place label perpendicular-offset above the segment
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const ox = -Math.sin(angle) * 12;
      const oy =  Math.cos(angle) * 12;
      const lx = mx + ox;
      const ly = my + oy;

      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.fillRect(lx - tw / 2 - 2, ly - 7.5, tw + 4, 11);
      ctx.fillStyle = lineColor;
      ctx.fillText(label, lx, ly + 1.5);
    }
  });

  // Pass 2: pole circles + construction labels (on top of lines)
  layers.forEach(layer => {
    const isExisting = layer.statusJaringan === "Existing";
    const poleStroke = isExisting ? "#374151" : "#1e40af";

    layer.poles.forEach(([la, ln], idx) => {
      const [px, py] = project(la, ln);
      const pt    = layer.poleTypes[idx];
      const type  = pt?.short || "A1";
      const color = TYPE_COLOR[type] ?? "#374151";

      // Drop shadow
      ctx.beginPath();
      ctx.arc(px + 0.5, py + 0.8, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fill();

      // Circle
      ctx.beginPath();
      ctx.arc(px, py, 6.5, 0, Math.PI * 2);
      ctx.fillStyle   = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = poleStroke;
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Inner dot for A3-type poles
      if (type.startsWith("A3") || type === "2xA3") {
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // Construction label
      ctx.font      = "bold 7px Arial, sans-serif";
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.fillText(type, px, py + 17);
    });
  });

  // ── Legend (bottom-left) ─────────────────────────────────────────────────
  const lx = 10, ly = CH - 38;
  ctx.fillStyle = "rgba(255,255,255,0.90)";
  ctx.beginPath();
  ctx.roundRect(lx, ly, 130, 32, 4);
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  const legendItems = [
    { dash: false, color: "#374151", label: "Jaringan Existing" },
    { dash: true,  color: "#2563eb", label: "Jaringan Perluasan" },
  ];
  ctx.font = "10px Arial, sans-serif";
  legendItems.forEach(({ dash, color, label }, i) => {
    const iy = ly + 11 + i * 14;
    ctx.beginPath();
    ctx.setLineDash(dash ? [5, 3] : []);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.moveTo(lx + 6,  iy);
    ctx.lineTo(lx + 24, iy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#374151";
    ctx.fillText(label, lx + 28, iy + 3.5);
  });
}

// ── Main export function ───────────────────────────────────────────────────

export async function exportToPdf(opts: ExportPdfOptions): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  const {
    projectTitle, layers,
    poles, poleData, effectiveSchoors, gardus,
    jenisJaringan, statusJaringan, totalLengthM,
    tinggiTiang, materialTiang, jarakGawang, kondukturUkuran,
    activeBranchCount, savedLayerStats,
  } = opts;

  // ── Build stats ────────────────────────────────────────────────────────────
  const hasDraft = poles.length > 0;

  const draftKonstruksi: Record<string, number> = {};
  poleData.forEach(pd => {
    const k =
      jenisJaringan.includes("SKUTR") || jenisJaringan.includes("Underbuild") ? pd.jtrTypeShort
      : jenisJaringan === "SKUTM" ? pd.skutmTypeShort
      : jenisJaringan === "SKTM" || jenisJaringan === "SKTR" ? pd.kabelTypeShort
      : pd.jtmTypeShort;
    const key = k || "—";
    draftKonstruksi[key] = (draftKonstruksi[key] ?? 0) + 1;
  });

  const allKonstruksi: Record<string, number> = { ...draftKonstruksi };
  savedLayerStats.forEach(l =>
    Object.entries(l.konstruksiTypes).forEach(([k, { count }]) => {
      allKonstruksi[k] = (allKonstruksi[k] ?? 0) + count;
    })
  );

  const allStats: LayerStat[] = [
    ...(hasDraft ? [{
      id: -1, label: "Draft Aktif",
      jenisJaringan, statusJaringan,
      polesCount: poles.length - activeBranchCount, lengthM: totalLengthM,
      schoors: {
        treck:      Object.values(effectiveSchoors).filter(s => s.jenis === "Treck").length,
        druck:      Object.values(effectiveSchoors).filter(s => s.jenis === "Druck").length,
        kontramast: Object.values(effectiveSchoors).filter(s => s.jenis === "Kontramast").length,
        total:      Object.keys(effectiveSchoors).length,
      },
      garduCount: Object.keys(gardus).length,
      kondukturUkuran, tinggiTiang, materialTiang,
      konstruksiTypes: Object.fromEntries(
        Object.entries(draftKonstruksi).map(([k, count]) => [k, { long: KONSTRUKSI_LABEL[k] ?? k, count }])
      ),
    } as LayerStat] : []),
    ...savedLayerStats,
  ];

  const totalPoles      = allStats.reduce((s, l) => s + l.polesCount, 0);
  const totalLength     = allStats.reduce((s, l) => s + l.lengthM,    0);
  const totalTreck      = allStats.reduce((s, l) => s + l.schoors.treck,      0);
  const totalDruck      = allStats.reduce((s, l) => s + l.schoors.druck,      0);
  const totalKontramast = allStats.reduce((s, l) => s + l.schoors.kontramast, 0);
  const totalGardu      = allStats.reduce((s, l) => s + l.garduCount,         0);
  const arresterCount   = poleData.filter(pd => pd.isGrounded).length;
  const firstStat       = allStats[0];

  // ── Draw schematic to canvas ───────────────────────────────────────────────
  const PW = 297, PH = 210, RP = 88, MW = PW - RP;
  const SCALE = 3; // px per mm

  const canvas   = document.createElement("canvas");
  canvas.width   = MW * SCALE;
  canvas.height  = PH * SCALE;
  canvas.getContext("2d")!.scale(SCALE, SCALE);
  drawSchematic(canvas, layers, SCALE);
  const imgData  = canvas.toDataURL("image/jpeg", 0.95);

  // ── PDF setup ──────────────────────────────────────────────────────────────
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  pdf.addImage(imgData, "JPEG", 0, 0, MW, PH);
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.3);
  pdf.rect(0, 0, MW, PH);

  // Right panel background
  const rx = MW;
  pdf.setFillColor(248, 250, 255);
  pdf.rect(rx, 0, RP, PH, "F");

  let y = 0;

  // ── PLN Header ────────────────────────────────────────────────────────────
  pdf.setFillColor(15, 40, 100);
  pdf.rect(rx, y, RP, 18, "F");
  pdf.setFillColor(59, 130, 246);
  pdf.rect(rx, y, RP, 1.2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("PT. PLN (PERSERO)", rx + RP / 2, y + 6.5, { align: "center" });
  pdf.setFontSize(6.5);
  pdf.text("UIW NTT  ·  UP3 KUPANG  ·  ULP KUPANG", rx + RP / 2, y + 11.5, { align: "center" });
  pdf.setFontSize(5);
  pdf.setTextColor(147, 197, 253);
  pdf.text("SPARK — Sistem Pemetaan Pintar Rencana Kelistrikan", rx + RP / 2, y + 16, { align: "center" });
  y += 18;

  // ── Project Title ─────────────────────────────────────────────────────────
  pdf.setFillColor(235, 242, 255);
  pdf.rect(rx, y, RP, 20, "F");
  pdf.setFillColor(59, 130, 246);
  pdf.rect(rx, y, 1.5, 20, "F");
  pdf.setTextColor(20, 40, 100);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  const titleLines = pdf.splitTextToSize(projectTitle.toUpperCase(), RP - 8);
  pdf.text(titleLines, rx + RP / 2, y + 7 + Math.max(0, (2 - titleLines.length) * 3), { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5.5);
  pdf.setTextColor(80, 100, 160);
  pdf.text(`${jenisJaringan}  ·  ${statusJaringan}`, rx + RP / 2, y + 17, { align: "center" });
  y += 20;

  // ── Signer Block ──────────────────────────────────────────────────────────
  const SH = 9;
  ["Disurvey / Digambar", "Diperiksa", "Disetujui"].forEach((label, i) => {
    const sy = y + i * SH;
    pdf.setFillColor(i % 2 === 0 ? 250 : 245, 248, 255);
    pdf.rect(rx, sy, RP, SH, "F");
    pdf.setDrawColor(210, 220, 240);
    pdf.setLineWidth(0.2);
    pdf.line(rx, sy + SH, rx + RP, sy + SH);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.5);
    pdf.setTextColor(80, 90, 130);
    pdf.text(label, rx + 4, sy + 5.5);
    pdf.setTextColor(180, 190, 210);
    pdf.text(":  ............................................", rx + 28, sy + 5.5);
  });
  y += 3 * SH;

  // ── Drawing Info ──────────────────────────────────────────────────────────
  pdf.setFillColor(220, 232, 255);
  pdf.rect(rx, y, RP, 9, "F");
  pdf.setDrawColor(180, 200, 240);
  pdf.setLineWidth(0.3);
  pdf.line(rx, y + 9, rx + RP, y + 9);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.5);
  pdf.setTextColor(30, 50, 110);
  const dateStr = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  pdf.text(`Tanggal : ${dateStr}`, rx + 3, y + 4);
  pdf.text(`Ukuran : A4       Gambar : 1/1`, rx + 3, y + 8);
  y += 9;

  // ── BOM Table ─────────────────────────────────────────────────────────────
  const C_SIM   = rx + 1, C_SIM_W = 14;
  const C_UAI   = rx + C_SIM_W + 1, C_UAI_W = RP - C_SIM_W - 18;
  const C_VOL   = rx + RP - 17, C_VOL_W = 10;
  const C_SAT   = rx + RP - 7;

  pdf.setFillColor(15, 40, 100);
  pdf.rect(rx, y, RP, 7, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.5);
  pdf.text("SIMBOL",           C_SIM + C_SIM_W / 2, y + 4.5, { align: "center" });
  pdf.text("U  R  A  I  A  N", C_UAI + C_UAI_W / 2, y + 4.5, { align: "center" });
  pdf.text("VOL",              C_VOL + C_VOL_W / 2, y + 4.5, { align: "center" });
  pdf.text("SAT",              C_SAT + 2.5,          y + 4.5, { align: "center" });
  y += 7;

  interface BomRow { simbol: string; uraian: string; vol: string; sat: string; bold?: boolean }
  const rows: BomRow[] = [];

  rows.push({ simbol: "●", uraian: `Tiang ${firstStat?.materialTiang ?? "Beton"} ${firstStat?.tinggiTiang ?? 12}m`, vol: `${totalPoles}`, sat: "BTG" });

  const existingLen = savedLayerStats.filter(l => l.statusJaringan === "Existing").reduce((s, l) => s + l.lengthM, 0);
  if (existingLen > 0) rows.push({ simbol: "——", uraian: `${jenisJaringan} Existing`, vol: "-", sat: "KMS" });

  const newLen = allStats.filter(l => l.statusJaringan !== "Existing").reduce((s, l) => s + l.lengthM, 0);
  if (newLen > 0) {
    rows.push({ simbol: "- -", uraian: `Ren. ${jenisJaringan} ${CONDUCTOR_TIPE[jenisJaringan] ?? "AAACS"} ${firstStat?.kondukturUkuran ?? kondukturUkuran}mm`, vol: `${(newLen / 1000).toFixed(3)}`, sat: "KMS" });
  }
  if (existingLen > 0 && newLen > 0) {
    rows.push({ simbol: "", uraian: "Total Panjang Jaringan", vol: `${(totalLength / 1000).toFixed(3)}`, sat: "KMS", bold: true });
  }

  KONSTRUKSI_ORDER.forEach(k => {
    if (allKonstruksi[k]) rows.push({ simbol: k, uraian: KONSTRUKSI_LABEL[k] ?? k, vol: `${allKonstruksi[k]}`, sat: "SET" });
  });

  if (totalTreck > 0)      rows.push({ simbol: "O→",  uraian: "Treck Skoor",             vol: `${totalTreck}`,      sat: "SET" });
  if (totalDruck > 0)      rows.push({ simbol: "O+",  uraian: "Druck Skoor",             vol: `${totalDruck}`,      sat: "SET" });
  if (totalKontramast > 0) rows.push({ simbol: "—O→", uraian: "Kontramast",              vol: `${totalKontramast}`, sat: "SET" });
  if (arresterCount > 0)   rows.push({ simbol: "⚡",  uraian: "Lightning Arrester (LA)", vol: `${arresterCount}`,   sat: "SET" });
  if (totalGardu > 0)      rows.push({ simbol: "🏗",  uraian: "Gardu Distribusi",        vol: `${totalGardu}`,      sat: "SET" });

  const tableTop = y;
  const ROW_H    = 5.8;
  rows.forEach((row, i) => {
    const ry = y + i * ROW_H;
    if (ry + ROW_H > PH - 1) return;
    pdf.setFillColor(i % 2 === 0 ? 248 : 255, 250, 255);
    pdf.rect(rx, ry, RP, ROW_H, "F");
    pdf.setDrawColor(215, 225, 245);
    pdf.setLineWidth(0.15);
    pdf.line(rx, ry + ROW_H, rx + RP, ry + ROW_H);
    pdf.setFont("helvetica", row.bold ? "bold" : "normal");
    pdf.setFontSize(5.2);
    pdf.setTextColor(40, 50, 90);
    pdf.text(row.simbol, C_SIM + C_SIM_W / 2, ry + 4, { align: "center" });
    pdf.text(pdf.splitTextToSize(row.uraian, C_UAI_W - 1)[0], C_UAI, ry + 4);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(row.bold ? 20 : 40, 50, 100);
    pdf.text(row.vol, C_VOL + C_VOL_W, ry + 4, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 110, 140);
    pdf.text(row.sat, C_SAT + 2.5, ry + 4, { align: "center" });
  });

  // Column dividers
  const tableBottom = Math.min(y + rows.length * ROW_H, PH - 1);
  pdf.setDrawColor(180, 200, 230);
  pdf.setLineWidth(0.2);
  pdf.line(C_UAI - 1, tableTop - 7, C_UAI - 1, tableBottom);
  pdf.line(C_VOL - 1, tableTop - 7, C_VOL - 1, tableBottom);
  pdf.line(C_SAT - 1, tableTop - 7, C_SAT - 1, tableBottom);

  pdf.setDrawColor(0, 20, 80);
  pdf.setLineWidth(0.5);
  pdf.rect(rx, 0, RP, PH);
  pdf.setLineWidth(0.8);
  pdf.rect(0, 0, PW, PH);

  pdf.save(`SPARK_${projectTitle.replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_")}.pdf`);
}
