import html2canvas from "html2canvas";

export type ExportDpiQuality = "standard" | "high";


let colorConverterCtx: CanvasRenderingContext2D | null = null;

function getColorConverterCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!colorConverterCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorConverterCtx = canvas.getContext("2d", { willReadFrequently: true });
  }
  return colorConverterCtx;
}

/**
 * Normalisasi warna modern CSS (oklch, oklab, lab, lch, color, color-mix, okrgb) ke format rgb/rgba/hex
 * yang didukung oleh html2canvas. Mencegah error "unsupported color function".
 */
export function convertColorToRgb(str: string): string {
  if (!str || typeof str !== "string") return str;

  // Cepat lewati jika tidak mengandung fungsi warna modern
  if (
    !str.includes("lab(") &&
    !str.includes("lch(") &&
    !str.includes("color(") &&
    !str.includes("color-mix(") &&
    !str.includes("okrgb(") &&
    !str.includes("hwb(")
  ) {
    return str;
  }

  const ctx = getColorConverterCtx();

  // Regex dengan \b batas kata agar "oklab" tidak terpotong menjadi "ok" + "lab"
  const colorFuncRegex = /\b(?:oklch|oklab|lab|lch|color-mix|color|hwb|okrgb)\s*\((?:[^()]+|\([^()]*\))*\)/gi;

  const result = str.replace(colorFuncRegex, (match) => {
    // 1. Coba konversi native browser via 2D Canvas context
    if (ctx) {
      try {
        ctx.fillStyle = "#000000";
        ctx.fillStyle = match;
        const res = ctx.fillStyle;
        if (
          res &&
          !res.includes("lab(") &&
          !res.includes("lch(") &&
          !res.includes("color(") &&
          !res.includes("okrgb(")
        ) {
          return res;
        }
      } catch {
        // Lanjut ke fallback
      }
    }

    // 2. Fallback cerdas untuk palet warna Tailwind CSS v4 berdasarkan tingkat terang (lightness)
    if (
      match.includes("0.129") ||
      match.includes("0.208") ||
      match.includes("264.") ||
      match.includes("265.")
    ) {
      return "rgb(15, 23, 42)"; // slate-900 / slate-950
    }
    // Warna terang (lightness > 0.75): putih / slate-50 / slate-100 / slate-200
    if (
      match.includes("0.9") ||
      match.includes("0.8") ||
      match.includes("0.98") ||
      match.includes("0.96") ||
      match.includes("0.87") ||
      match.includes("0.92")
    ) {
      return "rgb(248, 250, 252)"; // slate-50 / slate-100 aman terang
    }
    if (match.includes("0.7") || match.includes("0.6")) {
      return "rgb(148, 163, 184)"; // slate-400 / slate-500
    }
    if (match.includes("0.4") || match.includes("0.3")) {
      return "rgb(51, 65, 85)"; // slate-700
    }
    return "rgb(255, 255, 255)"; // Default safe untuk background adalah putih, bukan gelap!
  });

  // Pembersihan ekstra jika masih ada sisa "okrgb"
  return result.replace(/\bokrgb\([^)]+\)/gi, "rgb(15, 23, 42)");
}

function createStyleProxy(origStyle: CSSStyleDeclaration): CSSStyleDeclaration {
  if (!origStyle) return origStyle;
  return new Proxy(origStyle, {
    get(target, prop) {
      if (prop === "getPropertyValue") {
        return (propName: string) => {
          const val = target.getPropertyValue(propName);
          return convertColorToRgb(val);
        };
      }
      // PENTING: Gunakan target[prop] langsung, BUKAN Reflect.get(target, prop, receiver)
      // Memberikan `receiver` (yang merupakan Proxy) ke getter bawaan CSSStyleDeclaration
      // menyebabkan Chromium melempar error: "TypeError: Illegal invocation"
      let val: any;
      try {
        val = (target as any)[prop];
      } catch {
        return undefined;
      }
      if (typeof val === "function") {
        return val.bind(target);
      }
      if (typeof val === "string") {
        return convertColorToRgb(val);
      }
      return val;
    },
  });
}

/**
 * Menjalankan fungsi di dalam konteks di mana getComputedStyle dibungkus
 * untuk menormalisasi warna CSS modern ke rgb/rgba.
 */
async function runWithColorSanitization<T>(action: () => Promise<T>): Promise<T> {
  const origWindowGetComputedStyle = window.getComputedStyle;

  window.getComputedStyle = function (elt: Element, pseudo?: string | null) {
    const style = origWindowGetComputedStyle.call(window, elt, pseudo);
    return createStyleProxy(style);
  };

  try {
    return await action();
  } finally {
    window.getComputedStyle = origWindowGetComputedStyle;
  }
}

/**
 * Menghitung skala render A2 yang adaptif.
 * Memastikan:
 * 1. Sisi terpanjang maksimum <= 8000 px
 * 2. Total piksel <= 40.000.000 px (~40 MP)
 * 3. Kualitas Standar: ~150 dpi (scale ~1.77)
 * 4. Kualitas Tinggi: ~300 dpi (scale ~3.54)
 */
export function getSafeScale(element: HTMLElement, quality: ExportDpiQuality = "standard"): number {
  const targetDpi = quality === "high" ? 300 : 150;
  const isLandscape = element.offsetWidth >= element.offsetHeight;
  const baseW = element.offsetWidth || (isLandscape ? 1980 : 1400);
  const baseH = element.offsetHeight || (isLandscape ? 1400 : 1980);
  const targetWInches = (isLandscape ? 594 : 420) / 25.4;
  let targetPx = targetWInches * targetDpi;
  let scale = targetPx / baseW;

  let w = Math.round(baseW * scale);
  let h = Math.round(baseH * scale);

  if (Math.max(w, h) > 8000) {
    scale = 8000 / Math.max(baseW, baseH);
    w = Math.round(baseW * scale);
    h = Math.round(baseH * scale);
  }

  if (w * h > 40000000) {
    scale = Math.sqrt(40000000 / (baseW * baseH));
  }

  return Math.max(1.0, +scale.toFixed(3));
}

/**
 * Kompresi dan resize gambar Base64 sebelum dimasukkan ke dalam canvas/PDF
 * agar tidak menghabiskan RAM atau menyebabkan canvas crash.
 */
export async function compressImageBase64(
  dataUrl?: string,
  maxDim: number = 1200,
  quality: number = 0.8
): Promise<string | undefined> {
  if (!dataUrl || !dataUrl.startsWith("data:image")) return dataUrl;
  if (dataUrl.startsWith("data:image/svg")) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim && dataUrl.length < 500000) {
        resolve(dataUrl);
        return;
      }

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Helper internal untuk merender elemen ke canvas dengan fallback resolusi bertingkat
 * jika terjadi kehabisan memori atau error canvas.
 */
async function renderElementWithFallback(
  element: HTMLElement,
  initialScale: number,
  elementName: string
): Promise<HTMLCanvasElement> {
  const scalesToTry = [
    initialScale,
    Math.max(1.0, +(initialScale * 0.75).toFixed(3)),
    1.5,
    1.0,
  ].filter((s, idx, arr) => arr.indexOf(s) === idx && s <= initialScale);

  let lastError: any = null;

  for (const scale of scalesToTry) {
    try {
      const calcW = Math.round(element.offsetWidth * scale);
      const calcH = Math.round(element.offsetHeight * scale);
      console.log(`[exportSurveySheet] Rendering ${elementName} (scale ${scale}, ${calcW}x${calcH} px, ${(calcW * calcH / 1000000).toFixed(2)} MP)...`);

      const canvas = await runWithColorSanitization(() =>
        html2canvas(element, {
          scale,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
            // Normalisasi getComputedStyle di dalam iframe clone
            if (clonedDoc.defaultView) {
              const origCloned = clonedDoc.defaultView.getComputedStyle;
              clonedDoc.defaultView.getComputedStyle = function (elt: Element, pseudo?: string | null) {
                const style = origCloned.call(clonedDoc.defaultView, elt, pseudo);
                return createStyleProxy(style);
              };
            }

            // Pindahkan cloned element ke (0, 0) agar tidak terpotong oleh koordinat negatif
            if (clonedElement) {
              let parent = clonedElement.parentElement;
              while (parent && parent !== clonedDoc.body) {
                if (parent.style) {
                  parent.style.position = "static";
                  parent.style.left = "0";
                  parent.style.top = "0";
                  parent.style.opacity = "1";
                  parent.style.transform = "none";
                }
                parent = parent.parentElement;
              }
              clonedElement.style.position = "relative";
              clonedElement.style.left = "0";
              clonedElement.style.top = "0";
              clonedElement.style.margin = "0";
            }

            // Pastikan semua gambar memiliki crossOrigin
            clonedDoc.querySelectorAll("img").forEach((img) => {
              img.crossOrigin = "anonymous";
            });
          },
        })
      );

      console.log(`[exportSurveySheet] ${elementName} successfully rendered at ${canvas.width}x${canvas.height}`);
      return canvas;
    } catch (err: any) {
      lastError = err;
      console.warn(`[exportSurveySheet] Render ${elementName} gagal pada skala ${scale}:`, err?.message || err);
      // Coba skala berikutnya yang lebih rendah
    }
  }

  throw lastError || new Error(`Gagal merender ${elementName}`);
}

export interface ExportSurveyOptions {
  sheetElements?: HTMLElement[];
  sheetElement?: HTMLElement;
  docElement?: HTMLElement | null;
  orientation: "portrait" | "landscape";
  includeDokumentasi: boolean;
  projectName?: string;
  quality?: ExportDpiQuality;
  onProgress?: (statusText: string, current: number, total: number) => void;
}

export interface ExportPngOptions {
  sheetElements?: HTMLElement[];
  sheetElement?: HTMLElement;
  projectName?: string;
  quality?: ExportDpiQuality;
  onProgress?: (statusText: string, current: number, total: number) => void;
}

/**
 * Melakukan export Lembar Gambar Survei UP3 Kupang resmi dalam ukuran A2.
 * Mendukung PDF Multi-halaman (tiap halaman dirender terpisah secara berurutan).
 */
export async function exportSurveyToPdf({
  sheetElements,
  sheetElement,
  docElement,
  orientation,
  includeDokumentasi,
  projectName = "Gambar_Survei_UP3_Kupang",
  quality = "standard",
  onProgress,
}: ExportSurveyOptions): Promise<{ fileSizeKb: number; renderTimeMs: number }> {
  const startTime = Date.now();
  console.log("[exportSurveyToPdf] Starting export with quality:", quality);

  const elements = sheetElements && sheetElements.length > 0 ? sheetElements : sheetElement ? [sheetElement] : [];
  if (elements.length === 0) {
    throw new Error("Tidak ada lembar gambar yang tersedia untuk diexport");
  }

  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // lanjut jika font check gagal
    }
  }

  const { default: jsPDF } = await import("jspdf");

  const isLandscape = orientation === "landscape";
  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a2",
  });

  const pageW = isLandscape ? 594 : 420;
  const pageH = isLandscape ? 420 : 594;
  const totalPages = elements.length + (includeDokumentasi && docElement ? 1 : 0);

  // Render tiap halaman gambar skematik satu per satu
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const pageNum = i + 1;
    onProgress?.(`Merender halaman ${pageNum} dari ${totalPages}...`, pageNum, totalPages);

    if (i > 0) {
      pdf.addPage("a2", isLandscape ? "landscape" : "portrait");
    }

    const targetScale = getSafeScale(el, quality);
    try {
      const canvas = await renderElementWithFallback(el, targetScale, `Halaman ${pageNum}`);
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
    } catch (err: any) {
      throw new Error(`Gagal merender Halaman ${pageNum}: ${err?.message || err}`);
    }
  }

  // Render Halaman Dokumentasi Lapangan (Landscape A2) di paling akhir jika diaktifkan
  if (includeDokumentasi && docElement) {
    onProgress?.(`Merender Halaman Dokumentasi (${totalPages} dari ${totalPages})...`, totalPages, totalPages);
    pdf.addPage("a2", "landscape");
    const docScale = getSafeScale(docElement, quality);
    try {
      const canvasDoc = await renderElementWithFallback(docElement, docScale, "Halaman Dokumentasi");
      const imgDataDoc = canvasDoc.toDataURL("image/jpeg", 0.95);
      pdf.addImage(imgDataDoc, "JPEG", 0, 0, 594, 420, undefined, "FAST");
    } catch (err: any) {
      throw new Error(`Gagal merender Halaman Dokumentasi: ${err?.message || err}`);
    }
  }

  // Simpan berkas PDF
  onProgress?.("Menyimpan berkas PDF...", totalPages, totalPages);
  const cleanTitle = projectName.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
  const filename = `${cleanTitle || "Gambar_Survei"}_UP3_Kupang_A2_${Date.now()}.pdf`;
  pdf.save(filename);

  const renderTimeMs = Date.now() - startTime;
  const pdfBlob = pdf.output("blob");
  const fileSizeKb = Math.round(pdfBlob.size / 1024);

  console.log(`[exportSurveyToPdf] PDF Exported successfully in ${renderTimeMs}ms (${fileSizeKb} KB, ${totalPages} halaman)`);
  return { fileSizeKb, renderTimeMs };
}

/**
 * Melakukan export Lembar Gambar Survei A2 sebagai PNG resolusi tinggi.
 * Jika terdiri dari beberapa halaman, otomatis dikemas ke berkas ZIP.
 */
export async function exportSurveyToPng({
  sheetElements,
  sheetElement,
  projectName = "Gambar_Survei_UP3_Kupang",
  quality = "standard",
  onProgress,
}: ExportPngOptions): Promise<{ renderTimeMs: number }> {
  const startTime = Date.now();
  console.log("[exportSurveyToPng] Starting PNG export with quality:", quality);

  const elements = sheetElements && sheetElements.length > 0 ? sheetElements : sheetElement ? [sheetElement] : [];
  if (elements.length === 0) {
    throw new Error("Tidak ada lembar gambar yang tersedia untuk diexport");
  }

  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // lanjut jika font check gagal
    }
  }

  const cleanTitle = projectName.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");

  if (elements.length === 1) {
    // 1 Halaman: Langsung unduh PNG
    onProgress?.("Merender berkas gambar PNG...", 1, 1);
    const targetScale = getSafeScale(elements[0], quality);
    const canvas = await renderElementWithFallback(elements[0], targetScale, "Gambar PNG");

    const filename = `${cleanTitle || "Gambar_Survei"}_UP3_Kupang_A2_${Date.now()}.png`;
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } else {
    // Multi-Halaman: Render satu per satu dan kemas ke dalam ZIP
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();

    for (let i = 0; i < elements.length; i++) {
      const pageNum = i + 1;
      onProgress?.(`Merender PNG Halaman ${pageNum} dari ${elements.length}...`, pageNum, elements.length);
      const targetScale = getSafeScale(elements[i], quality);
      try {
        const canvas = await renderElementWithFallback(elements[i], targetScale, `PNG Halaman ${pageNum}`);
        const dataUrl = canvas.toDataURL("image/png");
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        zip.file(`${cleanTitle}_Hal_${pageNum}_UP3_Kupang_A2.png`, base64Data, { base64: true });
      } catch (err: any) {
        throw new Error(`Gagal merender PNG Halaman ${pageNum}: ${err?.message || err}`);
      }
    }

    onProgress?.("Mengemas seluruh halaman ke berkas ZIP...", elements.length, elements.length);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const filename = `${cleanTitle || "Gambar_Survei"}_UP3_Kupang_A2_MultiHalaman_${Date.now()}.zip`;
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const renderTimeMs = Date.now() - startTime;
  console.log(`[exportSurveyToPng] PNG Exported successfully in ${renderTimeMs}ms (${elements.length} halaman)`);
  return { renderTimeMs };
}
