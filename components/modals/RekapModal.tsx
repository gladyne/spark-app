"use client";
import type { PoleData, SchoorConfig, GarduConfig } from "../../types/spark";

export interface LayerStat {
  id: number;
  label: string;
  jenisJaringan: string;
  statusJaringan: string;
  polesCount: number;
  lengthM: number;
  schoors: { treck: number; druck: number; kontramast: number; total: number };
  garduCount: number;
  konstruksiTypes: Record<string, { long: string; count: number }>;
  kondukturUkuran: number;
  tinggiTiang: number;
  materialTiang: string;
}

const CONDUCTOR_TIPE: Record<string, string> = {
  "SUTM": "AAACS", "SUTM + SKUTR": "AAACS",
  "SUTM Underbuild (2 Jaringan)": "AAACS", "SUTM Underbuild (3 Jaringan)": "AAACS",
  "SKUTM": "NFA2XSY-T", "SKTM": "NA2XSEBY",
  "SKUTR": "NFA2X", "SKTR": "NFA2X",
};

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
  kondukturUkuran: number;
  activeBranchCount: number;
  savedLayerStats: LayerStat[];
}

function getTypeFields(pd: PoleData, jenis: string): { short: string; long: string } {
  if (jenis.includes("SKUTR") || jenis.includes("Underbuild")) return { short: pd.jtrTypeShort, long: pd.jtrTypeLong };
  if (jenis === "SKUTM") return { short: pd.skutmTypeShort, long: pd.skutmTypeLong };
  if (jenis === "SKTM" || jenis === "SKTR") return { short: pd.kabelTypeShort, long: pd.kabelTypeLong };
  return { short: pd.jtmTypeShort, long: pd.jtmTypeLong };
}

function formatKm(m: number): string {
  return `${(m / 1000).toFixed(3)} kms`;
}

// Vibrant gradient pill per construction type
const TYPE_PILL: Record<string, string> = {
  A1:          "from-blue-500 to-blue-600",
  A2:          "from-amber-500 to-yellow-500",
  A3:          "from-orange-500 to-red-500",
  "A3 Pole":   "from-orange-500 to-red-500",
  "A3 Branch": "from-purple-500 to-violet-600",
  "2xA3":      "from-rose-600 to-red-700",
  B3:          "from-rose-500 to-pink-600",
  S:           "from-sky-500 to-cyan-600",
  FDE:         "from-emerald-500 to-green-600",
  LA:          "from-amber-400 to-yellow-500",
  "BDL+DE":   "from-teal-500 to-cyan-600",
  Trm:         "from-indigo-500 to-blue-600",
  "2xTrm":     "from-violet-500 to-purple-600",
  TRM:         "from-slate-500 to-gray-600",
  JNT:         "from-slate-400 to-slate-500",
  "—":         "from-gray-300 to-gray-400",
};

function TypePill({ type }: { type: string }) {
  const grad = TYPE_PILL[type] ?? "from-gray-400 to-gray-500";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r ${grad} shadow-sm`}>
      {type}
    </span>
  );
}

function CardHeader({ children, gradient }: { children: React.ReactNode; gradient: string }) {
  return (
    <div className={`bg-gradient-to-r ${gradient} px-4 py-2.5 flex items-center gap-2`}>
      {children}
    </div>
  );
}

export default function RekapModal({
  open, onClose,
  poles, poleData, effectiveSchoors, gardus,
  jenisJaringan, statusJaringan, totalLengthM,
  tinggiTiang, materialTiang, jarakGawang, kondukturUkuran,
  activeBranchCount,
  savedLayerStats,
}: Props) {
  if (!open) return null;

  const hasDraft = poles.length > 0;

  const draftKonstruksiTypes: Record<string, { long: string; count: number }> = {};
  poleData.forEach(pd => {
    const { short, long } = getTypeFields(pd, jenisJaringan);
    const key = short || "—";
    if (!draftKonstruksiTypes[key]) draftKonstruksiTypes[key] = { long: long || "—", count: 0 };
    draftKonstruksiTypes[key].count++;
  });

  const draftStat: LayerStat = {
    id: -1, label: "Draft Aktif",
    jenisJaringan, statusJaringan,
    polesCount: poles.length - activeBranchCount, lengthM: totalLengthM,
    schoors: {
      treck: Object.values(effectiveSchoors).filter(s => s.jenis === "Treck").length,
      druck: Object.values(effectiveSchoors).filter(s => s.jenis === "Druck").length,
      kontramast: Object.values(effectiveSchoors).filter(s => s.jenis === "Kontramast").length,
      total: Object.keys(effectiveSchoors).length,
    },
    garduCount: Object.keys(gardus).length,
    kondukturUkuran, tinggiTiang, materialTiang,
    konstruksiTypes: draftKonstruksiTypes,
  };

  const allStats: LayerStat[] = [...(hasDraft ? [draftStat] : []), ...savedLayerStats];
  const totalPoles  = allStats.reduce((s, l) => s + l.polesCount, 0);
  const totalLength = allStats.reduce((s, l) => s + l.lengthM,    0);
  const totalSchoor    = allStats.reduce((s, l) => s + l.schoors.total,     0);
  const totalTreck     = allStats.reduce((s, l) => s + l.schoors.treck,     0);
  const totalDruck     = allStats.reduce((s, l) => s + l.schoors.druck,     0);
  const totalKontramast= allStats.reduce((s, l) => s + l.schoors.kontramast,0);
  const totalGardu     = allStats.reduce((s, l) => s + l.garduCount,        0);

  const isArrester   = jenisJaringan.includes("SUTM") || jenisJaringan === "SKUTM";
  const arresterCount= poleData.filter(pd => pd.isGrounded).length;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-slate-50 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/60">

        {/* ── Modal Header ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 px-6 py-5 flex-shrink-0">
          <div className="absolute inset-0 opacity-[0.06]" style={{backgroundImage:"radial-gradient(circle, white 1px, transparent 1px)", backgroundSize:"20px 20px"}} />
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-black text-lg tracking-tight leading-none">Rekap Konstruksi Gambar</h2>
                <p className="text-blue-300 text-[11px] font-medium mt-1">
                  {allStats.length} jaringan · {totalPoles} tiang · {formatKm(totalLength)}
                </p>
              </div>
            </div>
            <button onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">

          {/* ── Ringkasan Per Jaringan ── */}
          <div className="rounded-xl overflow-hidden border border-slate-200/80 shadow-sm">
            <CardHeader gradient="from-slate-700 to-slate-800">
              <svg className="w-3.5 h-3.5 text-white/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="text-white font-bold text-[11px] uppercase tracking-widest">Ringkasan Per Jaringan</span>
            </CardHeader>
            <div className="bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Layer</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jenis</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tiang</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Panjang</th>
                  </tr>
                </thead>
                <tbody>
                  {allStats.map(l => (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-slate-800 block truncate max-w-[130px]">{l.label}</span>
                        {l.id === -1 && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">DRAFT</span>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{l.jenisJaringan}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-800">{l.polesCount}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{formatKm(l.lengthM)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <td colSpan={2} className="px-4 py-2.5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total · {allStats.length} Jaringan</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-black text-blue-700">{totalPoles}</span>
                      <span className="text-blue-500 font-bold"> tiang</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-black text-blue-700">{formatKm(totalLength)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Detail Konstruksi Per Layer ── */}
          {allStats.map(l => {
            const entries = Object.entries(l.konstruksiTypes);
            if (entries.length === 0) return null;
            return (
              <div key={l.id} className="rounded-xl overflow-hidden border border-slate-200/80 shadow-sm">
                <CardHeader gradient="from-indigo-700 to-blue-800">
                  <svg className="w-3.5 h-3.5 text-white/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className="text-white font-bold text-[11px] uppercase tracking-widest flex-1">
                    Konstruksi · {l.label}
                  </span>
                  {l.id === -1 && (
                    <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">DRAFT</span>
                  )}
                  <span className="text-blue-200 text-[10px] font-semibold">{l.jenisJaringan}</span>
                </CardHeader>
                <div className="bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipe</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Keterangan</th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(([type, { long, count }]) => (
                        <tr key={type} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5"><TypePill type={type} /></td>
                          <td className="px-3 py-2.5 text-slate-500 truncate max-w-[160px]">{long}</td>
                          <td className="px-3 py-2.5 text-right font-black text-slate-800">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r from-slate-500 to-slate-600 shadow-sm">Tiang</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{l.materialTiang} {l.tinggiTiang}m</td>
                        <td className="px-3 py-2.5 text-right font-black text-slate-700">{l.polesCount} tiang</td>
                      </tr>
                      <tr className="border-t border-slate-100 bg-gradient-to-r from-sky-50 to-blue-50">
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r from-sky-500 to-blue-600 shadow-sm">{l.jenisJaringan}</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{CONDUCTOR_TIPE[l.jenisJaringan] ?? "AAACS"} {l.kondukturUkuran} mm²</td>
                        <td className="px-3 py-2.5 text-right font-black text-blue-700">{formatKm(l.lengthM)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}

          {/* ── Schoor ── */}
          <div className="rounded-xl overflow-hidden border border-slate-200/80 shadow-sm">
            <CardHeader gradient="from-emerald-700 to-teal-800">
              <svg className="w-3.5 h-3.5 text-white/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-white font-bold text-[11px] uppercase tracking-widest">Schoor · Semua Jaringan</span>
              {totalSchoor > 0 && (
                <span className="ml-auto text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">{totalSchoor} total</span>
              )}
            </CardHeader>
            <div className="bg-white">
              {totalSchoor === 0 ? (
                <p className="px-4 py-4 text-xs text-slate-400 italic text-center">Belum ada schoor terpasang</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jenis</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fungsi</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totalTreck > 0 && (
                      <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r from-red-500 to-rose-600 shadow-sm">Treck</span></td>
                        <td className="px-3 py-2.5 text-slate-500">Kawat tarik keluar</td>
                        <td className="px-3 py-2.5 text-right font-black text-slate-800">{totalTreck}</td>
                      </tr>
                    )}
                    {totalDruck > 0 && (
                      <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-sm">Druck</span></td>
                        <td className="px-3 py-2.5 text-slate-500">Tiang dorong ke dalam</td>
                        <td className="px-3 py-2.5 text-right font-black text-slate-800">{totalDruck}</td>
                      </tr>
                    )}
                    {totalKontramast > 0 && (
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r from-emerald-500 to-green-600 shadow-sm">Kontramast</span></td>
                        <td className="px-3 py-2.5 text-slate-500">Tiang jangkar seberang</td>
                        <td className="px-3 py-2.5 text-right font-black text-slate-800">{totalKontramast}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Arrester / Grounding ── */}
          {hasDraft && arresterCount > 0 && (
            <div className="rounded-xl overflow-hidden border border-slate-200/80 shadow-sm">
              <CardHeader gradient="from-amber-600 to-yellow-600">
                <svg className="w-3.5 h-3.5 text-white/80 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-white font-bold text-[11px] uppercase tracking-widest">
                  {isArrester ? "Arrester (LA)" : "Grounding / Arde"} · Draft Aktif
                </span>
              </CardHeader>
              <div className="bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r from-amber-500 to-yellow-500 shadow-sm">
                    {isArrester ? "⚡ Arrester (LA)" : "⏚ Grounding"}
                  </span>
                  <span className="font-black text-slate-800 text-sm">{arresterCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Gardu ── */}
          {totalGardu > 0 && (() => {
            const draftCantol = Object.values(gardus).filter(g => g.jenis === "Cantol").length;
            const draftPortal = Object.values(gardus).filter(g => g.jenis === "Portal").length;
            const savedGardu  = savedLayerStats.reduce((s, l) => s + l.garduCount, 0);
            return (
              <div className="rounded-xl overflow-hidden border border-slate-200/80 shadow-sm">
                <CardHeader gradient="from-purple-700 to-violet-800">
                  <svg className="w-3.5 h-3.5 text-white/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="text-white font-bold text-[11px] uppercase tracking-widest flex-1">Gardu Distribusi · Semua Jaringan</span>
                  <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">{totalGardu} unit</span>
                </CardHeader>
                <div className="bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jenis</th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftCantol > 0 && (
                        <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r from-purple-500 to-violet-600 shadow-sm">Gardu Cantol</span></td>
                          <td className="px-3 py-2.5 text-right font-black text-slate-800">{draftCantol}</td>
                        </tr>
                      )}
                      {draftPortal > 0 && (
                        <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r from-violet-500 to-purple-600 shadow-sm">Gardu Portal</span></td>
                          <td className="px-3 py-2.5 text-right font-black text-slate-800">{draftPortal}</td>
                        </tr>
                      )}
                      {savedGardu > 0 && (
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r from-indigo-500 to-blue-600 shadow-sm">Layer Tersimpan</span></td>
                          <td className="px-3 py-2.5 text-right font-black text-slate-800">{savedGardu}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ── Spesifikasi Tiang Draft ── */}
          {hasDraft && (
            <div className="rounded-xl overflow-hidden border border-slate-200/80 shadow-sm">
              <CardHeader gradient="from-slate-600 to-slate-700">
                <svg className="w-3.5 h-3.5 text-white/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-white font-bold text-[11px] uppercase tracking-widest">Spesifikasi · Draft Aktif</span>
              </CardHeader>
              <div className="bg-white p-3 grid grid-cols-2 gap-2">
                {[
                  { label: "Tinggi Tiang",  value: `${tinggiTiang} m` },
                  { label: "Material",      value: materialTiang },
                  { label: "Jarak Gawang",  value: `${jarakGawang} m` },
                  { label: "Status",        value: statusJaringan },
                  { label: "Konduktor",     value: `${CONDUCTOR_TIPE[jenisJaringan] ?? "AAACS"} ${kondukturUkuran} mm²` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-black text-slate-700 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="border-t border-slate-200 px-5 py-3 bg-white flex justify-end flex-shrink-0">
          <button onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
