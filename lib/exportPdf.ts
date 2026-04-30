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
  "BDL+DE":   "Bundle End Protection",
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
  // latlng → container pixel (from mapRef.current.latLngToContainerPoint)
  latLngToPoint: (latlng: [number, number]) => { x: number; y: number };
  // all poles to draw (active + all saved layers)
  allPoles: [number, number][];
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

// ── Manual Leaflet map capture (no html2canvas — avoids oklch CSS parse error) ──
async function captureLeafletMap(
  mapEl: HTMLElement,
  latLngToPoint: (latlng: [number, number]) => { x: number; y: number },
  allPoles: [number, number][],
): Promise<string> {
  const mapRect = mapEl.getBoundingClientRect();
  const W = Math.round(mapRect.width);
  const H = Math.round(mapRect.height);
  const SCALE = 2;

  const canvas = document.createElement("canvas");
  canvas.width  = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  // Light map background
  ctx.fillStyle = "#e8eaed";
  ctx.fillRect(0, 0, W, H);

  // ── 1. Tile images via fetch (avoids tainted-canvas CORS issue) ─────────
  const tiles = Array.from(
    mapEl.querySelectorAll<HTMLImageElement>(".leaflet-tile:not(.leaflet-tile-loading)")
  ).filter(t => t.src && t.complete && t.naturalWidth > 0);

  await Promise.all(tiles.map(async tile => {
    const tRect = tile.getBoundingClientRect();
    const x = tRect.left - mapRect.left;
    const y = tRect.top  - mapRect.top;
    const w = tRect.width;
    const h = tRect.height;
    try {
      const res  = await fetch(tile.src, { mode: "cors" });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload  = () => { try { ctx.drawImage(img, x, y, w, h); } catch {} URL.revokeObjectURL(url); resolve(); };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        img.src = url;
      });
    } catch { /* tile unreachable — skip */ }
  }));

  // ── 2. Leaflet SVG overlay (polylines, schoor SVGs, etc.) ──────────────
  const svgEl = mapEl.querySelector<SVGSVGElement>(".leaflet-overlay-pane > svg");
  if (svgEl) {
    const svgRect = svgEl.getBoundingClientRect();
    const ox = svgRect.left - mapRect.left;
    const oy = svgRect.top  - mapRect.top;

    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width",  String(svgRect.width));
    clone.setAttribute("height", String(svgRect.height));

    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob   = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url    = URL.createObjectURL(blob);

    await new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => {
        try { ctx.drawImage(img, ox, oy, svgRect.width, svgRect.height); } catch {}
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    });
  }

  // ── 3. Pole circles (HTML divIcon markers — not in SVG, drawn manually) ─
  allPoles.forEach(latlng => {
    const pt = latLngToPoint(latlng);
    if (pt.x < -30 || pt.x > W + 30 || pt.y < -30 || pt.y > H + 30) return;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle   = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth   = 2;
    ctx.stroke();
  });

  // ── 4. Export ─────────────────────────────────────────────────────────
  return canvas.toDataURL("image/jpeg", 0.92);
}

export async function exportToPdf(opts: ExportPdfOptions): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  const {
    mapEl, projectTitle, latLngToPoint, allPoles,
    poles, poleData, effectiveSchoors, gardus,
    jenisJaringan, statusJaringan, totalLengthM,
    tinggiTiang, materialTiang, jarakGawang, kondukturUkuran,
    activeBranchCount, savedLayerStats,
  } = opts;

  // ── Build stats ────────────────────────────────────────────────────────────
  const hasDraft = poles.length > 0;
  const draftKonstruksi: Record<string, number> = {};
  poleData.forEach(pd => {
    const { short } = getTypeFields(pd, jenisJaringan);
    const k = short || "—";
    draftKonstruksi[k] = (draftKonstruksi[k] ?? 0) + 1;
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
        treck:     Object.values(effectiveSchoors).filter(s => s.jenis === "Treck").length,
        druck:     Object.values(effectiveSchoors).filter(s => s.jenis === "Druck").length,
        kontramast:Object.values(effectiveSchoors).filter(s => s.jenis === "Kontramast").length,
        total:     Object.keys(effectiveSchoors).length,
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

  // ── Capture map (no html2canvas) ──────────────────────────────────────────
  const imgData = await captureLeafletMap(mapEl, latLngToPoint, allPoles);

  // ── PDF setup ──────────────────────────────────────────────────────────────
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const PW = 297;
  const PH = 210;
  const RP = 88;
  const MW = PW - RP;

  // Map
  pdf.addImage(imgData, "JPEG", 0, 0, MW, PH);
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  pdf.rect(0, 0, MW, PH);

  // Right panel background
  pdf.setFillColor(248, 250, 255);
  pdf.rect(MW, 0, RP, PH, "F");

  let y = 0;
  const rx = MW;

  // ── 1. PLN Header ─────────────────────────────────────────────────────────
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

  // ── 2. Project Title ──────────────────────────────────────────────────────
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

  // ── 3. Signer Block ───────────────────────────────────────────────────────
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

  // ── 4. Drawing Info ───────────────────────────────────────────────────────
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

  // ── 5. BOM / Uraian Table ─────────────────────────────────────────────────
  const C_SIM   = rx + 1;
  const C_SIM_W = 14;
  const C_UAI   = rx + C_SIM_W + 1;
  const C_UAI_W = RP - C_SIM_W - 18;
  const C_VOL   = rx + RP - 17;
  const C_VOL_W = 10;
  const C_SAT   = rx + RP - 7;

  // Table header
  pdf.setFillColor(15, 40, 100);
  pdf.rect(rx, y, RP, 7, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.5);
  pdf.text("SIMBOL",       C_SIM + C_SIM_W / 2, y + 4.5, { align: "center" });
  pdf.text("U  R  A  I  A  N", C_UAI + C_UAI_W / 2, y + 4.5, { align: "center" });
  pdf.text("VOL",          C_VOL + C_VOL_W / 2, y + 4.5, { align: "center" });
  pdf.text("SAT",          C_SAT + 2.5,          y + 4.5, { align: "center" });
  y += 7;

  // BOM rows
  interface BomRow { simbol: string; uraian: string; vol: string; sat: string; bold?: boolean }
  const rows: BomRow[] = [];

  rows.push({
    simbol: "●",
    uraian: `Tiang ${firstStat?.materialTiang ?? "Beton"} ${firstStat?.tinggiTiang ?? 12}m`,
    vol: `${totalPoles}`, sat: "BTG",
  });

  const existingLen = savedLayerStats.filter(l => l.statusJaringan === "Existing")
    .reduce((s, l) => s + l.lengthM, 0);
  if (existingLen > 0) {
    rows.push({ simbol: "——", uraian: `${jenisJaringan} Existing`, vol: "-", sat: "KMS" });
  }

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

  if (existingLen > 0 && newLen > 0) {
    rows.push({ simbol: "", uraian: "Total Panjang Jaringan", vol: `${(totalLength / 1000).toFixed(3)}`, sat: "KMS", bold: true });
  }

  KONSTRUKSI_ORDER.forEach(k => {
    if (allKonstruksi[k]) {
      rows.push({ simbol: k, uraian: KONSTRUKSI_LABEL[k] ?? k, vol: `${allKonstruksi[k]}`, sat: "SET" });
    }
  });

  if (totalTreck > 0)      rows.push({ simbol: "O→",  uraian: "Treck Skoor",              vol: `${totalTreck}`,      sat: "SET" });
  if (totalDruck > 0)      rows.push({ simbol: "O+",  uraian: "Druck Skoor",              vol: `${totalDruck}`,      sat: "SET" });
  if (totalKontramast > 0) rows.push({ simbol: "—O→", uraian: "Kontramast",               vol: `${totalKontramast}`, sat: "SET" });
  if (arresterCount > 0)   rows.push({ simbol: "⚡",  uraian: "Lightning Arrester (LA)",  vol: `${arresterCount}`,   sat: "SET" });
  if (totalGardu > 0)      rows.push({ simbol: "🏗",  uraian: "Gardu Distribusi",         vol: `${totalGardu}`,      sat: "SET" });

  const tableTop = y;
  const ROW_H = 5.8;

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

  // Outer borders
  pdf.setDrawColor(0, 20, 80);
  pdf.setLineWidth(0.5);
  pdf.rect(rx, 0, RP, PH);
  pdf.setLineWidth(0.8);
  pdf.rect(0, 0, PW, PH);

  const filename = `SPARK_${projectTitle.replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_")}.pdf`;
  pdf.save(filename);
}
