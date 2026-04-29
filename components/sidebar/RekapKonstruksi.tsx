"use client";
import { useState } from "react";
import type { PoleData, SchoorConfig } from "../../types/spark";

interface Props {
  poles: [number, number][];
  poleData: PoleData[];
  effectiveSchoors: Record<number, SchoorConfig>;
  jenisJaringan: string;
  totalLengthM: number;
}

function getTypeShort(pd: PoleData, jenisJaringan: string): string {
  if (jenisJaringan.includes("SKUTR") || jenisJaringan.includes("Underbuild")) return pd.jtrTypeShort;
  if (jenisJaringan === "SKUTM") return pd.skutmTypeShort;
  if (jenisJaringan === "SKTM" || jenisJaringan === "SKTR") return pd.kabelTypeShort;
  return pd.jtmTypeShort;
}

function formatLength(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

export default function RekapKonstruksi({ poles, poleData, effectiveSchoors, jenisJaringan, totalLengthM }: Props) {
  const [open, setOpen] = useState(false);

  if (poles.length === 0) return null;

  const konstruksiCount: Record<string, number> = {};
  poleData.forEach(pd => {
    const t = getTypeShort(pd, jenisJaringan) || "—";
    konstruksiCount[t] = (konstruksiCount[t] || 0) + 1;
  });

  const schoorValues = Object.values(effectiveSchoors);
  const treckCount = schoorValues.filter(s => s.jenis === "Treck").length;
  const druckCount = schoorValues.filter(s => s.jenis === "Druck").length;
  const kontramastCount = schoorValues.filter(s => s.jenis === "Kontramast").length;
  const totalSchoor = schoorValues.length;

  return (
    <div className="border-2 border-sky-200 rounded-xl bg-sky-50 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-sky-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>📋</span>
          <span className="font-bold text-sky-800 text-sm uppercase tracking-wide">Rekap Konstruksi</span>
        </div>
        <span className="text-sky-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-sky-200">

          {/* Jumlah Tiang + Panjang Penghantar */}
          <div className="flex flex-col gap-1 pt-3">
            <div className="flex justify-between items-center bg-white border border-sky-100 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500 font-semibold">Jumlah Tiang</span>
              <span className="text-sm font-bold text-gray-800">{poles.length} tiang</span>
            </div>
            <div className="flex justify-between items-center bg-white border border-sky-100 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500 font-semibold">Panjang Penghantar</span>
              <span className="text-sm font-bold text-gray-800">{formatLength(totalLengthM)}</span>
            </div>
          </div>

          {/* Data Konstruksi */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1.5">Data Konstruksi</p>
            <div className="flex flex-col gap-1">
              {Object.entries(konstruksiCount).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center bg-white border border-sky-100 rounded-lg px-3 py-1.5">
                  <span className="text-xs font-bold text-sky-700">{type}</span>
                  <span className="text-xs font-semibold text-gray-600">{count} tiang</span>
                </div>
              ))}
            </div>
          </div>

          {/* Schoor */}
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1.5">
              Schoor {totalSchoor > 0 ? `(${totalSchoor} total)` : ""}
            </p>
            {totalSchoor === 0 ? (
              <p className="text-[11px] text-gray-400 italic px-1">Belum ada schoor terpasang</p>
            ) : (
              <div className="flex flex-col gap-1">
                {treckCount > 0 && (
                  <div className="flex justify-between items-center bg-white border border-red-100 rounded-lg px-3 py-1.5">
                    <span className="text-xs font-bold text-red-600">Treck</span>
                    <span className="text-xs font-semibold text-gray-600">{treckCount} tiang</span>
                  </div>
                )}
                {druckCount > 0 && (
                  <div className="flex justify-between items-center bg-white border border-blue-100 rounded-lg px-3 py-1.5">
                    <span className="text-xs font-bold text-blue-600">Druck</span>
                    <span className="text-xs font-semibold text-gray-600">{druckCount} tiang</span>
                  </div>
                )}
                {kontramastCount > 0 && (
                  <div className="flex justify-between items-center bg-white border border-green-100 rounded-lg px-3 py-1.5">
                    <span className="text-xs font-bold text-green-600">Kontramast</span>
                    <span className="text-xs font-semibold text-gray-600">{kontramastCount} tiang</span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
