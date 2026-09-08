import ExcelJS from "exceljs";
import { RAB_KATALOG_REFERENSI } from "./rabCatalogData";
import type { RabSummary } from "./types";

/**
 * Mengisi volume ke template Excel RAB KHS PLN UP3 Kupang dengan preservasi formula penuh.
 * Jika templateBuffer diberikan (upload user), sistem memodifikasi langsung sheet template.
 * Jika templateBuffer null, sistem membuat workbook standar PLN yang sudah memiliki struktur formula.
 */
export async function exportRabToExcel(
  templateBuffer: ArrayBuffer | null,
  rabSummary: RabSummary,
  projectName: string = "SPARK_RAB"
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();

  if (templateBuffer && templateBuffer.byteLength > 0) {
    // ─── Mode 1: Modifikasi Template Upload Asli ────────────────────────────
    await workbook.xlsx.load(templateBuffer);

    // Cari worksheet RAB utama
    let worksheet = workbook.worksheets.find(ws => {
      const name = ws.name.toLowerCase();
      return name.includes("rab") || name.includes("khs") || name.includes("kupang") || name.includes("jaringan");
    });

    if (!worksheet) {
      worksheet = workbook.worksheets[0];
    }

    if (!worksheet) {
      throw new Error("Tidak dapat menemukan sheet RAB pada file Excel template.");
    }

    // Isi HANYA kolom F (JTM), G (Gardu), H (JTR) pada baris katalog yang cocok
    for (const item of rabSummary.items) {
      const row = worksheet.getRow(item.row);

      // Kolom F = 6 (JTM)
      if (item.volJtm > 0) {
        row.getCell(6).value = item.volJtm;
      }
      // Kolom G = 7 (Gardu)
      if (item.volGardu > 0) {
        row.getCell(7).value = item.volGardu;
      }
      // Kolom H = 8 (JTR)
      if (item.volJtr > 0) {
        row.getCell(8).value = item.volJtr;
      }
      row.commit();
    }
  } else {
    // ─── Mode 2: Generate Workbook Standar PLN Formula-Enabled ──────────────
    const worksheet = workbook.addWorksheet("RAB KHS UP3 KUPANG", {
      views: [{ showGridLines: true }],
    });

    // Judul Header
    worksheet.mergeCells("A2:I2");
    worksheet.getCell("A2").value = "RENCANA ANGGARAN BIAYA (RAB) KHS 2026";
    worksheet.getCell("A2").font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F172A" } };
    worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells("A3:I3");
    worksheet.getCell("A3").value = `PROYEK: ${projectName.toUpperCase()} - PLN UP3 KUPANG`;
    worksheet.getCell("A3").font = { name: "Arial", size: 11, bold: true, color: { argb: "FF2563EB" } };
    worksheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

    // Column widths
    worksheet.getColumn(1).width = 8;   // A: Row / No
    worksheet.getColumn(2).width = 56;  // B: Description
    worksheet.getColumn(3).width = 12;  // C: Satuan
    worksheet.getColumn(4).width = 24;  // D: Subsection
    worksheet.getColumn(5).width = 28;  // E: Section
    worksheet.getColumn(6).width = 14;  // F: Vol JTM
    worksheet.getColumn(7).width = 14;  // G: Vol Gardu
    worksheet.getColumn(8).width = 14;  // H: Vol JTR
    worksheet.getColumn(9).width = 16;  // I: Total Vol

    // Table Header baris 18 (sesuai template asli)
    const headerRow = worksheet.getRow(18);
    headerRow.values = [
      "NO ROW",
      "URAIAN MATERIAL / PEKERJAAN",
      "SATUAN",
      "SUBSEKTOR",
      "SEKSI",
      "VOL JTM (F)",
      "VOL GARDU (G)",
      "VOL JTR (H)",
      "TOTAL VOLUME",
    ];
    headerRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
    headerRow.height = 28;

    // Mapping cepat row -> item volume
    const volMap = new Map(rabSummary.items.map(it => [it.row, it]));

    // Buat baris 19 s/d 1055 dari katalog referensi
    for (const cat of RAB_KATALOG_REFERENSI) {
      const r = worksheet.getRow(cat.row);
      const vol = volMap.get(cat.row);

      r.getCell(1).value = cat.row;
      r.getCell(2).value = cat.description;
      r.getCell(3).value = cat.satuan;
      r.getCell(4).value = cat.subsection || "-";
      r.getCell(5).value = cat.section;

      // Hanya isi jika ada volume (jangan isi 0 jika kosong)
      if (vol && vol.volJtm > 0) r.getCell(6).value = vol.volJtm;
      if (vol && vol.volGardu > 0) r.getCell(7).value = vol.volGardu;
      if (vol && vol.volJtr > 0) r.getCell(8).value = vol.volJtr;

      // Formula total volume di Kolom I: =SUM(F{row}:H{row})
      r.getCell(9).value = { formula: `SUM(F${cat.row}:H${cat.row})` };

      // Styling
      r.font = { name: "Arial", size: 9 };
      r.getCell(1).alignment = { horizontal: "center" };
      r.getCell(3).alignment = { horizontal: "center" };
      r.getCell(6).alignment = { horizontal: "right" };
      r.getCell(7).alignment = { horizontal: "right" };
      r.getCell(8).alignment = { horizontal: "right" };
      r.getCell(9).alignment = { horizontal: "right" };

      if (vol && (vol.volJtm > 0 || vol.volGardu > 0 || vol.volJtr > 0)) {
        r.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0FDF4" }, // highlight soft green for filled rows
        };
      }
    }
  }

  const outBuffer = await workbook.xlsx.writeBuffer();
  return new Blob([outBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Helper untuk memicu unduhan file di browser.
 */
export function triggerExcelDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
