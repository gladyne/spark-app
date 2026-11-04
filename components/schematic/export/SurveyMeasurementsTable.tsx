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
 * 
 * Kontras tinggi, anti-terpotong, tinggi baris dinamis dihitung dari jumlah baris.
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
  const bebanUtama = p?.bebanJalurRows?.find((r) => r.id === "bj_utama") || p?.bebanJalurRows?.[0];
  // Baris Beban Jurusan
  const bebanJurusanList = p?.bebanJalurRows?.filter((r) => r.id !== "bj_utama") || [];

  // Baris Tegangan Utama
  const teganganUtama = p?.teganganPangkalRows?.find((r) => r.id === "tp_utama") || p?.teganganPangkalRows?.[0];
  // Baris Tegangan Jurusan
  const teganganJurusanList = p?.teganganPangkalRows?.filter((r) => r.id !== "tp_utama") || [];

  const thStyle: React.CSSProperties = {
    backgroundColor: "#f1f5f9",
    color: "#0f172a",
    borderColor: "#0f172a",
  };

  const tdStyle: React.CSSProperties = {
    backgroundColor: "#ffffff",
    color: "#0f172a",
    borderColor: "#0f172a",
  };

  if (isLandscape) {
    // ─── Tampilan Halaman 2 (Landscape A2) ───
    return (
      <div
        className={`border-2 border-slate-950 bg-white p-2.5 text-slate-950 font-sans select-none flex flex-col justify-start text-[9.5px] leading-normal w-full ${className}`}
        style={{
          backgroundColor: "#ffffff",
          color: "#0f172a",
          borderColor: "#0f172a",
          minHeight: "fit-content",
        }}
      >
        {/* 2. DATA PENGUKURAN GARDU */}
        <div className="mb-2">
          <div className="font-black text-[11px] uppercase tracking-tight text-slate-950 border-b-2 border-slate-950 pb-1 mb-1.5 flex items-center justify-between">
            <span>2. DATA PENGUKURAN GARDU : {kodeGardu || "__________"}</span>
          </div>

          <table className="w-full border-collapse border-2 border-slate-950 text-center text-[9.5px] leading-tight">
            <thead>
              <tr style={thStyle} className="border-b-2 border-slate-950">
                <th style={thStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-black text-slate-950">
                  BEBAN JALUR
                </th>
                <th style={thStyle} className="border-r border-slate-950 p-1 w-12 font-black text-slate-950">
                  R (A)
                </th>
                <th style={thStyle} className="border-r border-slate-950 p-1 w-12 font-black text-slate-950">
                  S (A)
                </th>
                <th style={thStyle} className="border-r border-slate-950 p-1 w-12 font-black text-slate-950">
                  T (A)
                </th>
                <th style={thStyle} className="p-1 w-12 font-black text-slate-950">
                  N (A)
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Beban Utama */}
              <tr className="border-b border-slate-950">
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-bold text-left pl-1.5 text-slate-950">
                  BEBAN UTAMA
                </td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bebanUtama?.r)}</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bebanUtama?.s)}</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bebanUtama?.t)}</td>
                <td style={tdStyle} className="p-1 font-mono font-semibold text-slate-900">{cellVal(bebanUtama?.n)}</td>
              </tr>
              {/* Beban Jurusan */}
              {bebanJurusanList.length === 0 ? (
                <tr className="border-b border-slate-950">
                  <td style={tdStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-medium text-slate-800">
                    BEBAN JURUSAN __________
                  </td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                  <td style={tdStyle} className="p-1 font-mono text-slate-600">-</td>
                </tr>
              ) : (
                bebanJurusanList.map((bj, idx) => (
                  <tr key={bj.id || idx} className="border-b border-slate-950">
                    <td style={tdStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-semibold text-slate-900">
                      BEBAN {bj.nama || "JURUSAN"} {bj.nama.includes("JURUSAN") ? "" : "__________"}
                    </td>
                    <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bj.r)}</td>
                    <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bj.s)}</td>
                    <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bj.t)}</td>
                    <td style={tdStyle} className="p-1 font-mono font-semibold text-slate-900">{cellVal(bj.n)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Tabel Tegangan Pangkal */}
          <table className="w-full border-collapse border-2 border-slate-950 text-center text-[9.5px] leading-tight mt-1.5">
            <thead>
              <tr style={thStyle} className="border-b-2 border-slate-950">
                <th style={thStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-black text-slate-950">
                  TEGANGAN PANGKAL
                </th>
                <th style={thStyle} className="border-r border-slate-950 p-1 w-11 font-black text-slate-950">
                  R-N (V)
                </th>
                <th style={thStyle} className="border-r border-slate-950 p-1 w-11 font-black text-slate-950">
                  S-N (V)
                </th>
                <th style={thStyle} className="border-r border-slate-950 p-1 w-11 font-black text-slate-950">
                  T-N (V)
                </th>
                <th style={thStyle} className="border-r border-slate-950 p-1 w-11 font-black text-slate-950">
                  R - S (V)
                </th>
                <th style={thStyle} className="border-r border-slate-950 p-1 w-11 font-black text-slate-950">
                  R-T (V)
                </th>
                <th style={thStyle} className="p-1 w-11 font-black text-slate-950">
                  S-T (V)
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Tegangan Utama */}
              <tr className="border-b border-slate-950">
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-bold text-left pl-1.5 text-slate-950">
                  UTAMA
                </td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.rn)}</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.sn)}</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.tn)}</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.rs)}</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.rt)}</td>
                <td style={tdStyle} className="p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.st)}</td>
              </tr>
              {/* Tegangan Jurusan */}
              {teganganJurusanList.length === 0 ? (
                <tr className="border-b border-slate-950">
                  <td style={tdStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-medium text-slate-800">
                    JURUSAN __________
                  </td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                  <td style={tdStyle} className="p-1 font-mono text-slate-600">-</td>
                </tr>
              ) : (
                teganganJurusanList.map((tj, idx) => (
                  <tr key={tj.id || idx} className="border-b border-slate-950">
                    <td style={tdStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-semibold text-slate-900">
                      {tj.nama || "JURUSAN"} {tj.nama.includes("JURUSAN") ? "" : "__________"}
                    </td>
                    <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(tj.rn)}</td>
                    <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(tj.sn)}</td>
                    <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(tj.tn)}</td>
                    <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(tj.rs)}</td>
                    <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(tj.rt)}</td>
                    <td style={tdStyle} className="p-1 font-mono font-semibold text-slate-900">{cellVal(tj.st)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 3. DATA PENGUKURAN JTR (Versi Halaman 2) */}
        <div>
          <div className="font-black text-[11px] uppercase tracking-tight text-slate-950 border-b-2 border-slate-950 pb-1 mb-1.5 flex items-center justify-between">
            <span>3. DATA PENGUKURAN JTR : {kodeJtr || "__________"}</span>
          </div>

          <table className="w-full border-collapse border-2 border-slate-950 text-center text-[9.5px] leading-tight">
            <thead>
              <tr style={thStyle} className="border-b border-slate-950">
                <th style={thStyle} colSpan={3} className="border-r border-slate-950 p-1 font-black text-slate-950">
                  TEGANGAN PANGKAL
                </th>
                <th style={thStyle} colSpan={2} className="p-1 font-black text-slate-950">
                  TEGANGAN APP
                </th>
              </tr>
              <tr style={thStyle} className="border-b-2 border-slate-950">
                <th style={thStyle} className="border-r border-slate-950 p-1 w-14 font-black text-slate-950">
                  R-N (V)
                </th>
                <th style={thStyle} className="border-r border-slate-950 p-1 w-14 font-black text-slate-950">
                  S-N (V)
                </th>
                <th style={thStyle} className="border-r border-slate-950 p-1 w-14 font-black text-slate-950">
                  T-N (V)
                </th>
                <th style={thStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-bold text-slate-950">
                  IDPEL : {p?.idpel || "__________"}
                </th>
                <th style={thStyle} className="p-1 w-18 font-mono font-black text-slate-950">
                  {p?.teganganApp ? `${p.teganganApp} V` : "-"}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-950">
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(p?.jtrRn)}</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(p?.jtrSn)}</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(p?.jtrTn)}</td>
                <td style={tdStyle} colSpan={2} className="p-1 bg-white"></td>
              </tr>
              {/* Baris Beban Jurusan JTR */}
              <tr className="border-b border-slate-950 font-bold">
                <td style={tdStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-bold text-slate-950">
                  BEBAN JURUSAN __________
                </td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(p?.jtrJurusanRows?.[0]?.r)}</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(p?.jtrJurusanRows?.[0]?.s)}</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(p?.jtrJurusanRows?.[0]?.t)}</td>
                <td style={tdStyle} className="p-1 font-mono font-semibold text-slate-900">{cellVal(p?.jtrJurusanRows?.[0]?.n)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── Tampilan Halaman 1 (Portrait A2) ───
  return (
    <div
      className={`border-2 border-slate-950 bg-white p-2.5 text-slate-950 font-sans select-none flex flex-col justify-start text-[9.5px] leading-normal w-full ${className}`}
      style={{
        backgroundColor: "#ffffff",
        color: "#0f172a",
        borderColor: "#0f172a",
        minHeight: "fit-content",
      }}
    >
      {/* 1. DATA PENGUKURAN GARDU */}
      <div className="mb-2">
        <div className="font-black text-[11px] uppercase tracking-tight text-slate-950 border-b-2 border-slate-950 pb-1 mb-1.5 flex items-center justify-between">
          <span>1. DATA PENGUKURAN GARDU : {kodeGardu || "__________"}</span>
        </div>

        {/* Tabel Beban Jalur */}
        <table className="w-full border-collapse border-2 border-slate-950 text-center text-[9.5px] mb-1.5">
          <thead>
            <tr style={thStyle} className="border-b-2 border-slate-950">
              <th style={thStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-black text-slate-950">
                BEBAN JALUR
              </th>
              <th style={thStyle} className="border-r border-slate-950 p-1 w-12 font-black text-slate-950">
                R (A)
              </th>
              <th style={thStyle} className="border-r border-slate-950 p-1 w-12 font-black text-slate-950">
                S (A)
              </th>
              <th style={thStyle} className="border-r border-slate-950 p-1 w-12 font-black text-slate-950">
                T (A)
              </th>
              <th style={thStyle} className="p-1 w-12 font-black text-slate-950">
                N (A)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-950">
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-bold text-left pl-1.5 text-slate-950">
                BEBAN UTAMA
              </td>
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bebanUtama?.r)}</td>
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bebanUtama?.s)}</td>
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bebanUtama?.t)}</td>
              <td style={tdStyle} className="p-1 font-mono font-semibold text-slate-900">{cellVal(bebanUtama?.n)}</td>
            </tr>
            {bebanJurusanList.length === 0 ? (
              <tr className="border-b border-slate-950">
                <td style={tdStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-medium text-slate-800">
                  JURUSAN __________
                </td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                <td style={tdStyle} className="p-1 font-mono text-slate-600">-</td>
              </tr>
            ) : (
              bebanJurusanList.map((bj, idx) => (
                <tr key={bj.id || idx} className="border-b border-slate-950">
                  <td style={tdStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-semibold text-slate-900">
                    {bj.nama || "JURUSAN"} {bj.nama.includes("JURUSAN") ? "" : "__________"}
                  </td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bj.r)}</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bj.s)}</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(bj.t)}</td>
                  <td style={tdStyle} className="p-1 font-mono font-semibold text-slate-900">{cellVal(bj.n)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Tabel V Pangkal */}
        <table className="w-full border-collapse border-2 border-slate-950 text-center text-[9.5px]">
          <thead>
            <tr style={thStyle} className="border-b-2 border-slate-950">
              <th style={thStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-black text-slate-950">
                V PANGKAL
              </th>
              <th style={thStyle} className="border-r border-slate-950 p-1 w-10 font-black text-slate-950">
                R-N (V)
              </th>
              <th style={thStyle} className="border-r border-slate-950 p-1 w-10 font-black text-slate-950">
                S-N (V)
              </th>
              <th style={thStyle} className="border-r border-slate-950 p-1 w-10 font-black text-slate-950">
                T-N (V)
              </th>
              <th style={thStyle} className="border-r border-slate-950 p-1 w-10 font-black text-slate-950">
                R - S (V)
              </th>
              <th style={thStyle} className="border-r border-slate-950 p-1 w-10 font-black text-slate-950">
                R-T (V)
              </th>
              <th style={thStyle} className="p-1 w-10 font-black text-slate-950">
                S-T (V)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-950">
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-bold text-left pl-1.5 text-slate-950">
                UTAMA
              </td>
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.rn)}</td>
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.sn)}</td>
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.tn)}</td>
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.rs)}</td>
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.rt)}</td>
              <td style={tdStyle} className="p-1 font-mono font-semibold text-slate-900">{cellVal(teganganUtama?.st)}</td>
            </tr>
            {teganganJurusanList.length === 0 ? (
              <tr className="border-b border-slate-950">
                <td style={tdStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-medium text-slate-800">
                  JURUSAN __________
                </td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono text-slate-600">-</td>
                <td style={tdStyle} className="p-1 font-mono text-slate-600">-</td>
              </tr>
            ) : (
              teganganJurusanList.map((tj, idx) => (
                <tr key={tj.id || idx} className="border-b border-slate-950">
                  <td style={tdStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-semibold text-slate-900">
                    {tj.nama || "JURUSAN"} {tj.nama.includes("JURUSAN") ? "" : "__________"}
                  </td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(tj.rn)}</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(tj.sn)}</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(tj.tn)}</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(tj.rs)}</td>
                  <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(tj.rt)}</td>
                  <td style={tdStyle} className="p-1 font-mono font-semibold text-slate-900">{cellVal(tj.st)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 2. DATA PENGUKURAN JTR */}
      <div>
        <div className="font-black text-[11px] uppercase tracking-tight text-slate-950 border-b-2 border-slate-950 pb-1 mb-1.5 flex items-center justify-between">
          <span>2. DATA PENGUKURAN JTR : {kodeJtr || "__________"}</span>
        </div>

        <table className="w-full border-collapse border-2 border-slate-950 text-center text-[9.5px]">
          <thead>
            <tr style={thStyle} className="border-b-2 border-slate-950">
              <th style={thStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-black text-slate-950">
                V PANGKAL
              </th>
              <th style={thStyle} className="border-r border-slate-950 p-1 w-14 font-black text-slate-950">
                R-N (V)
              </th>
              <th style={thStyle} className="border-r border-slate-950 p-1 w-14 font-black text-slate-950">
                S-N (V)
              </th>
              <th style={thStyle} className="p-1 w-14 font-black text-slate-950">
                T-N (V)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-950">
              <td style={tdStyle} className="border-r border-slate-950 p-1 text-left pl-1.5 font-semibold text-slate-900">
                JURUSAN __________
              </td>
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(p?.jtrRn)}</td>
              <td style={tdStyle} className="border-r border-slate-950 p-1 font-mono font-semibold text-slate-900">{cellVal(p?.jtrSn)}</td>
              <td style={tdStyle} className="p-1 font-mono font-semibold text-slate-900">{cellVal(p?.jtrTn)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
