"use client";

import React, { useState, useRef } from "react";
import type { SchematicData, SurveyFormData } from "../../../types/schematic";
import SurveyDrawingSheet from "./SurveyDrawingSheet";
import SurveyDocumentationSheet from "./SurveyDocumentationSheet";
import { exportSurveyToPdf, exportSurveyToPng } from "../../../lib/exportSurveySheet";
import { DRAWING_FRAME } from "../../../lib/schematic/mapSyncEngine";

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
  const [previewPage, setPreviewPage] = useState<"drawing" | "documentation">("drawing");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  // Hidden references for high-res export
  const sheetPrintRef = useRef<HTMLDivElement>(null);
  const docPrintRef = useRef<HTMLDivElement>(null);

  // Preview scale and dimensions (all hooks MUST be declared before any early return)
  const isLandscape = orientation === "landscape";
  const sheetWidth = previewPage === "documentation" || isLandscape ? 1980 : 1400;
  const sheetHeight = previewPage === "documentation" || isLandscape ? 1400 : 1980;
  const defaultZoom = isLandscape || previewPage === "documentation" ? 0.38 : 0.34;
  const [previewZoom, setPreviewZoom] = useState(defaultZoom);

  if (!open) return null;

  const handleOrientationChange = (nextOr: "portrait" | "landscape") => {
    setOrientation(nextOr);
    onChangeSurveyData({
      ...surveyData,
      orientation: nextOr,
    });
  };

  const handleToggleDokumentasi = (checked: boolean) => {
    setIncludeDokumentasi(checked);
    onChangeSurveyData({
      ...surveyData,
      includeDokumentasi: checked,
    });
    if (!checked && previewPage === "documentation") {
      setPreviewPage("drawing");
    }
  };

  const handleExportPdf = async () => {
    if (!sheetPrintRef.current) return;
    setIsExportingPdf(true);
    try {
      await exportSurveyToPdf({
        sheetElement: sheetPrintRef.current,
        docElement: includeDokumentasi ? docPrintRef.current : null,
        orientation,
        includeDokumentasi,
        projectName: surveyData?.kop?.namaPekerjaan || schematic?.kop?.namaPekerjaan || "Gambar_Survei_UP3_Kupang",
      });
    } catch (err) {
      console.error("Gagal export PDF A2:", err);
      alert("Gagal melakukan export PDF A2. Pastikan browser mendukung canvas capture.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportPng = async () => {
    if (!sheetPrintRef.current) return;
    setIsExportingPng(true);
    try {
      await exportSurveyToPng({
        sheetElement: sheetPrintRef.current,
        projectName: surveyData?.kop?.namaPekerjaan || schematic?.kop?.namaPekerjaan || "Gambar_Survei_UP3_Kupang",
      });
    } catch (err) {
      console.error("Gagal export PNG A2:", err);
      alert("Gagal melakukan export PNG A2.");
    } finally {
      setIsExportingPng(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <h3 className="font-black text-base text-white tracking-tight flex items-center gap-2">
                Export Gambar Survei UP3 Kupang (A2)
                <span className="px-2 py-0.5 rounded bg-blue-600/30 text-blue-400 border border-blue-500/40 text-[10px] font-bold">
                  Form Resmi
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Ukuran standar ISO A2 (420 x 594 mm) dengan bingkai resmi, kop PLN, dan legenda otomatis
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

        {/* Out-of-Frame Warning Banner */}
        {schematic.nodes.some(n => n.x < 0 || n.x > DRAWING_FRAME.WIDTH || n.y < 0 || n.y > DRAWING_FRAME.HEIGHT) && (
          <div className="bg-red-950/80 border-b border-red-500/50 px-4 py-2 flex items-center justify-between text-xs text-red-200">
            <div className="flex items-center gap-2">
              <span className="text-base animate-pulse">⚠️</span>
              <span>
                <strong>Perhatian:</strong> Terdapat {schematic.nodes.filter(n => n.x < 0 || n.x > DRAWING_FRAME.WIDTH || n.y < 0 || n.y > DRAWING_FRAME.HEIGHT).length} aset berada di luar frame gambar (1200 × 500 px) yang berpotensi tidak tercetak lengkap.
              </span>
            </div>
          </div>
        )}

        {/* Workspace: Sidebar Options & Scaled Live Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* ─── Panel Pengaturan Export (Kiri) ─── */}
          <div className="w-80 bg-slate-950/80 border-r border-slate-800 p-4 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="space-y-4">
              {/* Pilihan Orientasi A2 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide">
                  Orientasi Kertas A2:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleOrientationChange("portrait")}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                      orientation === "portrait"
                        ? "bg-blue-600/20 border-blue-500 text-white font-bold shadow-md"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="w-6 h-9 border-2 border-current rounded-xs" />
                    <span className="text-xs">Portrait</span>
                    <span className="text-[10px] text-slate-400">(Ref Halaman 1)</span>
                  </button>

                  <button
                    onClick={() => handleOrientationChange("landscape")}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                      orientation === "landscape"
                        ? "bg-blue-600/20 border-blue-500 text-white font-bold shadow-md"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="w-9 h-6 border-2 border-current rounded-xs" />
                    <span className="text-xs">Landscape</span>
                    <span className="text-[10px] text-slate-400">(Ref Halaman 2)</span>
                  </button>
                </div>
              </div>

              {/* Toggle Halaman Dokumentasi */}
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
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
                    onChange={e => handleToggleDokumentasi(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>

              {/* Ringkasan Metadata Proyek */}
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-[11px] space-y-1.5">
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
                  <span className="text-slate-400">Pelanggan:</span>
                  <span className="font-bold text-slate-200 truncate max-w-[130px]">
                    {surveyData?.kop?.dataPelanggan || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">No. Gambar:</span>
                  <span className="font-mono text-slate-200">
                    {surveyData?.kop?.nomorGambar || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Simbol:</span>
                  <span className="font-bold text-cyan-400">
                    {schematic?.nodes?.length || 0} tiang/gardu, {schematic?.edges?.length || 0} kabel
                  </span>
                </div>
              </div>
            </div>

            {/* Tombol Aksi Download */}
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <button
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="w-full py-2.5 rounded-xl font-extrabold text-xs bg-red-600 hover:bg-red-500 text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>📄</span>
                <span>
                  {isExportingPdf
                    ? "Merender PDF A2..."
                    : includeDokumentasi
                    ? "Unduh PDF A2 (2 Halaman)"
                    : "Unduh PDF A2 (1 Halaman)"}
                </span>
              </button>

              <button
                onClick={handleExportPng}
                disabled={isExportingPng}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>🖼️</span>
                <span>{isExportingPng ? "Merender PNG..." : "Unduh Gambar PNG"}</span>
              </button>
            </div>
          </div>

          {/* ─── Area Pratinjau Terpusat (Kanan) ─── */}
          <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden relative">
            {/* Top Toolbar Pratinjau: Pilihan Halaman & Zoom */}
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between flex-wrap gap-2">
              {includeDokumentasi ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPreviewPage("drawing")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      previewPage === "drawing"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white bg-slate-800/60"
                    }`}
                  >
                    Halaman 1: Gambar Survei ({orientation})
                  </button>
                  <button
                    onClick={() => setPreviewPage("documentation")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      previewPage === "documentation"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white bg-slate-800/60"
                    }`}
                  >
                    Halaman 2: Dokumentasi (Landscape)
                  </button>
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-300">
                  Pratinjau Lembar A2 ({isLandscape ? "Landscape" : "Portrait"})
                </span>
              )}

              {/* Kontrol Zoom Pratinjau */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium">Zoom Pratinjau:</span>
                <button
                  onClick={() => setPreviewZoom(prev => Math.max(0.2, +(prev - 0.05).toFixed(2)))}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center cursor-pointer"
                  title="Perkecil"
                >
                  -
                </button>
                <span className="text-xs font-mono font-bold text-blue-400 w-12 text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  onClick={() => setPreviewZoom(prev => Math.min(1.0, +(prev + 0.05).toFixed(2)))}
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
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── HIDDEN HIGH-RES RENDER CONTAINERS FOR HTML2CANVAS ─── */}
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
        {/* Render Halaman Gambar Survei Utama */}
        <div ref={sheetPrintRef}>
          <SurveyDrawingSheet
            schematic={schematic}
            surveyData={surveyData}
            orientation={orientation}
          />
        </div>

        {/* Render Halaman Dokumentasi Lapangan */}
        <div ref={docPrintRef}>
          <SurveyDocumentationSheet surveyData={surveyData} />
        </div>
      </div>
    </div>
  );
}
