import type { LayerStat } from "../components/modals/RekapModal";
import type { PoleData, SchoorConfig, GarduConfig } from "../types/spark";

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
  "BDL+DE":    "Bundle End Protection",
  "Trm":       "Termination Assy",
  "2xTrm":     "2x Termination Assy",
  "JNT":       "Joint Sleeve",
};

const KONSTRUKSI_ORDER = [
  "A3 Pole","A3 Branch","A3","2xA3","A2","A1","S","LA","FDE","BDL+DE","Trm","2xTrm","JNT",
];

function getTypeFields(pd: PoleData, jenis: string): { short: string } {
  if (jenis.includes("SKUTR") || jenis.includes("Underbuild")) return { short: pd.jtrTypeShort };
  if (jenis === "SKUTM") return { short: pd.skutmTypeShort };
  if (jenis === "SKTM" || jenis === "SKTR") return { short: pd.kabelTypeShort };
  return { short: pd.jtmTypeShort };
}

export interface ExportPdfOptions {
  mapEl: HTMLElement;
  projectTitle: string;
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

export async function exportToPdf(opts: ExportPdfOptions): Promise<void> {
  // Dynamic imports — avoid SSR issues with browser-only libs
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const {
    mapEl, projectTitle,
    poles, poleData, effectiveSchoors, gardus,
    jenisJaringan, statusJaringan, totalLengthM,
    tinggiTiang, materialTiang, jarakGawang, kondukturUkuran,
    activeBranchCount, savedLayerStats,
  } = opts;

  // ── Build draftStat ──────────────────────────────────────────────────────
  const hasDraft = poles.length > 0;
  const draftKonstruksi: Record<string, number> = {};
  poleData.forEach(pd => {
    const { short } = getTypeFields(pd, jenisJaringan);
    const k = short || "—";
    draftKonstruksi[k] = (draftKonstruksi[k] ?? 0) + 1;
  });

  // Merge konstruksi across all layers
  const allKonstruksi: Record<string, number> = { ...draftKonstruksi };
  savedLayerStats.forEach(l => {
    Object.entries(l.konstruksiTypes).forEach(([k, { count }]) => {
      allKonstruksi[k] = (allKonstruksi[k] ?? 0) + count;
    });
  });

  const allStats: LayerStat[] = [
    ...(hasDraft ? [{
      id: -1, label: "Draft Aktif",
      jenisJaringan, statusJaringan,
      polesCount: poles.length - activeBranchCount, lengthM: totalLengthM,
      schoors: {
        treck: Object.values(effectiveSchoors).filter(s => s.jenis === "Treck").length,
        druck: Object.values(effectiveSchoors).filter(s => s.jenis === "Druck").length,
        kontramast: Object.values(effectiveSchoors).filter(s => s.jenis === "Kontramast").length,
        total: Object.keys(effectiveSchoors).length,
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

  // ── Capture map ──────────────────────────────────────────────────────────
  // html2canvas cannot parse oklch/lab — strip them from cloned styles before render
  const canvas = await html2canvas(mapEl, {
    useCORS: true,
    allowTaint: true,
    scale: 2,
    logging: false,
    imageTimeout: 15000,
    onclone: (clonedDoc) => {
      clonedDoc.querySelectorAll("style").forEach(style => {
        if (!style.textContent) return;
        style.textContent = style.textContent
          .replace(/:\s*oklch\([^)]+\)/g, ": inherit")
          .replace(/:\s*\blab\([^)]+\)/g, ": inherit")
          .replace(/:\s*\blch\([^)]+\)/g, ": inherit")
          .replace(/:\s*oklab\([^)]+\)/g, ": inherit");
      });
    },
  });

  // ── PDF setup ─────────────────────────────────────────────────────────────
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const PW = 297; // page width
  const PH = 210; // page height
  const RP = 88;  // right panel width
  const MW = PW - RP; // map width

  // ── Map image ─────────────────────────────────────────────────────────────
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  pdf.addImage(imgData, "JPEG", 0, 0, MW, PH);

  // Subtle vignette border on map
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  pdf.rect(0, 0, MW, PH);

  // ── Right panel background ────────────────────────────────────────────────
  pdf.setFillColor(248, 250, 255);
  pdf.rect(MW, 0, RP, PH, "F");

  let y = 0;
  const rx = MW; // right panel left edge

  // ─────────────────────────────────────────────────────────────────────────
  // 1. PLN Header
  // ─────────────────────────────────────────────────────────────────────────
  pdf.setFillColor(15, 40, 100);
  pdf.rect(rx, y, RP, 18, "F");

  // Thin accent line at top
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

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Project Title
  // ─────────────────────────────────────────────────────────────────────────
  pdf.setFillColor(235, 242, 255);
  pdf.rect(rx, y, RP, 20, "F");
  pdf.setFillColor(59, 130, 246);
  pdf.rect(rx, y, 1.5, 20, "F"); // left accent bar

  pdf.setTextColor(20, 40, 100);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  const titleLines = pdf.splitTextToSize(projectTitle.toUpperCase(), RP - 8);
  const titleY = y + 7 + Math.max(0, (2 - titleLines.length) * 3);
  pdf.text(titleLines, rx + RP / 2, titleY, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5.5);
  pdf.setTextColor(80, 100, 160);
  pdf.text(`${jenisJaringan}  ·  ${statusJaringan}`, rx + RP / 2, y + 17, { align: "center" });
  y += 20;

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Signer Block
  // ─────────────────────────────────────────────────────────────────────────
  const signerRows = [
    "Disurvey / Digambar",
    "Diperiksa",
    "Disetujui",
  ];
  const SH = 9;

  signerRows.forEach((label, i) => {
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
  y += signerRows.length * SH;

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Drawing Info Strip
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // 5. BOM / Uraian Table
  // ─────────────────────────────────────────────────────────────────────────
  // Column x positions within right panel
  const C_SIMBOL = rx + 1;
  const C_SIMBOL_W = 14;
  const C_URAIAN = rx + C_SIMBOL_W + 1;
  const C_URAIAN_W = RP - C_SIMBOL_W - 18;
  const C_VOL = rx + RP - 17;
  const C_VOL_W = 10;
  const C_SAT = rx + RP - 7;

  // Table header
  pdf.setFillColor(15, 40, 100);
  pdf.rect(rx, y, RP, 7, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.5);
  pdf.text("SIMBOL", C_SIMBOL + C_SIMBOL_W / 2, y + 4.5, { align: "center" });
  pdf.text("U  R  A  I  A  N", C_URAIAN + C_URAIAN_W / 2, y + 4.5, { align: "center" });
  pdf.text("VOL", C_VOL + C_VOL_W / 2, y + 4.5, { align: "center" });
  pdf.text("SAT", C_SAT + 2.5, y + 4.5, { align: "center" });
  y += 7;

  // Column divider lines (draw over rows)
  const drawColDividers = (tableTop: number, tableBottom: number) => {
    pdf.setDrawColor(180, 200, 230);
    pdf.setLineWidth(0.2);
    pdf.line(C_URAIAN - 1, tableTop, C_URAIAN - 1, tableBottom);
    pdf.line(C_VOL - 1,    tableTop, C_VOL    - 1, tableBottom);
    pdf.line(C_SAT - 1,    tableTop, C_SAT    - 1, tableBottom);
  };

  // Build BOM rows
  interface BomRow { simbol: string; uraian: string; vol: string; sat: string; bold?: boolean }
  const rows: BomRow[] = [];

  // Tiang
  rows.push({
    simbol: "●",
    uraian: `Tiang ${firstStat?.materialTiang ?? "Beton"} ${firstStat?.tinggiTiang ?? 12}m`,
    vol: `${totalPoles}`, sat: "BTG",
  });

  // Existing line (if any existing layer)
  const existingLen = savedLayerStats.filter(l => l.statusJaringan === "Existing")
    .reduce((s, l) => s + l.lengthM, 0);
  if (existingLen > 0) {
    rows.push({
      simbol: "——", uraian: `${jenisJaringan} Existing`, vol: "-", sat: "KMS",
    });
  }

  // New/Perluasan line
  const newLen = allStats.filter(l => l.statusJaringan !== "Existing").reduce((s, l) => s + l.lengthM, 0);
  if (newLen > 0) {
    const cond = CONDUCTOR_TIPE[jenisJaringan] ?? "AAACS";
    const ukuran = firstStat?.kondukturUkuran ?? kondukturUkuran;
    rows.push({
      simbol: "- -",
      uraian: `Ren. ${jenisJaringan} ${cond} ${ukuran}mm`,
      vol: `${(newLen / 1000).toFixed(3)}`, sat: "KMS",
    });
  }

  // Total length (if mixed)
  if (existingLen > 0 && newLen > 0) {
    rows.push({
      simbol: "",
      uraian: `Total Panjang Jaringan`,
      vol: `${(totalLength / 1000).toFixed(3)}`, sat: "KMS", bold: true,
    });
  }

  // Construction types
  KONSTRUKSI_ORDER.forEach(k => {
    if (allKonstruksi[k]) {
      rows.push({ simbol: k, uraian: KONSTRUKSI_LABEL[k] ?? k, vol: `${allKonstruksi[k]}`, sat: "SET" });
    }
  });

  // Schoor
  if (totalTreck > 0)      rows.push({ simbol: "O→",  uraian: "Treck Skoor",  vol: `${totalTreck}`,      sat: "SET" });
  if (totalDruck > 0)      rows.push({ simbol: "O+",  uraian: "Druck Skoor",  vol: `${totalDruck}`,      sat: "SET" });
  if (totalKontramast > 0) rows.push({ simbol: "—O→", uraian: "Kontramast",   vol: `${totalKontramast}`, sat: "SET" });

  // Arrester
  if (arresterCount > 0) rows.push({ simbol: "⚡", uraian: "Lightning Arrester (LA)", vol: `${arresterCount}`, sat: "SET" });

  // Gardu
  if (totalGardu > 0) rows.push({ simbol: "🏗", uraian: "Gardu Distribusi", vol: `${totalGardu}`, sat: "SET" });

  const tableTop = y;
  const ROW_H = 5.8;

  rows.forEach((row, i) => {
    const ry = y + i * ROW_H;
    if (ry + ROW_H > PH - 1) return; // don't overflow page
    pdf.setFillColor(i % 2 === 0 ? 248 : 255, 250, 255);
    pdf.rect(rx, ry, RP, ROW_H, "F");
    pdf.setDrawColor(215, 225, 245);
    pdf.setLineWidth(0.15);
    pdf.line(rx, ry + ROW_H, rx + RP, ry + ROW_H);

    pdf.setFont("helvetica", row.bold ? "bold" : "normal");
    pdf.setFontSize(5.2);
    pdf.setTextColor(40, 50, 90);
    pdf.text(row.simbol, C_SIMBOL + C_SIMBOL_W / 2, ry + 4, { align: "center" });
    pdf.text(pdf.splitTextToSize(row.uraian, C_URAIAN_W - 1)[0], C_URAIAN, ry + 4);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(row.bold ? 20 : 40, 50, 100);
    pdf.text(row.vol, C_VOL + C_VOL_W, ry + 4, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 110, 140);
    pdf.text(row.sat, C_SAT + 2.5, ry + 4, { align: "center" });
  });

  const tableBottom = Math.min(y + rows.length * ROW_H, PH - 1);
  drawColDividers(tableTop - 7, tableBottom);

  // ── Outer borders ──────────────────────────────────────────────────────
  pdf.setDrawColor(0, 20, 80);
  pdf.setLineWidth(0.5);
  pdf.rect(rx, 0, RP, PH);
  pdf.setLineWidth(0.8);
  pdf.rect(0, 0, PW, PH); // page border

  // ── Save ──────────────────────────────────────────────────────────────
  const filename = `SPARK_${projectTitle.replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_")}.pdf`;
  pdf.save(filename);
}
