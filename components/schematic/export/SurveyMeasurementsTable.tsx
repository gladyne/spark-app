"use client";

import React from "react";
import type { SurveyPengukuranData } from "../../../types/schematic";

interface Props {
  pengukuran?: SurveyPengukuranData;
  isLandscape?: boolean;
  className?: string;
}

/**
 * Tabel Pengukuran Gardu & JTR untuk Gambar Survei UP3 Kupang (A2).
 * Sesuai referensi:
 * - Portrait: Mengikuti Halaman 1
 * - Landscape: Mengikuti Halaman 2 (dengan kolom Tegangan APP + IDPEL & Beban Jurusan)
 */
export default function SurveyMeasurementsTable({
  pengukuran,
  isLandscape = false,
  className = "",
}: Props) {
  const p = pengukuran;
  const kodeGardu = p?.kodeGardu || "";
  const kodeJtr = p?.kodeJtr || "";

  // Helper render nilai sel
  const cellVal = (v?: string) => {
    if (!v || v.trim() === "") return "-";
    return v;
  };

  // Baris Beban Utama
  const bebanUtama = p?.bebanJalurRows?.find(r => r.id === "bj_utama") || p?.bebanJalurRows?.[0];
  // Baris Beban Jurusan
  const bebanJurusanList = p?.bebanJalurRows?.filter(r => r.id !== "bj_utama") || [];

  // Baris Tegangan Utama
  const teganganUtama = p?.teganganPangkalRows?.find(r => r.id === "tp_utama") || p?.teganganPangkalRows?.[0];
  // Baris Tegangan Jurusan
  const teganganJurusanList = p?.teganganPangkalRows?.filter(r => r.id !== "tp_utama") || [];

  if (isLandscape) {
    // ─── Tampilan Halaman 2 (Landscape A2) ───
    return (
      <div className={`border border-slate-900 bg-white p-2 text-slate-900 font-sans select-none flex flex-col justify-between text-[9px] ${className}`}>
        {/* 2. DATA PENGUKURAN GARDU */}
        <div className="mb-2">
          <div className="font-extrabold text-[10px] uppercase tracking-tight text-slate-900 border-b border-slate-800 pb-0.5 mb-1 flex items-center justify-between">
            <span>2. DATA PENGUKURAN GARDU : {kodeGardu || "__________"}</span>
          </div>

          <table className="w-full border-collapse border border-slate-900 text-center text-[9px] leading-tight">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-900">
                <th className="border-r border-slate-900 p-0.5 text-left pl-1">BEBAN JALUR</th>
                <th className="border-r border-slate-900 p-0.5 w-11">R (A)</th>
                <th className="border-r border-slate-900 p-0.5 w-11">S (A)</th>
                <th className="border-r border-slate-900 p-0.5 w-11">T (A)</th>
                <th className="p-0.5 w-11">N (A)</th>
              </tr>
            </thead>
            <tbody>
              {/* Beban Utama */}
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-0.5 font-bold text-left pl-1">BEBAN UTAMA</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(bebanUtama?.r)}</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(bebanUtama?.s)}</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(bebanUtama?.t)}</td>
                <td className="p-0.5 font-mono">{cellVal(bebanUtama?.n)}</td>
              </tr>
              {/* Beban Jurusan */}
              {bebanJurusanList.length === 0 ? (
                <tr className="border-b border-slate-900">
                  <td className="border-r border-slate-900 p-0.5 text-left pl-1 font-semibold text-slate-700">BEBAN JURUSAN __________</td>
                  <td className="border-r border-slate-900 p-0.5 font-mono">-</td>
                  <td className="border-r border-slate-900 p-0.5 font-mono">-</td>
                  <td className="border-r border-slate-900 p-0.5 font-mono">-</td>
                  <td className="p-0.5 font-mono">-</td>
                </tr>
              ) : (
                bebanJurusanList.map((bj, idx) => (
                  <tr key={bj.id || idx} className="border-b border-slate-900">
                    <td className="border-r border-slate-900 p-0.5 text-left pl-1 font-semibold">
                      BEBAN {bj.nama || "JURUSAN"} {bj.nama.includes("JURUSAN") ? "" : "__________"}
                    </td>
                    <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(bj.r)}</td>
                    <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(bj.s)}</td>
                    <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(bj.t)}</td>
                    <td className="p-0.5 font-mono">{cellVal(bj.n)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Tabel Tegangan Pangkal */}
          <table className="w-full border-collapse border border-slate-900 text-center text-[9px] leading-tight mt-1">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-900">
                <th className="border-r border-slate-900 p-0.5 text-left pl-1">TEGANGAN PANGKAL</th>
                <th className="border-r border-slate-900 p-0.5 w-10">R-N (V)</th>
                <th className="border-r border-slate-900 p-0.5 w-10">S-N (V)</th>
                <th className="border-r border-slate-900 p-0.5 w-10">T-N (V)</th>
                <th className="border-r border-slate-900 p-0.5 w-10">R - S (V)</th>
                <th className="border-r border-slate-900 p-0.5 w-10">R-T (V)</th>
                <th className="p-0.5 w-10">S-T (V)</th>
              </tr>
            </thead>
            <tbody>
              {/* Tegangan Utama */}
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-0.5 font-bold text-left pl-1">UTAMA</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(teganganUtama?.rn)}</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(teganganUtama?.sn)}</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(teganganUtama?.tn)}</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(teganganUtama?.rs)}</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(teganganUtama?.rt)}</td>
                <td className="p-0.5 font-mono">{cellVal(teganganUtama?.st)}</td>
              </tr>
              {/* Tegangan Jurusan */}
              {teganganJurusanList.length === 0 ? (
                <tr className="border-b border-slate-900">
                  <td className="border-r border-slate-900 p-0.5 text-left pl-1 font-semibold text-slate-700">JURUSAN __________</td>
                  <td className="border-r border-slate-900 p-0.5 font-mono">-</td>
                  <td className="border-r border-slate-900 p-0.5 font-mono">-</td>
                  <td className="border-r border-slate-900 p-0.5 font-mono">-</td>
                  <td className="border-r border-slate-900 p-0.5 font-mono">-</td>
                  <td className="border-r border-slate-900 p-0.5 font-mono">-</td>
                  <td className="p-0.5 font-mono">-</td>
                </tr>
              ) : (
                teganganJurusanList.map((tj, idx) => (
                  <tr key={tj.id || idx} className="border-b border-slate-900">
                    <td className="border-r border-slate-900 p-0.5 text-left pl-1 font-semibold">
                      {tj.nama || "JURUSAN"} {tj.nama.includes("JURUSAN") ? "" : "__________"}
                    </td>
                    <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(tj.rn)}</td>
                    <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(tj.sn)}</td>
                    <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(tj.tn)}</td>
                    <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(tj.rs)}</td>
                    <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(tj.rt)}</td>
                    <td className="p-0.5 font-mono">{cellVal(tj.st)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 3. DATA PENGUKURAN JTR (Versi Halaman 2) */}
        <div>
          <div className="font-extrabold text-[10px] uppercase tracking-tight text-slate-900 border-b border-slate-800 pb-0.5 mb-1 flex items-center justify-between">
            <span>3. DATA PENGUKURAN JTR : {kodeJtr || "__________"}</span>
          </div>

          <table className="w-full border-collapse border border-slate-900 text-center text-[9px] leading-tight">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-900">
                <th colSpan={3} className="border-r border-slate-900 p-0.5">TEGANGAN PANGKAL</th>
                <th colSpan={2} className="p-0.5">TEGANGAN APP</th>
              </tr>
              <tr className="bg-slate-50 border-b border-slate-900">
                <th className="border-r border-slate-900 p-0.5 w-14">R-N (V)</th>
                <th className="border-r border-slate-900 p-0.5 w-14">S-N (V)</th>
                <th className="border-r border-slate-900 p-0.5 w-14">T-N (V)</th>
                <th className="border-r border-slate-900 p-0.5 text-left pl-1">IDPEL : {p?.idpel || "__________"}</th>
                <th className="p-0.5 w-16 font-mono font-bold">{p?.teganganApp ? `${p.teganganApp} V` : "-"}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(p?.jtrRn)}</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(p?.jtrSn)}</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(p?.jtrTn)}</td>
                <td colSpan={2} className="p-0.5 bg-slate-50/50"></td>
              </tr>
              {/* Baris Beban Jurusan JTR */}
              <tr className="border-b border-slate-900 bg-slate-100/60 font-bold">
                <td className="border-r border-slate-900 p-0.5 text-left pl-1">BEBAN JURUSAN __________</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(p?.jtrJurusanRows?.[0]?.r)}</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(p?.jtrJurusanRows?.[0]?.s)}</td>
                <td className="border-r border-slate-900 p-0.5 font-mono">{cellVal(p?.jtrJurusanRows?.[0]?.t)}</td>
                <td className="p-0.5 font-mono">{cellVal(p?.jtrJurusanRows?.[0]?.n)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── Tampilan Halaman 1 (Portrait A2) ───
  return (
    <div className={`border border-slate-900 bg-white p-2.5 text-slate-900 font-sans select-none flex flex-col justify-between text-[9.5px] leading-tight ${className}`}>
      {/* 1. DATA PENGUKURAN GARDU */}
      <div className="mb-2.5">
        <div className="font-extrabold text-[10.5px] uppercase tracking-tight text-slate-900 border-b border-slate-800 pb-0.5 mb-1.5 flex items-center justify-between">
          <span>1. DATA PENGUKURAN GARDU : {kodeGardu || "__________"}</span>
        </div>

        {/* Tabel Beban Jalur */}
        <table className="w-full border-collapse border border-slate-900 text-center text-[9px] mb-1.5">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-slate-900">
              <th className="border-r border-slate-900 p-1 text-left pl-1.5">BEBAN JALUR</th>
              <th className="border-r border-slate-900 p-1 w-11">R (A)</th>
              <th className="border-r border-slate-900 p-1 w-11">S (A)</th>
              <th className="border-r border-slate-900 p-1 w-11">T (A)</th>
              <th className="p-1 w-11">N (A)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-900">
              <td className="border-r border-slate-900 p-1 font-bold text-left pl-1.5">BEBAN UTAMA</td>
              <td className="border-r border-slate-900 p-1 font-mono">{cellVal(bebanUtama?.r)}</td>
              <td className="border-r border-slate-900 p-1 font-mono">{cellVal(bebanUtama?.s)}</td>
              <td className="border-r border-slate-900 p-1 font-mono">{cellVal(bebanUtama?.t)}</td>
              <td className="p-1 font-mono">{cellVal(bebanUtama?.n)}</td>
            </tr>
            {bebanJurusanList.length === 0 ? (
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-1 text-left pl-1.5 font-semibold text-slate-700">JURUSAN __________</td>
                <td className="border-r border-slate-900 p-1 font-mono">-</td>
                <td className="border-r border-slate-900 p-1 font-mono">-</td>
                <td className="border-r border-slate-900 p-1 font-mono">-</td>
                <td className="p-1 font-mono">-</td>
              </tr>
            ) : (
              bebanJurusanList.map((bj, idx) => (
                <tr key={bj.id || idx} className="border-b border-slate-900">
                  <td className="border-r border-slate-900 p-1 text-left pl-1.5 font-semibold">
                    {bj.nama || "JURUSAN"} {bj.nama.includes("JURUSAN") ? "" : "__________"}
                  </td>
                  <td className="border-r border-slate-900 p-1 font-mono">{cellVal(bj.r)}</td>
                  <td className="border-r border-slate-900 p-1 font-mono">{cellVal(bj.s)}</td>
                  <td className="border-r border-slate-900 p-1 font-mono">{cellVal(bj.t)}</td>
                  <td className="p-1 font-mono">{cellVal(bj.n)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Tabel V Pangkal */}
        <table className="w-full border-collapse border border-slate-900 text-center text-[9px]">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-slate-900">
              <th className="border-r border-slate-900 p-1 text-left pl-1.5">V PANGKAL</th>
              <th className="border-r border-slate-900 p-1 w-9">R-N (V)</th>
              <th className="border-r border-slate-900 p-1 w-9">S-N (V)</th>
              <th className="border-r border-slate-900 p-1 w-9">T-N (V)</th>
              <th className="border-r border-slate-900 p-1 w-9">R - S (V)</th>
              <th className="border-r border-slate-900 p-1 w-9">R-T (V)</th>
              <th className="p-1 w-9">S-T (V)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-900">
              <td className="border-r border-slate-900 p-1 font-bold text-left pl-1.5">UTAMA</td>
              <td className="border-r border-slate-900 p-1 font-mono">{cellVal(teganganUtama?.rn)}</td>
              <td className="border-r border-slate-900 p-1 font-mono">{cellVal(teganganUtama?.sn)}</td>
              <td className="border-r border-slate-900 p-1 font-mono">{cellVal(teganganUtama?.tn)}</td>
              <td className="border-r border-slate-900 p-1 font-mono">{cellVal(teganganUtama?.rs)}</td>
              <td className="border-r border-slate-900 p-1 font-mono">{cellVal(teganganUtama?.rt)}</td>
              <td className="p-1 font-mono">{cellVal(teganganUtama?.st)}</td>
            </tr>
            {teganganJurusanList.length === 0 ? (
              <tr className="border-b border-slate-900">
                <td className="border-r border-slate-900 p-1 text-left pl-1.5 font-semibold text-slate-700">JURUSAN __________</td>
                <td className="border-r border-slate-900 p-1 font-mono">-</td>
                <td className="border-r border-slate-900 p-1 font-mono">-</td>
                <td className="border-r border-slate-900 p-1 font-mono">-</td>
                <td className="border-r border-slate-900 p-1 font-mono">-</td>
                <td className="border-r border-slate-900 p-1 font-mono">-</td>
                <td className="p-1 font-mono">-</td>
              </tr>
            ) : (
              teganganJurusanList.map((tj, idx) => (
                <tr key={tj.id || idx} className="border-b border-slate-900">
                  <td className="border-r border-slate-900 p-1 text-left pl-1.5 font-semibold">
                    {tj.nama || "JURUSAN"} {tj.nama.includes("JURUSAN") ? "" : "__________"}
                  </td>
                  <td className="border-r border-slate-900 p-1 font-mono">{cellVal(tj.rn)}</td>
                  <td className="border-r border-slate-900 p-1 font-mono">{cellVal(tj.sn)}</td>
                  <td className="border-r border-slate-900 p-1 font-mono">{cellVal(tj.tn)}</td>
                  <td className="border-r border-slate-900 p-1 font-mono">{cellVal(tj.rs)}</td>
                  <td className="border-r border-slate-900 p-1 font-mono">{cellVal(tj.rt)}</td>
                  <td className="p-1 font-mono">{cellVal(tj.st)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 2. DATA PENGUKURAN JTR */}
      <div>
        <div className="font-extrabold text-[10.5px] uppercase tracking-tight text-slate-900 border-b border-slate-800 pb-0.5 mb-1.5 flex items-center justify-between">
          <span>2. DATA PENGUKURAN JTR : {kodeJtr || "__________"}</span>
        </div>

        <table className="w-full border-collapse border border-slate-900 text-center text-[9px]">
          <thead>
            <tr className="bg-slate-100 font-bold border-b border-slate-900">
              <th className="border-r border-slate-900 p-1 text-left pl-1.5">V PANGKAL</th>
              <th className="border-r border-slate-900 p-1 w-14">R-N (V)</th>
              <th className="border-r border-slate-900 p-1 w-14">S-N (V)</th>
              <th className="p-1 w-14">T-N (V)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-900">
              <td className="border-r border-slate-900 p-1 text-left pl-1.5 font-semibold">JURUSAN __________</td>
              <td className="border-r border-slate-900 p-1 font-mono">{cellVal(p?.jtrRn)}</td>
              <td className="border-r border-slate-900 p-1 font-mono">{cellVal(p?.jtrSn)}</td>
              <td className="p-1 font-mono">{cellVal(p?.jtrTn)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
