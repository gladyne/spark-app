import html2canvas from "html2canvas";

export interface ExportSurveyOptions {
  sheetElement: HTMLElement;
  docElement?: HTMLElement | null;
  orientation: "portrait" | "landscape";
  includeDokumentasi: boolean;
  projectName?: string;
}

/**
 * Melakukan export Lembar Gambar Survei UP3 Kupang resmi dalam ukuran A2.
 * Mendukung PDF Multi-halaman (Halaman Gambar + Halaman Dokumentasi) dan PNG resolusi tinggi.
 * Menggunakan skala render yang aman (scale: 1.5) untuk mencegah browser crash / out of memory.
 */
export async function exportSurveyToPdf({
  sheetElement,
  docElement,
  orientation,
  includeDokumentasi,
  projectName = "Gambar_Survei_UP3_Kupang",
}: ExportSurveyOptions): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  // Inisialisasi dokumen jsPDF ukuran A2
  const isLandscape = orientation === "landscape";
  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a2",
  });

  const pageW = isLandscape ? 594 : 420;
  const pageH = isLandscape ? 420 : 594;

  // Render Halaman 1 (Gambar Survei A2)
  const canvas1 = await html2canvas(sheetElement, {
    scale: 1.5,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const imgData1 = canvas1.toDataURL("image/jpeg", 0.95);
  pdf.addImage(imgData1, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");

  // Render Halaman 2 (Dokumentasi Lapangan Landscape A2) jika diaktifkan
  if (includeDokumentasi && docElement) {
    pdf.addPage("a2", "landscape");
    const canvas2 = await html2canvas(docElement, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData2 = canvas2.toDataURL("image/jpeg", 0.95);
    pdf.addImage(imgData2, "JPEG", 0, 0, 594, 420, undefined, "FAST");
  }

  // Simpan berkas PDF
  const cleanTitle = projectName.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
  const filename = `${cleanTitle || "Gambar_Survei"}_UP3_Kupang_A2_${Date.now()}.pdf`;
  pdf.save(filename);
}

/**
 * Melakukan export Lembar Gambar Survei A2 sebagai PNG resolusi tinggi.
 */
export async function exportSurveyToPng({
  sheetElement,
  projectName = "Gambar_Survei_UP3_Kupang",
}: {
  sheetElement: HTMLElement;
  projectName?: string;
}): Promise<void> {
  const canvas = await html2canvas(sheetElement, {
    scale: 1.5,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const cleanTitle = projectName.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
  const filename = `${cleanTitle || "Gambar_Survei"}_UP3_Kupang_A2_${Date.now()}.png`;

  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
