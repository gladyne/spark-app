import ExcelJS from "exceljs";
import type { RabSummary } from "./types";

/**
 * Mengisi volume ke template Excel RAB KHS PLN UP3 Kupang asli dengan preservasi formula penuh.
 * Memodifikasi HANYA cell F{row}, G{row}, H{row} pada sheet "RAB Pasang".
 * Semua 15 sheet, formula, style, dan struktur template asli tetap utuh 100%.
 */
export async function exportRabToExcel(
  templateBuffer: ArrayBuffer | null,
  rabSummary: RabSummary,
  projectName: string = "SPARK_RAB"
): Promise<Blob> {
  // ─── Validasi: Template Wajib Diunggah ────────────────────────────────────
  if (!templateBuffer || templateBuffer.byteLength === 0) {
    throw new Error(
      "File template RAB wajib diunggah. Silakan upload file Template_RAB_KHS_2026_UP3_Kupang.xlsx terlebih dahulu."
    );
  }

  const workbook = new ExcelJS.Workbook();
  console.log(`[exportRabToExcel] Membaca file template (${templateBuffer.byteLength} bytes)...`);
  await workbook.xlsx.load(templateBuffer);

  const sheetNames = workbook.worksheets.map(ws => ws.name);
  console.log(`[exportRabToExcel] Berhasil memuat ${workbook.worksheets.length} sheet:`, sheetNames);

  // ─── Cari Worksheet "RAB Pasang" ─────────────────────────────────────────
  let worksheet = workbook.getWorksheet("RAB Pasang");
  if (!worksheet) {
    worksheet = workbook.worksheets.find(ws => ws.name.trim().toLowerCase() === "rab pasang");
  }

  if (!worksheet) {
    const isSingleExported = sheetNames.length === 1 && (sheetNames[0].toLowerCase().includes("rab") || sheetNames[0].toLowerCase().includes("khs"));
    if (isSingleExported) {
      throw new Error(
        `File yang Anda upload ("${sheetNames[0]}") adalah file hasil ekspor sebelumnya (hanya 1 sheet). Harap upload file MASTER template asli: "Template_RAB_KHS_2026_UP3_Kupang.xlsx" (yang memiliki 15 sheet lengkap, termasuk sheet "RAB Pasang").`
      );
    }
    const existingList = sheetNames.slice(0, 5).map(s => `"${s}"`).join(", ");
    throw new Error(
      `Sheet "RAB Pasang" tidak ditemukan di dalam template (${workbook.worksheets.length} sheet terbaca: ${existingList}...). Pastikan mengunggah file template asli Template_RAB_KHS_2026_UP3_Kupang.xlsx.`
    );
  }

  console.log(`[exportRabToExcel] Mengisi volume ke sheet "${worksheet.name}"...`);

  // ─── Isi HANYA Kolom F (JTM), G (Gardu), H (JTR) pada Baris Spesifik ────
  let filledCellsCount = 0;
  for (const item of rabSummary.items) {
    // Kolom F: Volume JTM
    if (item.volJtm > 0) {
      worksheet.getCell(`F${item.row}`).value = item.volJtm;
      filledCellsCount++;
    }

    // Kolom G: Volume Gardu
    if (item.volGardu > 0) {
      worksheet.getCell(`G${item.row}`).value = item.volGardu;
      filledCellsCount++;
    }

    // Kolom H: Volume JTR
    if (item.volJtr > 0) {
      worksheet.getCell(`H${item.row}`).value = item.volJtr;
      filledCellsCount++;
    }
  }

  console.log(`[exportRabToExcel] Sukses mengupdate ${filledCellsCount} cell volume. Menulis workbook...`);

  const outBuffer = await workbook.xlsx.writeBuffer();
  console.log(`[exportRabToExcel] File Excel berhasil digenerate (${outBuffer.byteLength} bytes, ${workbook.worksheets.length} sheet tetap utuh).`);

  return new Blob([outBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Helper untuk memicu download file di browser.
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
