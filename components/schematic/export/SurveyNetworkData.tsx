"use client";

import React from "react";
import type { SurveyDataJtm, SurveyDataGardu, SurveyDataJtr } from "../../../types/schematic";

interface Props {
  jtm?: SurveyDataJtm;
  gardu?: SurveyDataGardu;
  jtr?: SurveyDataJtr;
  className?: string;
  isLandscape?: boolean;
}

/**
 * Blok Data Jaringan (JTM, Gardu Distribusi, JTR) sesuai template Gambar Survei UP3 Kupang.
 * Nilai kosong ditampilkan sebagai "-" atau tanda hubung bersih.
 */
export default function SurveyNetworkData({ jtm, gardu, jtr, className = "", isLandscape = false }: Props) {
  const val = (v?: string, suffix: string = "") => {
    if (!v || v.trim() === "") return "-";
    return suffix ? `${v} ${suffix}` : v;
  };

  return (
    <div className={`border border-slate-900 bg-white p-2.5 text-slate-900 font-sans select-none flex flex-col justify-between text-[10px] leading-tight ${className}`}>
      {/* ─── 1. DATA JARINGAN TEGANGAN MENENGAH (PERLUASAN) ─── */}
      <div className="mb-2">
        <h4 className="font-extrabold text-[10.5px] uppercase tracking-tight text-slate-900 border-b border-slate-300 pb-0.5 mb-1">
          DATA JARINGAN TEGANGAN MENENGAH (PERLUASAN)
        </h4>
        <div className="grid grid-cols-[140px_1fr] gap-y-0.5 font-medium pl-1">
          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> NAMA PENYULANG
          </span>
          <span>: {val(jtm?.namaPenyulang)}</span>

          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> TITIK PENGAMBILAN
          </span>
          <span>: {val(jtm?.titikPengambilan)}</span>

          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> KONSTRUKSI PENGAMBILAN
          </span>
          <span>: {val(jtm?.konstruksiPengambilan)}</span>

          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> KONDUKTOR PENGAMBILAN
          </span>
          <span>: {val(jtm?.konduktorPengambilan)}</span>

          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> UKURAN KONDUKTOR
          </span>
          <span>: {val(jtm?.ukuranKonduktor, jtm?.ukuranKonduktor ? "MM" : "")}</span>
        </div>
      </div>

      {/* ─── 2. DATA GARDU DISTRIBUSI ─── */}
      <div className="mb-2">
        <h4 className="font-extrabold text-[10.5px] uppercase tracking-tight text-slate-900 border-b border-slate-300 pb-0.5 mb-1">
          DATA GARDU DISTRIBUSI
        </h4>
        <div className="grid grid-cols-[140px_1fr] gap-y-0.5 font-medium pl-1">
          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> KODE GARDU
          </span>
          <span>: {val(gardu?.kodeGardu)}</span>

          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> KAPASITAS GARDU
          </span>
          <span>: {val(gardu?.kapasitasGardu, gardu?.kapasitasGardu ? "KVA" : "")}</span>

          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> BEBAN GARDU / %
          </span>
          <span>: {val(gardu?.bebanGardu, gardu?.bebanGardu ? "KVA" : "")}</span>

          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> TIPE PHB TR
          </span>
          <span>: {val(gardu?.tipePhbTr, gardu?.tipePhbTr ? "JURUSAN" : "")}</span>
        </div>
      </div>

      {/* ─── 3. DATA JARINGAN TEGANGAN RENDAH (PERLUASAN) ─── */}
      <div>
        <h4 className="font-extrabold text-[10.5px] uppercase tracking-tight text-slate-900 border-b border-slate-300 pb-0.5 mb-1">
          DATA JARINGAN TEGANGAN RENDAH (PERLUASAN)
        </h4>
        <div className="grid grid-cols-[140px_1fr] gap-y-0.5 font-medium pl-1">
          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> JURUSAN PENGAMBILAN
          </span>
          <span>: {val(jtr?.jurusanPengambilan)}</span>

          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> KONSTRUKSI EKSISTING
          </span>
          <span>: {val(jtr?.konstruksiEksisting)}</span>

          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> KABEL POWER EKSISTING
          </span>
          <span>: {val(jtr?.kabelPowerEksisting)}</span>

          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> UKURAN KABEL POWER
          </span>
          <span>: {val(jtr?.ukuranKabelPower)}</span>

          <span className="flex items-center gap-1 font-semibold">
            <span className="text-[9px]">•</span> {isLandscape ? "JARAK GARDU KE PENGAMBILAN" : "JARAK GARDU KE LOKASI"}
          </span>
          <span>: {val(jtr?.jarakGarduKeLokasi, jtr?.jarakGarduKeLokasi ? "KMS" : "")}</span>
        </div>
      </div>
    </div>
  );
}
