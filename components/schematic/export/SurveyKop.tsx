"use client";

import React from "react";
import type { SurveyKopData } from "../../../types/schematic";

interface Props {
  kop?: SurveyKopData;
  className?: string;
}

/**
 * Kop Gambar Resmi Gambar Survei UP3 Kupang (A2).
 * Sesuai referensi halaman 1, 2, dan 4:
 * - Logo PLN Resmi (kuning, petir merah, gelombang biru, teks PLN)
 * - Header 3 baris
 * - Kolom Kiri: Data Pelanggan, Alamat, Permohonan, Daya, Keterangan
 * - Kolom Kanan: Titik Koordinat, Nomor Gambar, Revisi, Halaman, Tanggal
 * - 3 Kolom Persetujuan (DISETUJUI / STAFF TEKNIK / Nama)
 */
export default function SurveyKop({ kop, className = "" }: Props) {
  const k = kop;

  const dayaLamaStr = k?.dayaLama ? `${k.dayaLama} kVA (Daya Lama)` : "000 kVA (Daya Lama)";
  const dayaBaruStr = k?.dayaBaru ? `${k.dayaBaru} kVA (Daya Baru)` : "000 kVA (Daya Baru)";
  const dayaDisplay = `${dayaLamaStr} / ${dayaBaruStr}`;

  const col1 = k?.persetujuan?.[0] || { roleTitle: "DISETUJUI", staffTitle: "STAFF TEKNIK", nama: "" };
  const col2 = k?.persetujuan?.[1] || { roleTitle: "DISETUJUI", staffTitle: "STAFF TEKNIK", nama: "" };
  const col3 = k?.persetujuan?.[2] || { roleTitle: "DISETUJUI", staffTitle: "STAFF TEKNIK", nama: "" };

  return (
    <div className={`border border-slate-900 bg-white text-slate-900 font-sans select-none flex flex-col justify-between text-[10px] leading-tight ${className}`}>
      {/* ─── Baris 1: Header Logo & Instansi ─── */}
      <div className="flex border-b border-slate-900">
        {/* Logo PLN Resmi Kotak Kuning */}
        <div className="w-20 p-1.5 flex flex-col items-center justify-center border-r border-slate-900 bg-white flex-shrink-0">
          <div className="w-12 h-14 bg-amber-400 p-1 rounded-xs flex flex-col items-center justify-between border border-slate-800 shadow-xs">
            <svg viewBox="0 0 100 120" className="w-9 h-10">
              {/* Petir Merah */}
              <polygon
                points="56,6 22,60 50,60 40,114 76,50 50,50"
                fill="#dc2626"
                stroke="#991b1b"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* Tiga Gelombang Air Biru */}
              <path d="M12,94 Q50,84 88,94" fill="none" stroke="#2563eb" strokeWidth="6" strokeLinecap="round" />
              <path d="M18,104 Q50,94 82,104" fill="none" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" />
              <path d="M24,114 Q50,104 76,114" fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span className="font-black text-[9.5px] text-blue-700 tracking-wider leading-none mt-0.5">
              PLN
            </span>
          </div>
        </div>

        {/* Teks Instansi & Nama Pekerjaan */}
        <div className="flex-1 p-2 flex flex-col justify-center text-center">
          <h2 className="font-extrabold text-[11px] tracking-tight text-slate-950 uppercase">
            PT PLN (PERSERO) UNIT PELAKSANA PELAYANAN PELANGGAN KUPANG
          </h2>
          <h3 className="font-bold text-[10px] text-slate-800 uppercase tracking-tight">
            UNIT LAYANAN PELANGGAN KUPANG
          </h3>
          <div className="font-black text-[11px] text-slate-950 uppercase mt-1">
            PEKERJAAN KONSTRUKSI JARINGAN DISTRIBUSI {k?.namaPekerjaan || "XXX"}
          </div>
        </div>
      </div>

      {/* ─── Baris 2: Data Pelanggan & Metadata Gambar ─── */}
      <div className="grid grid-cols-12 border-b border-slate-900 text-[9.5px]">
        {/* Kolom Kiri: Data Pelanggan */}
        <div className="col-span-8 p-1.5 border-r border-slate-900 flex flex-col justify-between space-y-0.5">
          <div className="grid grid-cols-[100px_1fr] gap-x-1">
            <span className="font-semibold text-slate-800">Data Pelanggan</span>
            <span>: {k?.dataPelanggan || "-"}</span>
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-x-1">
            <span className="font-semibold text-slate-800">Alamat</span>
            <span>: {k?.alamat || "-"}</span>
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-x-1">
            <span className="font-semibold text-slate-800">Permohonan</span>
            <span>: {k?.permohonan || "-"}</span>
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-x-1">
            <span className="font-semibold text-slate-800">Daya</span>
            <span>: {dayaDisplay}</span>
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-x-1">
            <span className="font-semibold text-slate-800">Keterangan</span>
            <span>: {k?.keterangan || "-"}</span>
          </div>
        </div>

        {/* Kolom Kanan: Nomor Gambar, Revisi, Koordinat, Tanggal */}
        <div className="col-span-4 p-1.5 flex flex-col justify-between space-y-0.5 bg-slate-50/50">
          <div className="grid grid-cols-[85px_1fr] gap-x-1">
            <span className="font-semibold text-slate-800">Titik Koordinat</span>
            <span>: {k?.titikKoordinat || "-"}</span>
          </div>
          <div className="grid grid-cols-[85px_1fr] gap-x-1">
            <span className="font-semibold text-slate-800">Nomor Gambar</span>
            <span>: {k?.nomorGambar || "-"}</span>
          </div>
          <div className="grid grid-cols-[85px_1fr] gap-x-1">
            <span className="font-semibold text-slate-800">Revisi</span>
            <span>: {k?.revisi || "-"}</span>
          </div>
          <div className="grid grid-cols-[85px_1fr] gap-x-1">
            <span className="font-semibold text-slate-800">Halaman</span>
            <span>: {k?.halaman || "1 / 1"}</span>
          </div>
          <div className="grid grid-cols-[85px_1fr] gap-x-1">
            <span className="font-semibold text-slate-800">Tanggal</span>
            <span>: {k?.tanggal || "-"}</span>
          </div>
        </div>
      </div>

      {/* ─── Baris 3: Tiga Kolom Persetujuan ─── */}
      <div className="grid grid-cols-3 divide-x divide-slate-900 text-center text-[9.5px]">
        {/* Kolom 1 */}
        <div className="p-1 flex flex-col justify-between h-18">
          <span className="font-bold text-[9px] uppercase tracking-wide text-slate-900">
            {col1.roleTitle || "DISETUJUI"}
          </span>
          <div className="flex-1 flex items-center justify-center">
            {/* Ruang tanda tangan / paraf kosong */}
          </div>
          <div className="flex flex-col">
            <span className="text-[8.5px] font-semibold text-slate-700 uppercase">
              {col1.staffTitle || "STAFF TEKNIK"}
            </span>
            <span className="font-bold text-[9.5px] uppercase tracking-tight text-slate-950 truncate">
              {col1.nama || "-"}
            </span>
          </div>
        </div>

        {/* Kolom 2 */}
        <div className="p-1 flex flex-col justify-between h-18">
          <span className="font-bold text-[9px] uppercase tracking-wide text-slate-900">
            {col2.roleTitle || "DISETUJUI"}
          </span>
          <div className="flex-1 flex items-center justify-center">
            {/* Ruang tanda tangan / paraf kosong */}
          </div>
          <div className="flex flex-col">
            <span className="text-[8.5px] font-semibold text-slate-700 uppercase">
              {col2.staffTitle || "STAFF TEKNIK"}
            </span>
            <span className="font-bold text-[9.5px] uppercase tracking-tight text-slate-950 truncate">
              {col2.nama || "-"}
            </span>
          </div>
        </div>

        {/* Kolom 3 */}
        <div className="p-1 flex flex-col justify-between h-18">
          <span className="font-bold text-[9px] uppercase tracking-wide text-slate-900">
            {col3.roleTitle || "DISETUJUI"}
          </span>
          <div className="flex-1 flex items-center justify-center">
            {/* Ruang tanda tangan / paraf kosong */}
          </div>
          <div className="flex flex-col">
            <span className="text-[8.5px] font-semibold text-slate-700 uppercase">
              {col3.staffTitle || "STAFF TEKNIK"}
            </span>
            <span className="font-bold text-[9.5px] uppercase tracking-tight text-slate-950 truncate">
              {col3.nama || "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
