import JSZip from "jszip";
import type { RabSummary } from "./types";

/**
 * Mengupdate atau menyisipkan cell (F, G, atau H) pada baris XML tertentu.
 * Mempertahankan atribut style (s="..."), baris lain, formula, dan urutan kolom.
 */
function updateCellInRow(rowContent: string, col: string, rowNumber: number, value: number): string {
  const cellRef = `${col}${rowNumber}`;

  // Kasus 1: Self-closing tag yang sudah ada di template, misal: <c r="F21" s="535"/>
  const selfClosingRegex = new RegExp(`(<c\\s+[^>]*r="${cellRef}"[^>]*?)\\/>`);
  if (selfClosingRegex.test(rowContent)) {
    return rowContent.replace(selfClosingRegex, `$1><v>${value}</v></c>`);
  }

  // Kasus 2: Tag dengan isi, misal: <c r="F21" s="535">...</c>
  const openTagRegex = new RegExp(`(<c\\s+[^>]*r="${cellRef}"[^>]*>)([\\s\\S]*?)(<\\/c>)`);
  if (openTagRegex.test(rowContent)) {
    return rowContent.replace(openTagRegex, (_match, openTag, inner, closeTag) => {
      // Bersihkan nilai <v> lama jika ada
      const cleanInner = inner.replace(/<v>[\s\S]*?<\/v>/g, "");
      return `${openTag}${cleanInner}<v>${value}</v>${closeTag}`;
    });
  }

  // Kasus 3: Cell belum ada di baris tersebut, sisipkan sesuai urutan abjad kolom
  const colOrder = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
  const targetColIdx = colOrder.indexOf(col);

  const cellRegex = /<c\s+[^>]*r="([A-Z]+)\d+"[^>]*>[\s\S]*?<\/c>|<c\s+[^>]*r="([A-Z]+)\d+"[^>]*\/>/g;
  let insertPos = -1;
  let cm: RegExpExecArray | null;
  while ((cm = cellRegex.exec(rowContent)) !== null) {
    const existingCol = cm[1] || cm[2];
    const existingIdx = colOrder.indexOf(existingCol);
    if (existingIdx > targetColIdx) {
      insertPos = cm.index;
      break;
    }
  }

  const newCellXml = `<c r="${cellRef}"><v>${value}</v></c>`;
  if (insertPos !== -1) {
    return rowContent.slice(0, insertPos) + newCellXml + rowContent.slice(insertPos);
  } else {
    return rowContent + newCellXml;
  }
}

/**
 * Mengisi volume ke template Excel RAB KHS PLN UP3 Kupang asli via manipulasi XML langsung (JSZip).
 * 
 * KEUNGGULAN UTAMA:
 * - 100% Preservasi Gambar/Logo: File xl/drawings/* dan xl/media/* sama sekali tidak diproses ulang,
 *   sehingga logo PLN, gambar header, dan group shapes tidak akan berubah ukuran, meregang, atau bergeser.
 * - 100% Preservasi Seluruh 15 Sheet & Formula: Modifikasi HANYA cell F{row}, G{row}, H{row} pada XML sheet "RAB Pasang".
 * - Otomatis Full Recalculate Saat Dibuka: Mengaktifkan fullCalcOnLoad="1" pada <calcPr> tanpa mengubah
 *   calcMode="manual" asli template PLN, dan membersihkan calcChain.xml lama agar Excel/WPS menghitung ulang
 *   seluruh rumus (kolom I, L, M, N, dan sheet REKAP) secara presisi tanpa perlu Ctrl+Alt+F9 manual.
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

  console.log(`[exportRabToExcel] Membaca file template via JSZip (${templateBuffer.byteLength} bytes)...`);
  const zip = await JSZip.loadAsync(templateBuffer);

  // ─── 1. Baca xl/workbook.xml untuk mencari sheet "RAB Pasang" ─────────────────
  const wbXml = await zip.file("xl/workbook.xml")?.async("text");
  if (!wbXml) {
    throw new Error("File yang diunggah bukan file Excel (.xlsx) yang valid (xl/workbook.xml tidak ditemukan).");
  }
  const sheetRegex = /<sheet\s+[^>]*name="([^"]+)"[^>]*sheetId="([^"]+)"[^>]*r:id="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  const sheetList: { name: string; sheetId: string; rId: string }[] = [];
  while ((m = sheetRegex.exec(wbXml)) !== null) {
    sheetList.push({ name: m[1], sheetId: m[2], rId: m[3] });
  }

  console.log(`[exportRabToExcel] Berhasil memuat ${sheetList.length} sheet:`, sheetList.map(s => s.name));

  const targetSheet = sheetList.find(s => s.name.trim().toLowerCase() === "rab pasang");
  if (!targetSheet) {
    const isSingleExported = sheetList.length === 1 && (sheetList[0].name.toLowerCase().includes("rab") || sheetList[0].name.toLowerCase().includes("khs"));
    if (isSingleExported) {
      throw new Error(
        `File yang Anda upload ("${sheetList[0].name}") adalah file hasil ekspor sebelumnya (hanya 1 sheet). Harap upload file MASTER template asli: "Template_RAB_KHS_2026_UP3_Kupang.xlsx" (yang memiliki 15 sheet lengkap, termasuk sheet "RAB Pasang").`
      );
    }
    const existingList = sheetList.slice(0, 5).map(s => `"${s.name}"`).join(", ");
    throw new Error(
      `Sheet "RAB Pasang" tidak ditemukan di dalam template (${sheetList.length} sheet terbaca: ${existingList}...). Pastikan mengunggah file template asli Template_RAB_KHS_2026_UP3_Kupang.xlsx.`
    );
  }

  // ─── 2. Baca xl/_rels/workbook.xml.rels untuk mencari path file sheet "RAB Pasang" ─
  let relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  if (!relsXml) {
    throw new Error("File relasi workbook (xl/_rels/workbook.xml.rels) tidak ditemukan.");
  }

  const relRegex = new RegExp(`<Relationship\\s+[^>]*Id="${targetSheet.rId}"[^>]*Target="([^"]+)"`, "i");
  const relMatch = relsXml.match(relRegex);
  if (!relMatch) {
    throw new Error(`Target file worksheet untuk "${targetSheet.name}" tidak ditemukan di workbook.xml.rels.`);
  }

  const sheetPath = "xl/" + relMatch[1].replace(/^\//, "");
  let sheetXml = await zip.file(sheetPath)?.async("text");
  if (!sheetXml) {
    throw new Error(`File worksheet XML "${sheetPath}" tidak ditemukan di dalam arsip template.`);
  }

  console.log(`[exportRabToExcel] Mengisi volume ke sheet "${targetSheet.name}" (${sheetPath})...`);

  // ─── 4. Kelompokkan update per baris agar efisien ─────────────────────────
  const updatesByRow = new Map<number, { f?: number; g?: number; h?: number }>();
  for (const item of rabSummary.items) {
    const current = updatesByRow.get(item.row) || {};
    if (item.volJtm > 0) current.f = item.volJtm;
    if (item.volGardu > 0) current.g = item.volGardu;
    if (item.volJtr > 0) current.h = item.volJtr;
    if (current.f !== undefined || current.g !== undefined || current.h !== undefined) {
      updatesByRow.set(item.row, current);
    }
  }

  // ─── 5. Update XML baris-baris pada sheetData ──────────────────────────────
  let filledCellsCount = 0;
  for (const [rowNum, vals] of updatesByRow.entries()) {
    const rowRegex = new RegExp(`(<row\\s+[^>]*r="${rowNum}"[^>]*>)([\\s\\S]*?)(<\\/row>)`);
    if (rowRegex.test(sheetXml)) {
      sheetXml = sheetXml.replace(rowRegex, (_match, openRow, inner, closeRow) => {
        let updated = inner;
        if (vals.f !== undefined) { updated = updateCellInRow(updated, "F", rowNum, vals.f); filledCellsCount++; }
        if (vals.g !== undefined) { updated = updateCellInRow(updated, "G", rowNum, vals.g); filledCellsCount++; }
        if (vals.h !== undefined) { updated = updateCellInRow(updated, "H", rowNum, vals.h); filledCellsCount++; }
        return `${openRow}${updated}${closeRow}`;
      });
    }
  }

  // Perbarui file XML worksheet di dalam zip (semua file drawing, media, sheet lain TETAP 100% ASLI)
  zip.file(sheetPath, sheetXml);

  // ─── Update workbook.xml: Pastikan fullCalcOnLoad="1" (Pertahankan calcMode="manual") ─
  let updatedWbXml = (await zip.file("xl/workbook.xml")?.async("text")) || "";
  if (updatedWbXml) {
    if (updatedWbXml.includes('<calcPr calcId="191029" calcMode="manual"/>')) {
      updatedWbXml = updatedWbXml.replace(
        '<calcPr calcId="191029" calcMode="manual"/>',
        '<calcPr calcId="191029" calcMode="manual" fullCalcOnLoad="1"/>'
      );
    } else if (/<calcPr[\s>]/i.test(updatedWbXml)) {
      updatedWbXml = updatedWbXml.replace(/<calcPr(\s+[^>]*?)?(\/?)>/i, (_match, attrs = "") => {
        let cleanAttrs = (attrs || "").replace(/\/$/, "").trim();
        if (/fullCalcOnLoad="[^"]*"/i.test(cleanAttrs)) {
          cleanAttrs = cleanAttrs.replace(/fullCalcOnLoad="[^"]*"/i, 'fullCalcOnLoad="1"');
        } else {
          cleanAttrs = `${cleanAttrs} fullCalcOnLoad="1"`;
        }
        return `<calcPr ${cleanAttrs}/>`;
      });
    } else {
      updatedWbXml = updatedWbXml.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
    }
    zip.file("xl/workbook.xml", updatedWbXml);
  }

  // ─── Hapus stale xl/calcChain.xml & referensinya agar Excel membangun ulang urutan kalkulasi ─
  zip.remove("xl/calcChain.xml");

  if (relsXml) {
    relsXml = relsXml.replace(/<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/gi, "");
    relsXml = relsXml.replace(/<Relationship[^>]*Type="[^"]*\/calcChain"[^>]*\/>/gi, "");
    zip.file("xl/_rels/workbook.xml.rels", relsXml);
  }

  let ctXml = await zip.file("[Content_Types].xml")?.async("text");
  if (ctXml) {
    ctXml = ctXml.replace(/<Override[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/gi, "");
    zip.file("[Content_Types].xml", ctXml);
  }

  const outBuffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  console.log(`[exportRabToExcel] File Excel berhasil digenerate (${outBuffer.byteLength} bytes, fullCalcOnLoad aktif, logo & gambar 100% utuh).`);

  return new Blob([outBuffer as unknown as BlobPart], {
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
