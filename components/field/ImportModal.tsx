"use client";

import React, { useState, useRef } from "react";
import { parseImportFile } from "../../lib/parsers/importParser";
import { useOfflineStore } from "../../hooks/useOfflineStore";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { importAssets } = useOfflineStore();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
  };

  const processFiles = async (files: FileList | File[]) => {
    setLoading(true);
    setErrorMsg("");
    setSuccessCount(null);

    try {
      const allAssets: any[] = [];
      const errors: string[] = [];
      let totalParsedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const parsedAssets = await parseImportFile(file);
          if (parsedAssets.length > 0) {
            allAssets.push(...parsedAssets);
            totalParsedCount += parsedAssets.length;
          }
        } catch (e: any) {
          console.error(`Failed to parse file ${file.name}:`, e);
          errors.push(`${file.name}: ${e.message || "format tidak valid"}`);
        }
      }

      if (allAssets.length > 0) {
        await importAssets(allAssets);
        setSuccessCount(totalParsedCount);
      } else if (errors.length > 0) {
        throw new Error("Semua file gagal di-import.");
      } else {
        throw new Error("Tidak ada aset valid yang berhasil di-parse.");
      }

      if (errors.length > 0) {
        setErrorMsg(`Beberapa file gagal di-import:\n${errors.join("\n")}`);
      }
    } catch (error: any) {
      console.error("Import failed:", error);
      setErrorMsg(error.message || "Gagal mengimpor file. Pastikan format file sesuai.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-[1002] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Import Aset Lapangan</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors focus:outline-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-6 flex-1 overflow-y-auto space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            Unggah file koordinat aset kelistrikan eksisting. Format yang didukung:
          </p>

          {/* Supported Format Tags */}
          <div className="flex flex-wrap gap-1.5 pb-2">
            <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-50 text-sky-700 rounded border border-sky-100 font-mono">.CSV</span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 font-mono">.KMZ</span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-50 text-violet-700 rounded border border-violet-100 font-mono">.KML</span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-50 text-teal-700 rounded border border-teal-100 font-mono">.SHP</span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100 font-mono">.ZIP (SHP+DBF)</span>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.kml,.kmz,.shp,.zip"
            multiple
            className="hidden"
          />

          {/* Drag & Drop Zone */}
          <button
            onClick={triggerFileSelect}
            disabled={loading}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-all duration-200 touch-manipulation focus:outline-none disabled:opacity-50 ${
              isDragging
                ? "border-sky-500 bg-sky-100/90 scale-[1.02] shadow-md shadow-sky-100"
                : "border-sky-200 hover:border-sky-400 bg-sky-50/50 hover:bg-sky-50/80 active:bg-sky-50"
            }`}
          >
            {loading ? (
              <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-sky-600 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v12m0-12c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25" />
                </svg>
              </div>
            )}
            <div className="text-center">
              <span className="text-xs font-bold text-sky-700 block">Pilih berkas untuk diunggah</span>
              <span className="text-[10px] text-gray-400 block mt-0.5">Ketuk di sini untuk memilih dari galeri file</span>
            </div>
          </button>

          {/* Status Messages */}
          {loading && (
            <p className="text-center text-xs text-sky-600 font-semibold animate-pulse">
              Memproses & menyimpan data ke database lokal...
            </p>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 flex gap-2 items-start text-xs leading-relaxed">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <span className="font-bold block">Gagal mengimpor file:</span>
                {errorMsg}
              </div>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex gap-2 items-start text-xs leading-relaxed">
              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-bold block">Import Sukses!</span>
                Berhasil mengimpor dan menyimpan <span className="font-bold">{successCount}</span> aset kelistrikan eksisting secara offline.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full h-11 bg-gray-100 active:bg-gray-200 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs touch-manipulation focus:outline-none"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
