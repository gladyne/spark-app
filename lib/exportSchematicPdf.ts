import html2canvas from "html2canvas";

export async function exportSchematicToPdf(
  element: HTMLElement,
  title: string = "Gambar_Kerja_PLN"
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  // Create high-res screenshot
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");

  // A4 Landscape: 297 x 210 mm
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pdfWidth = 297;
  const pdfHeight = 210;

  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");

  const cleanTitle = title.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
  const filename = `${cleanTitle || "Gambar_Kerja_PLN"}_${Date.now()}.pdf`;
  pdf.save(filename);
}

export async function exportSchematicToPng(
  element: HTMLElement,
  title: string = "Gambar_Kerja_PLN"
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const link = document.createElement("a");
  const cleanTitle = title.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
  link.download = `${cleanTitle || "Gambar_Kerja_PLN"}_${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
