"use client";

import React from "react";
import type { SurveyFormData } from "../../../types/schematic";
import SurveyKop from "./SurveyKop";

interface Props {
  surveyData: SurveyFormData;
}

/**
 * Halaman Dokumentasi Lapangan (Landscape A2) - Sesuai Ref Halaman 4.
 * Berisi:
 * - Judul DOKUMENTASI di tengah atas
 * - 3 Kotak Foto Lapangan dengan Caption resmi
 * - Kop PLN resmi di kanan bawah (otomatis sinkron dengan panel isian)
 */
export default function SurveyDocumentationSheet({ surveyData }: Props) {
  const { dokumentasi, kop } = surveyData;

  const renderPhotoBox = (
    caption: string,
    photoDataUrl?: string,
    boxIndex: number = 1
  ) => {
    return (
      <div className="flex-1 flex flex-col items-center">
        {/* Frame Foto Berbingkai Tebal */}
        <div className="w-full flex-1 border-[2.5px] border-slate-950 bg-white relative overflow-hidden flex items-center justify-center p-2 min-h-[560px]">
          {photoDataUrl ? (
            <img
              src={photoDataUrl}
              alt={caption}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
              {/* Kotak kosong tanpa distorsi sesuai referensi halaman 4 */}
            </div>
          )}
        </div>

        {/* Caption Bawah Kotak */}
        <div className="mt-3 font-extrabold text-[12.5px] tracking-wide text-slate-950 uppercase text-center">
          {caption}
        </div>
      </div>
    );
  };

  return (
    <div
      id="survey-documentation-sheet"
      className="w-[1980px] h-[1400px] bg-white text-slate-900 font-sans p-6 box-border flex flex-col justify-between select-none relative overflow-hidden"
      style={{ width: "1980px", height: "1400px" }}
    >
      {/* Double Engineering Border Luar */}
      <div className="absolute inset-4 border-[2.5px] border-slate-950 pointer-events-none" />
      <div className="absolute inset-6 border border-slate-950 pointer-events-none" />

      <div className="w-full h-full p-2 flex flex-col justify-between relative z-10">
        {/* ─── Judul Atas: DOKUMENTASI ─── */}
        <div className="w-full text-center pt-2 pb-5">
          <h1 className="font-black text-[26px] tracking-wider uppercase text-slate-950">
            DOKUMENTASI
          </h1>
        </div>

        {/* ─── 3 Kotak Foto Berjejer ─── */}
        <div className="flex-1 flex items-stretch gap-8 px-4 mb-5">
          {renderPhotoBox(
            "FOTO BANGUNAN PELANGGAN",
            dokumentasi.fotoBangunanPelanggan,
            1
          )}
          {renderPhotoBox(
            "FOTO TITIK PENGAMBILAN",
            dokumentasi.fotoTitikPengambilan,
            2
          )}
          {renderPhotoBox(
            "FOTO LOKASI RENCANA GARSIP",
            dokumentasi.fotoLokasiRencanaGarsip,
            3
          )}
        </div>

        {/* ─── Bagian Bawah: Ruang Kosong (Kiri) & Kop Gambar (Kanan Bawah) ─── */}
        <div className="h-[260px] grid grid-cols-12 gap-4 items-end">
          <div className="col-span-7">
            {/* Area kosong di kiri bawah sesuai ref halaman 4 */}
          </div>
          <div className="col-span-5">
            <SurveyKop kop={kop} className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
