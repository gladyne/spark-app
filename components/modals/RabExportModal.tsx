"use client";

import { useState, useMemo, useRef } from "react";
import type { RabSummary, RabItemResult, RabCategory } from "../../lib/rab/types";
import { exportRabToExcel, triggerExcelDownload } from "../../lib/rab/rabExcelExporter";

interface Props {
  open: boolean;
  onClose: () => void;
  rabSummary: RabSummary;
  projectName?: string;
}

export default function RabExportModal({
  open,
  onClose,
  rabSummary,
  projectName = "SPARK_RAB_KUPANG",
}: Props) {
  const [selectedTab, setSelectedTab] = useState<"all" | "jtm" | "gardu" | "jtr" | "warnings">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    return rabSummary.items.filter(item => {
      // Tab filter
      if (selectedTab === "jtm" && item.volJtm <= 0) return false;
      if (selectedTab === "gardu" && item.volGardu <= 0) return false;
      if (selectedTab === "jtr" && item.volJtr <= 0) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchRow = item.row.toString().includes(q);
        const matchSub = item.subsection?.toLowerCase().includes(q);
        return matchDesc || matchRow || matchSub;
      }
      return true;
    });
  }, [rabSummary.items, selectedTab, searchQuery]);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log("[RabExportModal] File template dipilih:", file.name, file.size, "bytes");
      setUploadedFile(file);
      setExportError(null);
    }
  };

  const handleExport = async () => {
    if (!uploadedFile) {
      setExportError("Silakan upload file template RAB terlebih dahulu (Template_RAB_KHS_2026_UP3_Kupang.xlsx).");
      fileInputRef.current?.click();
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      console.log("[RabExportModal] Memulai ekspor dengan file template:", uploadedFile.name);
      const buffer = await uploadedFile.arrayBuffer();

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `RAB_PLN_UP3_Kupang_${projectName.replace(/\s+/g, "_")}_${timestamp}.xlsx`;

      const excelBlob = await exportRabToExcel(buffer, rabSummary, projectName);
      triggerExcelDownload(excelBlob, filename);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (err: any) {
      console.error("[RabExportModal] Export error:", err);
      setExportError(err?.message || "Gagal melakukan ekspor Excel. Pastikan template valid.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3500] flex items-center justify-center p-3 sm:p-4 md:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/80 animate-in fade-in zoom-in-95 duration-200">

        {/* ─── Header ─── */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 px-6 py-5 flex-shrink-0 text-white">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shadow-inner">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                    RAB Auto-Fill UP3 Kupang
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 uppercase tracking-wide">
                    KHS 2026
                  </span>
                </div>
                <p className="text-xs text-emerald-200/80 font-medium mt-0.5">
                  Perhitungan otomatis volume item RAB berdasarkan geometri peta & atribut jaringan listrik
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors flex-shrink-0"
              title="Tutup"
            >
              ✕
            </button>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10">
              <span className="text-[10px] uppercase tracking-wider text-emerald-200/90 font-bold block">
                Total Item RAB
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-white">{rabSummary.items.length}</span>
                <span className="text-xs text-emerald-300 font-semibold">baris</span>
              </div>
            </div>

            <div className="bg-blue-500/15 backdrop-blur-sm rounded-2xl p-3 border border-blue-400/20">
              <span className="text-[10px] uppercase tracking-wider text-blue-200 font-bold block">
                JTM (Kolom F)
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-blue-200">{rabSummary.totalJtmItems}</span>
                <span className="text-xs text-blue-300/80 font-semibold">item</span>
              </div>
            </div>

            <div className="bg-purple-500/15 backdrop-blur-sm rounded-2xl p-3 border border-purple-400/20">
              <span className="text-[10px] uppercase tracking-wider text-purple-200 font-bold block">
                Gardu (Kolom G)
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-purple-200">{rabSummary.totalGarduItems}</span>
                <span className="text-xs text-purple-300/80 font-semibold">item</span>
              </div>
            </div>

            <div className="bg-amber-500/15 backdrop-blur-sm rounded-2xl p-3 border border-amber-400/20">
              <span className="text-[10px] uppercase tracking-wider text-amber-200 font-bold block">
                JTR (Kolom H)
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-black text-amber-200">{rabSummary.totalJtrItems}</span>
                <span className="text-xs text-amber-300/80 font-semibold">item</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Transparency Notice Banner ─── */}
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base flex-shrink-0">ℹ️</span>
            <span>
              <strong>Transparansi KHS:</strong> Hanya kolom volume <strong>F (JTM)</strong>, <strong>G (Gardu)</strong>, &amp; <strong>H (JTR)</strong> yang diisi.
              Section B (Material Non-Utama) &amp; Section C (Persiapan/Transport) sengaja kosong untuk diisi manual di Excel.
            </span>
          </div>
          {rabSummary.warnings.length > 0 && (
            <button
              onClick={() => setSelectedTab("warnings")}
              className="text-[11px] font-bold text-amber-800 bg-amber-200/80 hover:bg-amber-300 px-2.5 py-1 rounded-lg transition whitespace-nowrap flex-shrink-0"
            >
              ⚠️ {rabSummary.warnings.length} Catatan Validasi
            </button>
          )}
        </div>

        {/* ─── Main Content / Preview Table Area ─── */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4 min-h-0">

          {/* Search & Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-shrink-0">
            {/* Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-xs font-bold text-slate-600">
              <button
                onClick={() => setSelectedTab("all")}
                className={`px-3 py-1.5 rounded-xl transition ${selectedTab === "all" ? "bg-white text-emerald-800 shadow-sm" : "hover:text-slate-900"}`}
              >
                Semua Terisi ({rabSummary.items.length})
              </button>
              <button
                onClick={() => setSelectedTab("jtm")}
                className={`px-3 py-1.5 rounded-xl transition ${selectedTab === "jtm" ? "bg-white text-blue-700 shadow-sm" : "hover:text-slate-900"}`}
              >
                JTM (F) ({rabSummary.totalJtmItems})
              </button>
              <button
                onClick={() => setSelectedTab("gardu")}
                className={`px-3 py-1.5 rounded-xl transition ${selectedTab === "gardu" ? "bg-white text-purple-700 shadow-sm" : "hover:text-slate-900"}`}
              >
                Gardu (G) ({rabSummary.totalGarduItems})
              </button>
              <button
                onClick={() => setSelectedTab("jtr")}
                className={`px-3 py-1.5 rounded-xl transition ${selectedTab === "jtr" ? "bg-white text-amber-700 shadow-sm" : "hover:text-slate-900"}`}
              >
                JTR (H) ({rabSummary.totalJtrItems})
              </button>
              {rabSummary.warnings.length > 0 && (
                <button
                  onClick={() => setSelectedTab("warnings")}
                  className={`px-3 py-1.5 rounded-xl transition ${selectedTab === "warnings" ? "bg-red-50 text-red-700 shadow-sm" : "hover:text-red-700"}`}
                >
                  ⚠️ Validasi ({rabSummary.warnings.length})
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="Cari uraian / baris Excel..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            </div>
          </div>

          {/* Tab Content: Warnings List */}
          {selectedTab === "warnings" ? (
            <div className="flex-1 overflow-y-auto rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-2.5">
              <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                Catatan &amp; Peringatan Validasi Aset
              </h3>
              {rabSummary.warnings.map(w => (
                <div key={w.id} className="bg-white rounded-xl p-3 border border-amber-200/80 shadow-sm text-xs flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                      {w.assetType} {w.layerLabel ? `· ${w.layerLabel}` : ""}
                    </span>
                  </div>
                  <p className="text-slate-700 mt-1">{w.message}</p>
                  {w.recommendation && (
                    <p className="text-[11px] text-emerald-700 font-medium">💡 Saran: {w.recommendation}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Table of Mapped Items */
            <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-inner">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <span className="text-4xl mb-2">📋</span>
                  <p className="text-sm font-semibold">Tidak ada item yang sesuai filter</p>
                  <p className="text-xs mt-1">Pastikan sudah ada tiang atau konduktor yang digambar di peta</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-16 text-center">Row</th>
                      <th className="py-2.5 px-3">Uraian Material / Pekerjaan</th>
                      <th className="py-2.5 px-2 w-16 text-center">Satuan</th>
                      <th className="py-2.5 px-3 w-24 text-right text-blue-700 bg-blue-50/50">JTM (F)</th>
                      <th className="py-2.5 px-3 w-24 text-right text-purple-700 bg-purple-50/50">Gardu (G)</th>
                      <th className="py-2.5 px-3 w-24 text-right text-amber-700 bg-amber-50/50">JTR (H)</th>
                      <th className="py-2.5 px-3">Sumber Geometri</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map(item => (
                      <tr key={item.row} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-500 bg-slate-50/40">
                          {item.row}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          <div>{item.description}</div>
                          {item.subsection && (
                            <span className="text-[10px] font-medium text-slate-400 block mt-0.5">
                              {item.subsection}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500 font-medium">
                          {item.satuan}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 bg-blue-50/30">
                          {item.volJtm > 0 ? item.volJtm.toLocaleString("id-ID") : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-purple-700 bg-purple-50/30">
                          {item.volGardu > 0 ? item.volGardu.toLocaleString("id-ID") : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-700 bg-amber-50/30">
                          {item.volJtr > 0 ? item.volJtr.toLocaleString("id-ID") : "—"}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-500 max-w-xs truncate" title={item.details.join("; ")}>
                          {item.details.slice(0, 2).join(", ")}
                          {item.details.length > 2 ? ` (+${item.details.length - 2} lagi)` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>

        {/* ─── Footer: Template File & Export Action ─── */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 flex-shrink-0">

          {/* Template Selection */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              onChange={handleFileChange}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition shadow-sm ${
                uploadedFile
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  : "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 animate-pulse"
              }`}
            >
              <span>📁</span>
              {uploadedFile ? "Ganti Template Excel..." : "Upload Template Excel (Template_RAB_KHS_2026_UP3_Kupang.xlsx)"}
            </button>

            {uploadedFile ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300">
                <span>✓</span>
                <span className="truncate max-w-[220px]" title={uploadedFile.name}>
                  {uploadedFile.name}
                </span>
                <span className="text-[10px] text-emerald-600">
                  ({Math.round(uploadedFile.size / 1024)} KB)
                </span>
                <button
                  onClick={() => { setUploadedFile(null); setExportError(null); }}
                  className="text-slate-400 hover:text-red-500 ml-1 font-bold"
                  title="Hapus template"
                >
                  ✕
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                <span>⚠️</span> Template asli wajib di-upload sebelum ekspor
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {exportError && (
              <span className="text-xs font-bold text-red-600 truncate max-w-xs">{exportError}</span>
            )}
            {exportSuccess && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <span>🎉</span> Berhasil diunduh!
              </span>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
            >
              Batal
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting || rabSummary.items.length === 0 || !uploadedFile}
              title={!uploadedFile ? "Silakan upload file template RAB terlebih dahulu" : "Ekspor volume ke template Excel"}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition shadow-lg ${
                isExporting || rabSummary.items.length === 0 || !uploadedFile
                  ? "bg-slate-300 cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 shadow-emerald-600/30 hover:shadow-emerald-600/50 hover:-translate-y-0.5 active:translate-y-0"
              }`}
            >
              {isExporting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Menyusun Excel...</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Ekspor Excel RAB Terisi</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
