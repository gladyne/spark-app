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
}

interface Props {
  open: boolean;
  onClose: () => void;
  // Active draft (detailed breakdown)
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
  // Jumlah tiang branch junction di active layer (tidak dihitung sebagai tiang mandiri)
  activeBranchCount: number;
  // Saved layers summary
  savedLayerStats: LayerStat[];
}

function getTypeFields(pd: PoleData, jenis: string): { short: string; long: string } {
  if (jenis.includes("SKUTR") || jenis.includes("Underbuild")) return { short: pd.jtrTypeShort, long: pd.jtrTypeLong };
  if (jenis === "SKUTM") return { short: pd.skutmTypeShort, long: pd.skutmTypeLong };
  if (jenis === "SKTM" || jenis === "SKTR") return { short: pd.kabelTypeShort, long: pd.kabelTypeLong };
  return { short: pd.jtmTypeShort, long: pd.jtmTypeLong };
}

function formatLength(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

const KONSTRUKSI_COLOR: Record<string, string> = {
  A1: "bg-blue-50 text-blue-700", A2: "bg-yellow-50 text-yellow-700",
  A3: "bg-orange-50 text-orange-700", "A3 Pole": "bg-orange-50 text-orange-700",
  "A3 Branch": "bg-purple-50 text-purple-700", "2xA3": "bg-red-50 text-red-700",
  B3: "bg-rose-50 text-rose-700", S: "bg-sky-50 text-sky-700",
  FDE: "bg-green-50 text-green-700", LA: "bg-amber-50 text-amber-700",
  "BDL+DE": "bg-teal-50 text-teal-700", Trm: "bg-indigo-50 text-indigo-700",
  "2xTrm": "bg-violet-50 text-violet-700", TRM: "bg-gray-50 text-gray-700",
  JNT: "bg-slate-50 text-slate-700", "—": "bg-gray-50 text-gray-400",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">{children}</h3>;
}

function Table({ head, children, footer }: { head: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead><tr className="bg-gray-100 text-gray-500 text-[11px] uppercase tracking-wide">{head}</tr></thead>
      <tbody>{children}</tbody>
      {footer && <tfoot>{footer}</tfoot>}
    </table>
  );
}

function TH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 font-semibold ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function TD({ children, right, bold }: { children: React.ReactNode; right?: boolean; bold?: boolean }) {
  return <td className={`px-3 py-2 ${right ? "text-right" : ""} ${bold ? "font-bold text-gray-800" : "text-gray-600"}`}>{children}</td>;
}

function TotalRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr className="border-t-2 border-gray-200 bg-gray-50">
      <td colSpan={99} className="px-3 py-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 uppercase font-bold tracking-wide">{label}</span>
          <span className="text-blue-700 font-extrabold text-sm">{value}</span>
        </div>
      </td>
    </tr>
  );
}

export default function RekapModal({
  open, onClose,
  poles, poleData, effectiveSchoors, gardus,
  jenisJaringan, statusJaringan, totalLengthM,
  tinggiTiang, materialTiang, jarakGawang,
  activeBranchCount,
  savedLayerStats,
}: Props) {
  if (!open) return null;

  const hasDraft = poles.length > 0;

  // ─── Draft stat (include konstruksiTypes dari poleData) ─────────────────
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
    konstruksiTypes: draftKonstruksiTypes,
  };

  const allStats: LayerStat[] = [...(hasDraft ? [draftStat] : []), ...savedLayerStats];
  const totalPoles = allStats.reduce((s, l) => s + l.polesCount, 0);
  const totalLength = allStats.reduce((s, l) => s + l.lengthM, 0);
  const totalSchoor = allStats.reduce((s, l) => s + l.schoors.total, 0);
  const totalTreck = allStats.reduce((s, l) => s + l.schoors.treck, 0);
  const totalDruck = allStats.reduce((s, l) => s + l.schoors.druck, 0);
  const totalKontramast = allStats.reduce((s, l) => s + l.schoors.kontramast, 0);
  const totalGardu = allStats.reduce((s, l) => s + l.garduCount, 0);

  const isArrester = jenisJaringan.includes("SUTM") || jenisJaringan === "SKUTM";
  const arresterCount = poleData.filter(pd => pd.isGrounded).length;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-sky-600 to-blue-700">
          <div>
            <h2 className="text-white font-extrabold text-lg tracking-tight">📋 Rekap Konstruksi Gambar</h2>
            <p className="text-sky-200 text-xs mt-0.5">{allStats.length} jaringan · {totalPoles} tiang · {formatLength(totalLength)}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-bold transition-colors">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">

          {/* ─── Ringkasan Per Layer ─── */}
          <section>
            <SectionTitle>Ringkasan Per Jaringan</SectionTitle>
            <Table
              head={<>
                <TH>Nama Layer</TH>
                <TH>Jenis</TH>
                <TH right>Tiang</TH>
                <TH right>Panjang</TH>
              </>}
              footer={
                <TotalRow
                  label={`Total · ${allStats.length} jaringan`}
                  value={`${totalPoles} tiang · ${formatLength(totalLength)}`}
                />
              }
            >
              {allStats.map((l, i) => (
                <tr key={l.id} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="px-3 py-2">
                    <span className="text-xs font-semibold text-gray-800 block truncate max-w-[120px]">{l.label}</span>
                    {l.id === -1 && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">DRAFT</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{l.jenisJaringan}</td>
                  <td className="px-3 py-2 text-right font-bold text-gray-800 text-xs">{l.polesCount}</td>
                  <td className="px-3 py-2 text-right text-xs text-gray-600">{formatLength(l.lengthM)}</td>
                </tr>
              ))}
            </Table>
          </section>

          {/* ─── Detail Konstruksi Per Layer ─── */}
          {allStats.map(l => {
            const entries = Object.entries(l.konstruksiTypes);
            if (entries.length === 0) return null;
            return (
              <section key={l.id}>
                <SectionTitle>
                  Konstruksi · {l.label}
                  {l.id === -1 && <span className="ml-1 normal-case text-blue-500">(draft)</span>}
                  {" — "}{l.jenisJaringan}
                </SectionTitle>
                <Table
                  head={<><TH>Tipe</TH><TH>Keterangan</TH><TH right>Jumlah</TH></>}
                >
                  {entries.map(([type, { long, count }], i) => {
                    const colorClass = KONSTRUKSI_COLOR[type] ?? "bg-gray-50 text-gray-700";
                    return (
                      <tr key={type} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                        <td className="px-3 py-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colorClass}`}>{type}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 truncate max-w-[160px]">{long}</td>
                        <TD right bold>{count}</TD>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-gray-200 bg-gray-50/80">
                    <td className="px-3 py-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Tiang</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{l.label}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-gray-800">{l.polesCount} tiang</td>
                  </tr>
                  <tr className="border-t border-gray-100 bg-gray-50/50">
                    <td className="px-3 py-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-600">{l.jenisJaringan}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">Panjang Penghantar</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-sky-700">
                      {l.lengthM >= 1000 ? `${(l.lengthM / 1000).toFixed(3)} km` : `${Math.round(l.lengthM)} m`}
                    </td>
                  </tr>
                </Table>
              </section>
            );
          })}

          {/* ─── Schoor ─── */}
          <section>
            <SectionTitle>Schoor · Semua Jaringan</SectionTitle>
            {totalSchoor === 0 ? (
              <p className="text-xs text-gray-400 italic px-1">Belum ada schoor terpasang</p>
            ) : (
              <Table
                head={<><TH>Jenis</TH><TH>Fungsi</TH><TH right>Jumlah</TH></>}
                footer={<TotalRow label="Total schoor" value={totalSchoor} />}
              >
                {totalTreck > 0 && (
                  <tr className="border-t border-gray-100 bg-white">
                    <td className="px-3 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Treck</span></td>
                    <td className="px-3 py-2 text-xs text-gray-500">Kawat tarik keluar</td>
                    <TD right bold>{totalTreck}</TD>
                  </tr>
                )}
                {totalDruck > 0 && (
                  <tr className="border-t border-gray-100 bg-gray-50/50">
                    <td className="px-3 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Druck</span></td>
                    <td className="px-3 py-2 text-xs text-gray-500">Tiang dorong ke dalam</td>
                    <TD right bold>{totalDruck}</TD>
                  </tr>
                )}
                {totalKontramast > 0 && (
                  <tr className="border-t border-gray-100 bg-white">
                    <td className="px-3 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">Kontramast</span></td>
                    <td className="px-3 py-2 text-xs text-gray-500">Tiang jangkar seberang</td>
                    <TD right bold>{totalKontramast}</TD>
                  </tr>
                )}
              </Table>
            )}
          </section>

          {/* ─── Arrester / Grounding (draft only, requires grounding logic) ─── */}
          {hasDraft && arresterCount > 0 && (
            <section>
              <SectionTitle>{isArrester ? "Arrester (Lightning Arrester)" : "Grounding / Arde"} · Draft Aktif</SectionTitle>
              <Table head={<><TH>Komponen</TH><TH right>Jumlah</TH></>}>
                <tr className="border-t border-gray-100 bg-white">
                  <td className="px-3 py-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                      {isArrester ? "⚡ Arrester (LA)" : "⏚ Grounding"}
                    </span>
                  </td>
                  <TD right bold>{arresterCount}</TD>
                </tr>
              </Table>
            </section>
          )}

          {/* ─── Gardu ─── */}
          {totalGardu > 0 && (() => {
            const draftCantol = Object.values(gardus).filter(g => g.jenis === "Cantol").length;
            const draftPortal = Object.values(gardus).filter(g => g.jenis === "Portal").length;
            const savedGardu = savedLayerStats.reduce((s, l) => s + l.garduCount, 0);
            return (
              <section>
                <SectionTitle>Gardu Distribusi · Semua Jaringan</SectionTitle>
                <Table
                  head={<><TH>Jenis</TH><TH right>Jumlah</TH></>}
                  footer={<TotalRow label="Total gardu" value={totalGardu} />}
                >
                  {draftCantol > 0 && (
                    <tr className="border-t border-gray-100 bg-white">
                      <td className="px-3 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">Gardu Cantol</span></td>
                      <TD right bold>{draftCantol}</TD>
                    </tr>
                  )}
                  {draftPortal > 0 && (
                    <tr className="border-t border-gray-100 bg-gray-50/50">
                      <td className="px-3 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">Gardu Portal</span></td>
                      <TD right bold>{draftPortal}</TD>
                    </tr>
                  )}
                  {savedGardu > 0 && (
                    <tr className="border-t border-gray-100 bg-white">
                      <td className="px-3 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">Gardu (Layer Tersimpan)</span></td>
                      <TD right bold>{savedGardu}</TD>
                    </tr>
                  )}
                </Table>
              </section>
            );
          })()}

          {/* ─── Info tiang & spesifikasi ─── */}
          {hasDraft && (
            <section>
              <SectionTitle>Spesifikasi Tiang · Draft Aktif</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Tinggi Tiang", value: `${tinggiTiang} m` },
                  { label: "Material", value: materialTiang },
                  { label: "Jarak Gawang", value: `${jarakGawang} m` },
                  { label: "Status", value: statusJaringan },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-gray-400 font-semibold">{label}</p>
                    <p className="text-sm font-bold text-gray-700 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
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
