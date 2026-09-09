"use client";

import React from "react";
import type { SchematicKop } from "../../types/schematic";

interface Props {
  kop: SchematicKop;
  onChange: (updated: Partial<SchematicKop>) => void;
  isPrinting?: boolean;
}

export default function KopGambar({ kop, onChange, isPrinting = false }: Props) {
  return (
    <div className="w-full bg-white border-2 border-slate-800 text-slate-900 font-sans text-xs select-none">
      <div className="grid grid-cols-12 divide-x-2 divide-slate-800">
        {/* ─── Kolom 1: Logo PLN Resmi ─── */}
        <div className="col-span-3 p-2.5 flex items-center gap-2.5 bg-slate-50/70">
          {/* Official PLN SVG Logo */}
          <div className="w-11 h-13 flex-shrink-0 flex items-center justify-center bg-amber-400 p-1 rounded-sm border border-slate-700 shadow-xs">
            <svg viewBox="0 0 100 125" className="w-full h-full">
              {/* Petir merah */}
              <polygon points="58,10 24,65 52,65 42,115 76,55 50,55" fill="#DC2626" stroke="#991B1B" strokeWidth="2" />
              {/* Tiga gelombang air biru */}
              <path d="M15,95 Q50,85 85,95" fill="none" stroke="#2563EB" strokeWidth="6" strokeLinecap="round" />
              <path d="M20,105 Q50,95 80,105" fill="none" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" />
              <path d="M25,115 Q50,105 75,115" fill="none" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="font-black text-[13px] tracking-tight text-slate-900 leading-tight">
              PT PLN (PERSERO)
            </span>
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
              DISTRIBUSI NTT
            </span>
            {isPrinting ? (
              <span className="text-[9px] font-semibold text-slate-600 truncate">{kop.unit}</span>
            ) : (
              <input
                type="text"
                value={kop.unit}
                onChange={(e) => onChange({ unit: e.target.value })}
                className="text-[9px] font-semibold text-slate-600 border-b border-dashed border-slate-300 outline-none bg-transparent hover:border-slate-500 focus:border-blue-500 py-0.2"
                title="Klik untuk ubah nama unit PLN"
              />
            )}
          </div>
        </div>

        {/* ─── Kolom 2: Judul Pekerjaan & Lokasi ─── */}
        <div className="col-span-5 p-2.5 flex flex-col justify-center text-center bg-white">
          <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
            GAMBAR RENCANA / SINGLE LINE DIAGRAM
          </span>

          {isPrinting ? (
            <h3 className="font-black text-sm text-slate-950 uppercase tracking-tight mt-0.5">
              {kop.namaPekerjaan || "PENYAMBUNGAN BARU LISTRIK"}
            </h3>
          ) : (
            <input
              type="text"
              value={kop.namaPekerjaan}
              onChange={(e) => onChange({ namaPekerjaan: e.target.value })}
              placeholder="Masukkan Judul Pekerjaan / Pelanggan..."
              className="font-black text-sm text-slate-950 uppercase tracking-tight text-center border-b border-dashed border-slate-300 hover:border-slate-500 focus:border-blue-500 outline-none bg-transparent py-0.5 mt-0.5"
              title="Klik untuk ubah judul pekerjaan"
            />
          )}

          <div className="flex items-center justify-center gap-3 text-[10px] text-slate-600 mt-1">
            <span>Skala: <strong>{kop.skala}</strong></span>
            <span>•</span>
            <span>Ukuran: <strong>{kop.ukuranKertas}</strong></span>
          </div>
        </div>

        {/* ─── Kolom 3: Tabel Paraf & Persetujuan ─── */}
        <div className="col-span-4 grid grid-cols-3 divide-x divide-slate-800 text-center text-[10px]">
          {/* Disurvey */}
          <div className="flex flex-col justify-between p-1.5 bg-slate-50/50">
            <span className="font-bold text-[9px] text-slate-600 uppercase">DIGAMBAR</span>
            <div className="h-6 flex items-center justify-center text-[11px] text-slate-400 italic">
              (Paraf)
            </div>
            {isPrinting ? (
              <span className="font-bold truncate text-[10px]">{kop.disurveyOleh || "Petugas Survey"}</span>
            ) : (
              <input
                type="text"
                value={kop.disurveyOleh}
                onChange={(e) => onChange({ disurveyOleh: e.target.value })}
                className="text-center font-bold text-[10px] border-b border-dashed border-slate-200 hover:border-slate-400 outline-none bg-transparent py-0.2"
                placeholder="Nama"
              />
            )}
            <span className="text-[8px] text-slate-400">{kop.tglSurvey || new Date().toISOString().slice(0, 10)}</span>
          </div>

          {/* Diperiksa */}
          <div className="flex flex-col justify-between p-1.5 bg-slate-50/50">
            <span className="font-bold text-[9px] text-slate-600 uppercase">DIPERIKSA</span>
            <div className="h-6 flex items-center justify-center text-[11px] text-slate-400 italic">
              (Paraf)
            </div>
            {isPrinting ? (
              <span className="font-bold truncate text-[10px]">{kop.diperiksaOleh || "TL TEKNIK"}</span>
            ) : (
              <input
                type="text"
                value={kop.diperiksaOleh}
                onChange={(e) => onChange({ diperiksaOleh: e.target.value })}
                className="text-center font-bold text-[10px] border-b border-dashed border-slate-200 hover:border-slate-400 outline-none bg-transparent py-0.2"
                placeholder="Nama"
              />
            )}
            <span className="text-[8px] text-slate-400">{kop.tglPeriksa || new Date().toISOString().slice(0, 10)}</span>
          </div>

          {/* Disetujui */}
          <div className="flex flex-col justify-between p-1.5 bg-slate-50/50">
            <span className="font-bold text-[9px] text-slate-600 uppercase">DISETUJUI</span>
            <div className="h-6 flex items-center justify-center text-[11px] text-slate-400 italic">
              (Paraf)
            </div>
            {isPrinting ? (
              <span className="font-bold truncate text-[10px]">{kop.disetujuiOleh || "MULP KUPANG"}</span>
            ) : (
              <input
                type="text"
                value={kop.disetujuiOleh}
                onChange={(e) => onChange({ disetujuiOleh: e.target.value })}
                className="text-center font-bold text-[10px] border-b border-dashed border-slate-200 hover:border-slate-400 outline-none bg-transparent py-0.2"
                placeholder="Nama"
              />
            )}
            <span className="text-[8px] text-slate-400">{kop.tglSetuju || new Date().toISOString().slice(0, 10)}</span>
          </div>
        </div>
      </div>

      {/* ─── Bottom Sub-bar: Nomor Gambar ─── */}
      <div className="border-t-2 border-slate-800 bg-slate-100 px-3 py-1 flex items-center justify-between text-[10px] font-bold">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 uppercase">NOMOR GAMBAR:</span>
          {isPrinting ? (
            <span className="font-mono text-slate-900">{kop.nomorGambar || "01/SKEMATIK/ULP-KPG/2026"}</span>
          ) : (
            <input
              type="text"
              value={kop.nomorGambar}
              onChange={(e) => onChange({ nomorGambar: e.target.value })}
              className="font-mono font-bold text-slate-900 border-b border-dashed border-slate-300 hover:border-slate-500 outline-none bg-transparent py-0.2"
            />
          )}
        </div>

        <div className="text-slate-500 font-medium text-[9px]">
          LAMPIRAN FORMULIR SPARK — RAB AUTO-FILL KHS 2026
        </div>
      </div>
    </div>
  );
}
