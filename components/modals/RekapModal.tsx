"use client";
import type { PoleData, SchoorConfig, GarduConfig } from "../../types/spark";

interface Props {
  open: boolean;
  onClose: () => void;
  poles: [number, number][];
  poleData: PoleData[];
  effectiveSchoors: Record<number, SchoorConfig>;
  gardus: Record<number, GarduConfig>;
  jenisJaringan: string;
  statusJaringan: string;
  totalLengthM: number;
  tinggiTiang: number;
  materialTiang: string;
  jarakGawang: number;
}

function getTypeFields(pd: PoleData, jenis: string): { short: string; long: string } {
  if (jenis.includes("SKUTR") || jenis.includes("Underbuild")) return { short: pd.jtrTypeShort, long: pd.jtrTypeLong };
  if (jenis === "SKUTM") return { short: pd.skutmTypeShort, long: pd.skutmTypeLong };
  if (jenis === "SKTM" || jenis === "SKTR") return { short: pd.kabelTypeShort, long: pd.kabelTypeLong };
  return { short: pd.jtmTypeShort, long: pd.jtmTypeLong };
}

function formatLength(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km  (${Math.round(m).toLocaleString("id-ID")} m)`;
  return `${Math.round(m)} m`;
}

const KONSTRUKSI_COLOR: Record<string, string> = {
  A1: "bg-blue-50 text-blue-700",
  A2: "bg-yellow-50 text-yellow-700",
  A3: "bg-orange-50 text-orange-700",
  "A3 Pole": "bg-orange-50 text-orange-700",
  "A3 Branch": "bg-purple-50 text-purple-700",
  "2xA3": "bg-red-50 text-red-700",
  B3: "bg-rose-50 text-rose-700",
  S: "bg-sky-50 text-sky-700",
  FDE: "bg-green-50 text-green-700",
  LA: "bg-amber-50 text-amber-700",
  "BDL+DE": "bg-teal-50 text-teal-700",
  Trm: "bg-indigo-50 text-indigo-700",
  "2xTrm": "bg-violet-50 text-violet-700",
  TRM: "bg-gray-50 text-gray-700",
  JNT: "bg-slate-50 text-slate-700",
  "—": "bg-gray-50 text-gray-400",
};

export default function RekapModal({
  open, onClose,
  poles, poleData, effectiveSchoors, gardus,
  jenisJaringan, statusJaringan, totalLengthM,
  tinggiTiang, materialTiang, jarakGawang,
}: Props) {
  if (!open) return null;

  const isArrester = jenisJaringan.includes("SUTM") || jenisJaringan === "SKUTM";
  const arresterCount = poleData.filter(pd => pd.isGrounded).length;

  // Rekap konstruksi: group by type
  const konstruksiMap: Record<string, { long: string; count: number }> = {};
  poleData.forEach(pd => {
    const { short, long } = getTypeFields(pd, jenisJaringan);
    const key = short || "—";
    if (!konstruksiMap[key]) konstruksiMap[key] = { long: long || "—", count: 0 };
    konstruksiMap[key].count++;
  });
  const konstruksiEntries = Object.entries(konstruksiMap).sort((a, b) => b[1].count - a[1].count);

  // Rekap schoor
  const schoorValues = Object.values(effectiveSchoors);
  const treckCount = schoorValues.filter(s => s.jenis === "Treck").length;
  const druckCount = schoorValues.filter(s => s.jenis === "Druck").length;
  const kontramastCount = schoorValues.filter(s => s.jenis === "Kontramast").length;

  // Rekap gardu
  const garduValues = Object.values(gardus);
  const garduCantol = garduValues.filter(g => g.jenis === "Cantol").length;
  const garduPortal = garduValues.filter(g => g.jenis === "Portal").length;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-sky-600 to-blue-700">
          <div>
            <h2 className="text-white font-extrabold text-lg tracking-tight">📋 Rekap Konstruksi Gambar</h2>
            <p className="text-sky-200 text-xs mt-0.5">{jenisJaringan} · {statusJaringan}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-bold transition-colors">
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">

          {/* ─── Ringkasan Umum ─── */}
          <section>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Ringkasan Umum</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Jumlah Tiang", value: `${poles.length} tiang`, color: "text-blue-700" },
                { label: "Panjang Penghantar", value: formatLength(totalLengthM), color: "text-blue-700" },
                { label: "Jarak Gawang", value: `${jarakGawang} m`, color: "text-gray-700" },
                { label: "Tinggi Tiang", value: `${tinggiTiang} m · ${materialTiang}`, color: "text-gray-700" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-gray-400 font-semibold">{label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Data Konstruksi ─── */}
          <section>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Data Konstruksi</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-500 text-[11px] uppercase tracking-wide">
                  <th className="text-left px-3 py-2 rounded-tl-lg font-semibold">Tipe</th>
                  <th className="text-left px-3 py-2 font-semibold">Keterangan</th>
                  <th className="text-right px-3 py-2 rounded-tr-lg font-semibold">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {konstruksiEntries.map(([type, { long, count }], i) => {
                  const colorClass = KONSTRUKSI_COLOR[type] ?? "bg-gray-50 text-gray-700";
                  return (
                    <tr key={type} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colorClass}`}>{type}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-[160px]">{long}</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800 text-sm">{count}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                  <td colSpan={2} className="px-3 py-2 text-xs text-gray-600 uppercase tracking-wide">Total</td>
                  <td className="px-3 py-2 text-right text-blue-700 font-extrabold">{poles.length}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ─── Schoor ─── */}
          <section>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Schoor</h3>
            {schoorValues.length === 0 ? (
              <p className="text-xs text-gray-400 italic px-1">Belum ada schoor terpasang</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-500 text-[11px] uppercase tracking-wide">
                    <th className="text-left px-3 py-2 rounded-tl-lg font-semibold">Jenis</th>
                    <th className="text-left px-3 py-2 font-semibold">Fungsi</th>
                    <th className="text-right px-3 py-2 rounded-tr-lg font-semibold">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {treckCount > 0 && (
                    <tr className="border-t border-gray-100 bg-white">
                      <td className="px-3 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Treck</span></td>
                      <td className="px-3 py-2 text-xs text-gray-500">Kawat tarik keluar</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800">{treckCount}</td>
                    </tr>
                  )}
                  {druckCount > 0 && (
                    <tr className="border-t border-gray-100 bg-gray-50/50">
                      <td className="px-3 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Druck</span></td>
                      <td className="px-3 py-2 text-xs text-gray-500">Tiang dorong ke dalam</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800">{druckCount}</td>
                    </tr>
                  )}
                  {kontramastCount > 0 && (
                    <tr className="border-t border-gray-100 bg-white">
                      <td className="px-3 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">Kontramast</span></td>
                      <td className="px-3 py-2 text-xs text-gray-500">Tiang jangkar seberang</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800">{kontramastCount}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                    <td colSpan={2} className="px-3 py-2 text-xs text-gray-600 uppercase tracking-wide">Total</td>
                    <td className="px-3 py-2 text-right text-blue-700 font-extrabold">{schoorValues.length}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </section>

          {/* ─── Arrester / Grounding ─── */}
          {arresterCount > 0 && (
            <section>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                {isArrester ? "Arrester (Lightning Arrester)" : "Grounding / Arde"}
              </h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-500 text-[11px] uppercase tracking-wide">
                    <th className="text-left px-3 py-2 rounded-tl-lg font-semibold">Komponen</th>
                    <th className="text-right px-3 py-2 rounded-tr-lg font-semibold">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-100 bg-white">
                    <td className="px-3 py-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                        {isArrester ? "⚡ Arrester (LA)" : "⏚ Grounding"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gray-800">{arresterCount}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          {/* ─── Gardu ─── */}
          {garduValues.length > 0 && (
            <section>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Gardu Distribusi</h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-500 text-[11px] uppercase tracking-wide">
                    <th className="text-left px-3 py-2 rounded-tl-lg font-semibold">Jenis</th>
                    <th className="text-right px-3 py-2 rounded-tr-lg font-semibold">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {garduCantol > 0 && (
                    <tr className="border-t border-gray-100 bg-white">
                      <td className="px-3 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">Gardu Cantol</span></td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800">{garduCantol}</td>
                    </tr>
                  )}
                  {garduPortal > 0 && (
                    <tr className="border-t border-gray-100 bg-gray-50/50">
                      <td className="px-3 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">Gardu Portal</span></td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800">{garduPortal}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-600 uppercase font-bold tracking-wide">Total</td>
                    <td className="px-3 py-2 text-right text-blue-700 font-extrabold">{garduValues.length}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 bg-gray-50 flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
