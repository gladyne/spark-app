"use client";

import React, { useState, useRef, useMemo } from "react";
import type { SchematicData, SurveyFormData } from "../../../types/schematic";
import SurveyDrawingSheet from "./SurveyDrawingSheet";
import SurveyDocumentationSheet from "./SurveyDocumentationSheet";
import {
  exportSurveyToPdf,
  exportSurveyToPng,
  type ExportDpiQuality,
} from "../../../lib/exportSurveySheet";
import { calculatePagination } from "../../../lib/schematic/paginationEngine";

interface Props {
  open: boolean;
  onClose: () => void;
  schematic: SchematicData;
  surveyData: SurveyFormData;
  onChangeSurveyData: (updated: SurveyFormData) => void;
  onOpenDataModal: () => void;
}

export default function SurveyExportModal({
  open,
  onClose,
  schematic,
  surveyData,
  onChangeSurveyData,
  onOpenDataModal,
}: Props) {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    surveyData?.orientation || "portrait"
  );
  const [includeDokumentasi, setIncludeDokumentasi] = useState<boolean>(
    surveyData?.includeDokumentasi || false
  );
  const [quality, setQuality] = useState<ExportDpiQuality>("standard");
  const [scaleMode, setScaleMode] = useState<"auto" | "manual">("auto");
  const [customScale, setCustomScale] = useState<number>(1.0);
  const [repeatDataBlocks, setRepeatDataBlocks] = useState<boolean>(
    surveyData?.repeatDataBlocksOnAllPages || false
  );
  const [volumePerHalaman, setVolumePerHalaman] = useState<boolean>(false);

  // Navigasi pratinjau halaman: 1, 2, ... N atau "documentation"
  const [previewPage, setPreviewPage] = useState<number | "documentation">(1);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [exportProgressText, setExportProgressText] = useState<string | null>(null);

  // Hidden references untuk multi-page export
  const sheetPrintRefs = useRef<(HTMLDivElement | null)[]>([]);
  const docPrintRef = useRef<HTMLDivElement>(null);

  // Hitung paginasi cerdas secara reaktif
  const pagination = useMemo(() => {
    return calculatePagination({
      schematic,
      orientation,
      scaleOption: scaleMode === "auto" ? "auto" : customScale,
      manualPageFrames: surveyData?.manualPageFrames,
    });
  }, [schematic, orientation, scaleMode, customScale, surveyData?.manualPageFrames]);

  // Preview scale and dimensions
  const isLandscape = orientation === "landscape";
  const sheetWidth = previewPage === "documentation" || isLandscape ? 1980 : 1400;
  const sheetHeight = previewPage === "documentation" || isLandscape ? 1400 : 1980;
  const defaultZoom = isLandscape || previewPage === "documentation" ? 0.38 : 0.34;
  const [previewZoom, setPreviewZoom] = useState(defaultZoom);

  // Pastikan halaman aktif selalu valid bila jumlah halaman berubah
  React.useEffect(() => {
    if (previewPage !== "documentation" && previewPage > pagination.totalPages) {
      setPreviewPage(1);
    }
  }, [pagination.totalPages, previewPage]);

  if (!open) return null;

  const totalDrawingPages = pagination.totalPages;
  const totalDisplayPages = totalDrawingPages + (includeDokumentasi ? 1 : 0);

  const handleOrientationChange = (nextOr: "portrait" | "landscape") => {
    setOrientation(nextOr);
    onChangeSurveyData({
      ...surveyData,
      orientation: nextOr,
    });
    if (previewPage !== "documentation" && previewPage > 1) {
      setPreviewPage(1);
    }
  };

  const handleToggleDokumentasi = (checked: boolean) => {
    setIncludeDokumentasi(checked);
    onChangeSurveyData({
      ...surveyData,
      includeDokumentasi: checked,
    });
    if (!checked && previewPage === "documentation") {
      setPreviewPage(1);
    }
  };

  const handleToggleRepeatDataBlocks = (checked: boolean) => {
    setRepeatDataBlocks(checked);
    onChangeSurveyData({
      ...surveyData,
      repeatDataBlocksOnAllPages: checked,
    });
  };

  const formatExportError = (err: any, type: "PDF" | "PNG"): string => {
    const msg = String(err?.message || err);
    if (msg.includes("canvas") || msg.includes("memory") || msg.includes("exceeded") || msg.includes("Out of Memory")) {
      return `Gagal melakukan export ${type} A2: Memori browser tidak mencukupi untuk resolusi yang dipilih.\n\nSaran: Coba pilih resolusi 'Standar (150 dpi)' yang lebih hemat memori dan tutup tab lain.`;
    }
    if (msg.includes("tainted") || msg.includes("CORS")) {
      return `Gagal melakukan export ${type} A2: Terdapat gambar eksternal yang diblokir oleh keamanan browser (CORS).\n\nSaran: Pastikan foto/logo diunggah langsung atau berasal dari sumber lokal.`;
    }
    return `Gagal melakukan export ${type} A2: ${msg}\n\nJika menggunakan kualitas 'Tinggi (300 dpi)', coba beralih ke 'Standar (150 dpi)'.`;
  };

  const handleExportPdf = async () => {
    const validElements = sheetPrintRefs.current.filter((el): el is HTMLDivElement => el !== null);
    if (validElements.length === 0) return;

    setIsExportingPdf(true);
    setExportProgressText("Menyiapkan dokumen PDF A2...");
    try {
      (window as any).__lastExportError = null;
      (window as any).__lastExportErrorText = null;
      (window as any).__lastExportSuccess = false;

      const res = await exportSurveyToPdf({
        sheetElements: validElements,
        docElement: includeDokumentasi ? docPrintRef.current : null,
        orientation,
        includeDokumentasi,
        projectName: surveyData?.kop?.namaPekerjaan || schematic?.kop?.namaPekerjaan || "Gambar_Survei_UP3_Kupang",
        quality,
        onProgress: (statusText) => setExportProgressText(statusText),
      });

      (window as any).__lastExportSuccess = true;
      (window as any).__lastExportStats = res;
    } catch (err: any) {
      console.error("Gagal export PDF A2 (FULL ERROR):", err, err?.stack);
      (window as any).__lastExportError = err;
      (window as any).__lastExportErrorText = String(err?.stack || err?.message || err);
      alert(formatExportError(err, "PDF"));
    } finally {
      setIsExportingPdf(false);
      setExportProgressText(null);
    }
  };

  const handleExportPng = async () => {
    const validElements = sheetPrintRefs.current.filter((el): el is HTMLDivElement => el !== null);
    if (validElements.length === 0) return;

    setIsExportingPng(true);
    setExportProgressText("Menyiapkan berkas PNG...");
    try {
      (window as any).__lastExportError = null;
      (window as any).__lastExportErrorText = null;
      (window as any).__lastExportSuccess = false;

      const res = await exportSurveyToPng({
        sheetElements: validElements,
        projectName: surveyData?.kop?.namaPekerjaan || schematic?.kop?.namaPekerjaan || "Gambar_Survei_UP3_Kupang",
        quality,
        onProgress: (statusText) => setExportProgressText(statusText),
      });

      (window as any).__lastExportSuccess = true;
      (window as any).__lastExportStats = res;
    } catch (err: any) {
      console.error("Gagal export PNG A2 (FULL ERROR):", err, err?.stack);
      (window as any).__lastExportError = err;
      (window as any).__lastExportErrorText = String(err?.stack || err?.message || err);
      alert(formatExportError(err, "PNG"));
    } finally {
      setIsExportingPng(false);
      setExportProgressText(null);
    }
  };

  // Navigasi Halaman Sebelumnya / Berikutnya
  const handlePrevPage = () => {
    if (previewPage === "documentation") {
      setPreviewPage(totalDrawingPages);
    } else if (previewPage > 1) {
      setPreviewPage((previewPage as number) - 1);
    }
  };

  const handleNextPage = () => {
    if (previewPage === "documentation") return;
    if (previewPage < totalDrawingPages) {
      setPreviewPage((previewPage as number) + 1);
    } else if (includeDokumentasi) {
      setPreviewPage("documentation");
    }
  };

  // Active page boundary data
  const currentActivePageIndex = typeof previewPage === "number" ? previewPage : 1;
  const currentActivePageBoundary = pagination.pages[currentActivePageIndex - 1] || pagination.pages[0];
  const currentActiveCallouts = pagination.calloutsByPage[currentActivePageIndex] || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-7xl h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header Modal */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <h3 className="font-black text-base text-white tracking-tight flex items-center gap-2">
                Export Gambar Survei UP3 Kupang (A2)
                <span className="px-2 py-0.5 rounded bg-blue-600/30 text-blue-400 border border-blue-500/40 text-[10px] font-bold">
                  Form Resmi ISO A2
                </span>
                {pagination.totalPages > 1 && (
                  <span className="px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold animate-pulse">
                    Paginasi Otomatis ({pagination.totalPages} Lembar)
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Paginasi cerdas dengan skala terbaca tetap, zona overlap referensi, dan penanda sambungan antar halaman
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenDataModal}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>✏️</span> Edit Data Survei
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Paginasi Info Banner jika melebihi 1 halaman */}
        {pagination.totalPages > 1 && (
          <div className="bg-blue-950/70 border-b border-blue-500/40 px-4 py-2 flex items-center justify-between text-xs text-blue-200">
            <div className="flex items-center gap-2">
              <span className="text-base">ℹ️</span>
              <span>
                <strong>Paginasi Aktif:</strong> Jaringan listrik terbagi menjadi{" "}
                <span className="font-bold text-white">{pagination.totalPages} Lembar A2</span> pada skala{" "}
                <span className="font-bold text-cyan-300 font-mono">
                  {(pagination.effectiveScale * 100).toFixed(0)}%
                </span>{" "}
                agar ukuran tiang (±17px) &amp; teks label tetap terbaca jelas tanpa diperkecil paksa.
              </span>
            </div>
            <div className="text-[11px] text-blue-300">
              Overlap: ±1 Bentang Tiang &bull; Penanda Sambungan Otomatis
            </div>
          </div>
        )}

        {/* Workspace: Sidebar Options & Scaled Live Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* ─── Panel Pengaturan Export (Kiri) ─── */}
          <div className="w-88 bg-slate-950/80 border-r border-slate-800 p-3.5 flex flex-col justify-between overflow-y-auto space-y-3.5">
            <div className="space-y-3.5">
              {/* 1. Pilihan Orientasi A2 */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                  Orientasi Kertas A2:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="btn-orient-portrait"
                    onClick={() => handleOrientationChange("portrait")}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      orientation === "portrait"
                        ? "bg-blue-600/20 border-blue-500 text-white font-bold shadow-md"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="w-5 h-7 border-2 border-current rounded-xs" />
                    <span className="text-xs">Portrait</span>
                    <span className="text-[9.5px] text-slate-400">(Ref Halaman 1)</span>
                  </button>

                  <button
                    id="btn-orient-landscape"
                    onClick={() => handleOrientationChange("landscape")}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      orientation === "landscape"
                        ? "bg-blue-600/20 border-blue-500 text-white font-bold shadow-md"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="w-7 h-5 border-2 border-current rounded-xs" />
                    <span className="text-xs">Landscape</span>
                    <span className="text-[9.5px] text-slate-400">(Ref Halaman 2)</span>
                  </button>
                </div>
              </div>

              {/* 2. Pilihan Skala & Mode Paginasi */}
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wide">
                    Skala Gambar Cetak:
                  </span>
                  <span className="text-[10px] font-mono font-bold text-cyan-400">
                    {(pagination.effectiveScale * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button
                    id="btn-scale-auto"
                    type="button"
                    onClick={() => setScaleMode("auto")}
                    className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer font-bold ${
                      scaleMode === "auto"
                        ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                        : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    Auto (Disarankan)
                  </button>
                  <button
                    id="btn-scale-manual"
                    type="button"
                    onClick={() => setScaleMode("manual")}
                    className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer font-bold ${
                      scaleMode === "manual"
                        ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                        : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white"
                    }`}
                  >
                    Manual Skala
                  </button>
                </div>

                {scaleMode === "manual" && (
                  <div className="pt-1.5 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">Pilih Skala:</span>
                    <select
                      value={customScale}
                      onChange={(e) => setCustomScale(Number(e.target.value))}
                      className="flex-1 bg-slate-800 border border-slate-700 text-xs font-bold rounded-lg px-2 py-1 text-white cursor-pointer"
                    >
                      <option value={0.75}>75% (Lebih Padat)</option>
                      <option value={1.0}>100% (Standar 1:1)</option>
                      <option value={1.25}>125% (Lebih Besar)</option>
                      <option value={1.5}>150% (Sangat Detail)</option>
                    </select>
                  </div>
                )}

                <div className="text-[10px] text-slate-400 leading-tight pt-0.5">
                  {pagination.totalPages === 1 ? (
                    <span className="text-emerald-400 font-medium">
                      ✓ Seluruh gambar muat proporsional dalam 1 lembar A2.
                    </span>
                  ) : (
                    <span>
                      Terpecah menjadi <strong className="text-white">{pagination.totalPages} lembar</strong>. Simbol tidak akan mengecil di bawah batas terbaca.
                    </span>
                  )}
                </div>
              </div>

              {/* 3. Toggle Pengaturan Lembar Multi-Halaman */}
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex flex-col pr-2">
                    <span className="text-xs font-bold text-slate-200">
                      Sertakan Halaman Dokumentasi
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Lampiran foto 3 kotak (Ref Halaman 4, Landscape A2)
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeDokumentasi}
                    onChange={(e) => handleToggleDokumentasi(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>

                {pagination.totalPages > 1 && (
                  <div className="border-t border-slate-800 pt-2 space-y-2">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex flex-col pr-2">
                        <span className="text-xs font-bold text-slate-200">
                          Ulangi Blok Data di Semua Halaman
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Jika tidak aktif, pengukuran hanya ada di Hal. 1
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={repeatDataBlocks}
                        onChange={(e) => handleToggleRepeatDataBlocks(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex flex-col pr-2">
                        <span className="text-xs font-bold text-slate-200">
                          Volume Legenda per Halaman
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Default: Total keseluruhan gambar proyek
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={volumePerHalaman}
                        onChange={(e) => setVolumePerHalaman(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* 4. Pilihan Resolusi Render (DPI) */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                  Resolusi &amp; Kualitas:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuality("standard")}
                    className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                      quality === "standard"
                        ? "bg-blue-600/20 border-blue-500 text-white font-bold shadow-md ring-1 ring-blue-500"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-xs font-bold text-emerald-400">Standar (150 dpi)</span>
                    <span className="text-[9.5px] text-slate-400">Rekomendasi, Cepat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuality("high")}
                    className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-0.5 ${
                      quality === "high"
                        ? "bg-blue-600/20 border-blue-500 text-white font-bold shadow-md ring-1 ring-blue-500"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-xs font-bold text-amber-400">Tinggi (300 dpi)</span>
                    <span className="text-[9.5px] text-slate-400">Plotter / RAM Besar</span>
                  </button>
                </div>
              </div>

              {/* Ringkasan Metadata Proyek */}
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
                <div className="font-bold text-slate-300 uppercase tracking-wide border-b border-slate-800 pb-1">
                  Info Proyek:
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pekerjaan:</span>
                  <span className="font-bold text-slate-200 truncate max-w-[130px]">
                    {surveyData?.kop?.namaPekerjaan || schematic?.kop?.namaPekerjaan || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Halaman:</span>
                  <span className="font-bold text-cyan-400">
                    {totalDisplayPages} Halaman A2
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Simbol:</span>
                  <span className="font-bold text-slate-200">
                    {schematic?.nodes?.length || 0} tiang, {schematic?.edges?.length || 0} kabel
                  </span>
                </div>
              </div>
            </div>

            {/* Tombol Aksi Download */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                id="btn-export-pdf-action"
                onClick={handleExportPdf}
                disabled={isExportingPdf || isExportingPng}
                className="w-full py-2.5 rounded-xl font-extrabold text-xs bg-red-600 hover:bg-red-500 text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>📄</span>
                <span>
                  {isExportingPdf
                    ? exportProgressText || "Merender PDF A2..."
                    : `Unduh PDF A2 (${totalDisplayPages} Halaman)`}
                </span>
              </button>

              <button
                id="btn-export-png-action"
                onClick={handleExportPng}
                disabled={isExportingPdf || isExportingPng}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>🖼️</span>
                <span>
                  {isExportingPng
                    ? exportProgressText || "Merender PNG..."
                    : pagination.totalPages > 1
                    ? `Unduh ZIP Gambar PNG (${totalDrawingPages} Lembar)`
                    : "Unduh Gambar PNG"}
                </span>
              </button>
            </div>
          </div>

          {/* ─── Area Pratinjau Terpusat (Kanan) ─── */}
          <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden relative">
            {/* Top Toolbar Pratinjau: Navigasi Paginasi & Kontrol Zoom */}
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between flex-wrap gap-2">
              {/* Navigasi Paginasi Halaman */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={handlePrevPage}
                  disabled={previewPage === 1}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 border border-slate-700"
                  title="Halaman Sebelumnya"
                >
                  ◀
                </button>

                {/* Tombol Pills Halaman */}
                {pagination.pages.map((p) => (
                  <button
                    key={p.id}
                    id={`btn-page-pill-${p.pageIndex}`}
                    onClick={() => setPreviewPage(p.pageIndex)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      previewPage === p.pageIndex
                        ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-400"
                        : "text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700"
                    }`}
                  >
                    Hal. {p.pageIndex}
                  </button>
                ))}

                {includeDokumentasi && (
                  <button
                    onClick={() => setPreviewPage("documentation")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                      previewPage === "documentation"
                        ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-400"
                        : "text-slate-300 hover:text-white bg-slate-800/80 border border-slate-700"
                    }`}
                  >
                    <span>📷</span>
                    <span>Dokumentasi</span>
                  </button>
                )}

                <button
                  onClick={handleNextPage}
                  disabled={previewPage === (includeDokumentasi ? "documentation" : totalDrawingPages)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 border border-slate-700"
                  title="Halaman Berikutnya"
                >
                  ▶
                </button>

                <span className="text-xs text-slate-400 font-medium ml-2">
                  Menampilkan:{" "}
                  <strong className="text-white">
                    {previewPage === "documentation"
                      ? `Halaman ${totalDisplayPages} (Dokumentasi)`
                      : `Halaman ${previewPage} dari ${totalDisplayPages}`}
                  </strong>
                </span>
              </div>

              {/* Kontrol Zoom Pratinjau */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium">Zoom:</span>
                <button
                  onClick={() => setPreviewZoom((prev) => Math.max(0.2, +(prev - 0.05).toFixed(2)))}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center cursor-pointer"
                  title="Perkecil"
                >
                  -
                </button>
                <span className="text-xs font-mono font-bold text-blue-400 w-12 text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  onClick={() => setPreviewZoom((prev) => Math.min(1.0, +(prev + 0.05).toFixed(2)))}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center cursor-pointer"
                  title="Perbesar"
                >
                  +
                </button>
                <button
                  onClick={() => setPreviewZoom(defaultZoom)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 cursor-pointer"
                  title="Reset Ukuran Pas Layar"
                >
                  Pas Layar
                </button>
              </div>
            </div>

            {/* Scrollable Canvas Preview Container */}
            <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-slate-950">
              <div
                className="shadow-2xl border border-slate-750 bg-white relative transition-all"
                style={{
                  width: `${Math.round(sheetWidth * previewZoom)}px`,
                  height: `${Math.round(sheetHeight * previewZoom)}px`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${sheetWidth}px`,
                    height: `${sheetHeight}px`,
                    transform: `scale(${previewZoom})`,
                    transformOrigin: "top left",
                  }}
                >
                  {previewPage === "documentation" ? (
                    <SurveyDocumentationSheet surveyData={surveyData} />
                  ) : (
                    <SurveyDrawingSheet
                      schematic={schematic}
                      surveyData={surveyData}
                      orientation={orientation}
                      pageBoundary={currentActivePageBoundary}
                      continuationCallouts={currentActiveCallouts}
                      pageIndex={currentActivePageIndex}
                      totalPages={totalDisplayPages}
                      repeatDataBlocksOnAllPages={repeatDataBlocks}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── HIDDEN RENDER CONTAINERS UNTUK HTML2CANVAS MULTI-HALAMAN ─── */}
      <div
        style={{
          position: "fixed",
          left: "-99999px",
          top: 0,
          pointerEvents: "none",
          opacity: 1,
          zIndex: -999,
        }}
      >
        {/* Render setiap lembar gambar skematik terpisah untuk capture */}
        {pagination.pages.map((p, idx) => (
          <div
            key={p.id}
            ref={(el) => {
              sheetPrintRefs.current[idx] = el;
            }}
          >
            <SurveyDrawingSheet
              schematic={schematic}
              surveyData={surveyData}
              orientation={orientation}
              pageBoundary={p}
              continuationCallouts={pagination.calloutsByPage[p.pageIndex] || []}
              pageIndex={p.pageIndex}
              totalPages={totalDisplayPages}
              repeatDataBlocksOnAllPages={repeatDataBlocks}
            />
          </div>
        ))}

        {/* Render Halaman Dokumentasi Lapangan */}
        <div ref={docPrintRef}>
          <SurveyDocumentationSheet surveyData={surveyData} />
        </div>
      </div>
    </div>
  );
}
