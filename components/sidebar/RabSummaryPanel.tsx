"use client";

import React, { useState, useMemo } from "react";
import type { RabSummary, RabItemResult } from "../../lib/rab/types";

interface Props {
  rabSummary: RabSummary;
  onOpenExportModal?: () => void;
}

/**
 * Format angka ke format Rupiah Indonesia standar:
 * "Rp" + titik sebagai pemisah ribuan, tanpa desimal (contoh: Rp 1.234.567)
 */
export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "Harga belum tersedia";
  const rounded = Math.round(amount);
  return "Rp " + rounded.toLocaleString("id-ID");
}

export default function RabSummaryPanel({ rabSummary, onOpenExportModal }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [isExpandedModal, setIsExpandedModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | "JTM" | "GARDU" | "JTR">("ALL");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => setCollapsedSections({});
  const collapseAll = (keys: string[]) => {
    const allCollapsed: Record<string, boolean> = {};
    keys.forEach(k => { allCollapsed[k] = true; });
    setCollapsedSections(allCollapsed);
  };

  // Filter items berdasarkan tab & search
  const filteredItems = useMemo(() => {
    return rabSummary.items.filter(item => {
      // Filter kategori JTM / Gardu / JTR
      if (selectedFilter === "JTM" && item.volJtm <= 0) return false;
      if (selectedFilter === "GARDU" && item.volGardu <= 0) return false;
      if (selectedFilter === "JTR" && item.volJtr <= 0) return false;

      // Filter text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchRow = item.row.toString().includes(q);
        const matchSub = item.subsection?.toLowerCase().includes(q);
        const matchSec = item.section.toLowerCase().includes(q);
        return matchDesc || matchRow || matchSub || matchSec;
      }
      return true;
    });
  }, [rabSummary.items, selectedFilter, searchQuery]);

  // Group items berdasarkan section -> subsection
  const groupedData = useMemo(() => {
    const map = new Map<string, Map<string, RabItemResult[]>>();

    for (const item of filteredItems) {
      const sec = item.section || "LAINNYA";
      const sub = item.subsection || "Umum";

      if (!map.has(sec)) {
        map.set(sec, new Map());
      }
      const subMap = map.get(sec)!;
      if (!subMap.has(sub)) {
        subMap.set(sub, []);
      }
      subMap.get(sub)!.push(item);
    }

    return map;
  }, [filteredItems]);

  const allSectionKeys = useMemo(() => {
    const keys: string[] = [];
    groupedData.forEach((subMap, sec) => {
      keys.push(`sec-${sec}`);
      subMap.forEach((_, sub) => {
        keys.push(`sub-${sec}-${sub}`);
      });
    });
    return keys;
  }, [groupedData]);

  const hasItems = rabSummary.items.length > 0;

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-emerald-200 bg-white transition-all">
      {/* ─── Header Card Ringkasan RAB ─── */}
      <div 
        onClick={() => setIsOpen(v => !v)}
        className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 px-4 py-3.5 flex items-center justify-between text-white cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0 shadow-inner">
            <span className="text-base">💰</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs sm:text-sm tracking-tight text-white">
                Ringkasan RAB Real-Time
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-400/30">
                KHS 2026
              </span>
            </div>
            <p className="text-[10px] text-emerald-200/80 font-medium">
              {hasItems ? `${rabSummary.items.length} item aktif dihitung` : "Belum ada aset digambar"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Grand total badge in header */}
          {hasItems && (
            <div className="text-right">
              <span className="text-[9px] uppercase tracking-wider text-emerald-300 font-bold block">
                Grand Total
              </span>
              <span className="text-xs sm:text-sm font-black text-emerald-100">
                {formatRupiah(rabSummary.grandTotal)}
              </span>
            </div>
          )}
          <span className={`text-slate-300 text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
            ▼
          </span>
        </div>
      </div>

      {/* ─── Body Card (Collapsible) ─── */}
      {isOpen && (
        <div className="p-3.5 flex flex-col gap-3">
          {/* Sticky Quick Metric Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-2 flex flex-col">
              <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wide">
                JTM
              </span>
              <span className="text-xs font-black text-emerald-900 mt-0.5 truncate" title={formatRupiah(rabSummary.subtotalJtm)}>
                {formatRupiah(rabSummary.subtotalJtm)}
              </span>
              <span className="text-[9px] text-emerald-700/80 font-medium mt-0.5">
                {rabSummary.totalJtmItems} item ({Math.round(rabSummary.totalVolumeJtm)} vol)
              </span>
            </div>

            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2 flex flex-col">
              <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wide">
                GARDU
              </span>
              <span className="text-xs font-black text-amber-900 mt-0.5 truncate" title={formatRupiah(rabSummary.subtotalGardu)}>
                {formatRupiah(rabSummary.subtotalGardu)}
              </span>
              <span className="text-[9px] text-amber-700/80 font-medium mt-0.5">
                {rabSummary.totalGarduItems} item ({Math.round(rabSummary.totalVolumeGardu)} vol)
              </span>
            </div>

            <div className="bg-cyan-50/80 border border-cyan-200/80 rounded-xl p-2 flex flex-col">
              <span className="text-[9px] font-bold text-cyan-800 uppercase tracking-wide">
                JTR
              </span>
              <span className="text-xs font-black text-cyan-900 mt-0.5 truncate" title={formatRupiah(rabSummary.subtotalJtr)}>
                {formatRupiah(rabSummary.subtotalJtr)}
              </span>
              <span className="text-[9px] text-cyan-700/80 font-medium mt-0.5">
                {rabSummary.totalJtrItems} item ({Math.round(rabSummary.totalVolumeJtr)} vol)
              </span>
            </div>
          </div>

          {/* Breakdown Bahan & Upah */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200/70 rounded-xl text-[10px]">
            <span className="text-slate-600 font-semibold">
              Bahan: <strong className="text-slate-900">{formatRupiah(rabSummary.subtotalBahan)}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 font-semibold">
              Upah Pasang: <strong className="text-slate-900">{formatRupiah(rabSummary.subtotalUpah)}</strong>
            </span>
          </div>

          {/* Filter Bar & Controls */}
          {hasItems && (
            <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Cari item RAB..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-xs bg-slate-100 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white transition"
                />
                <button
                  onClick={() => setIsExpandedModal(true)}
                  className="px-2 py-1 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  title="Buka tabel lebar lengkap"
                >
                  <span>⛶</span> Lebar
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1">
                  {(["ALL", "JTM", "GARDU", "JTR"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSelectedFilter(tab)}
                      className={`px-2 py-0.5 rounded font-bold transition ${
                        selectedFilter === tab
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-[9px] text-slate-500">
                  <button 
                    onClick={expandAll} 
                    className="hover:text-emerald-700 underline font-medium cursor-pointer"
                  >
                    Buka Semua
                  </button>
                  <span>•</span>
                  <button 
                    onClick={() => collapseAll(allSectionKeys)} 
                    className="hover:text-emerald-700 underline font-medium cursor-pointer"
                  >
                    Tutup Semua
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Item Groups Container */}
          {!hasItems ? (
            <div className="text-center py-6 px-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <span className="text-2xl block mb-1">🗺️</span>
              <p className="text-xs font-bold text-slate-700">Belum Ada Item RAB</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Tambahkan tiang, trafo gardu, atau buat jalur penarikan kabel di peta untuk melihat perhitungan biaya otomatis.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-4 px-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              Tidak ada item yang cocok dengan pencarian / filter.
            </div>
          ) : (
            <div className="max-h-[340px] overflow-y-auto flex flex-col gap-2.5 pr-0.5">
              {Array.from(groupedData.entries()).map(([sec, subMap]) => {
                const secKey = `sec-${sec}`;
                const isSecCollapsed = !!collapsedSections[secKey];

                // Hitung subtotal section
                let secTotal = 0;
                let secItemCount = 0;
                subMap.forEach(items => {
                  secItemCount += items.length;
                  items.forEach(i => { if (i.jumlahHarga) secTotal += i.jumlahHarga; });
                });

                return (
                  <div key={sec} className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-xs">
                    {/* Section Header */}
                    <div
                      onClick={() => toggleSection(secKey)}
                      className="bg-slate-100/90 px-3 py-2 flex items-center justify-between cursor-pointer select-none hover:bg-slate-200/70 transition"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <span className="text-[11px] font-bold text-slate-800 truncate" title={sec}>
                          {sec}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-200 text-slate-700">
                          {secItemCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs font-black text-emerald-800">
                          {formatRupiah(secTotal)}
                        </span>
                        <span className={`text-[10px] text-slate-400 transition-transform ${isSecCollapsed ? "" : "rotate-180"}`}>
                          ▼
                        </span>
                      </div>
                    </div>

                    {/* Subsections */}
                    {!isSecCollapsed && (
                      <div className="p-2 flex flex-col gap-2 bg-slate-50/50">
                        {Array.from(subMap.entries()).map(([sub, items]) => {
                          const subKey = `sub-${sec}-${sub}`;
                          const isSubCollapsed = !!collapsedSections[subKey];
                          let subTotal = 0;
                          items.forEach(i => { if (i.jumlahHarga) subTotal += i.jumlahHarga; });

                          return (
                            <div key={sub} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                              {/* Subsection Header */}
                              <div
                                onClick={() => toggleSection(subKey)}
                                className="px-2.5 py-1.5 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition"
                              >
                                <span className="text-[10px] font-extrabold text-slate-700 truncate" title={sub}>
                                  {sub} ({items.length})
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-bold text-slate-700">
                                    {formatRupiah(subTotal)}
                                  </span>
                                  <span className={`text-[9px] text-slate-400 transition-transform ${isSubCollapsed ? "" : "rotate-180"}`}>
                                    ▼
                                  </span>
                                </div>
                              </div>

                              {/* Items Table */}
                              {!isSubCollapsed && (
                                <div className="divide-y divide-slate-100">
                                  {items.map(item => (
                                    <div key={item.row} className="p-2 hover:bg-slate-50/80 transition flex flex-col gap-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                                              R{item.row}
                                            </span>
                                            <span className="text-xs font-semibold text-slate-800 leading-tight">
                                              {item.description}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Jumlah Harga Kolom N */}
                                        <div className="text-right flex-shrink-0">
                                          {item.jumlahHarga !== null ? (
                                            <span className="text-xs font-extrabold text-emerald-700">
                                              {formatRupiah(item.jumlahHarga)}
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-800 border border-amber-300" title="harga_satuan_bahan & harga_satuan_upah belum ada di template KHS">
                                              Harga belum tersedia
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Volume breakdown & details */}
                                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-slate-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                            Vol: {item.totalVolume} {item.satuan}
                                          </span>
                                          {item.volJtm > 0 && <span className="text-emerald-700">JTM: {item.volJtm}</span>}
                                          {item.volGardu > 0 && <span className="text-amber-700">Grd: {item.volGardu}</span>}
                                          {item.volJtr > 0 && <span className="text-cyan-700">JTR: {item.volJtr}</span>}
                                        </div>

                                        {(item.hargaSatuanBahan !== null || item.hargaSatuanUpah !== null) && (
                                          <span className="text-[9px] text-slate-400">
                                            @{formatRupiah((item.hargaSatuanBahan || 0) + (item.hargaSatuanUpah || 0))}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Sticky Total Footer */}
          {hasItems && (
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-slate-400 block tracking-wider">
                  TOTAL ESTIMASI (REAL-TIME)
                </span>
                <span className="text-base font-black text-emerald-800 tracking-tight">
                  {formatRupiah(rabSummary.grandTotal)}
                </span>
              </div>

              {onOpenExportModal && (
                <button
                  onClick={onOpenExportModal}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 shadow-md hover:shadow-emerald-600/30 hover:-translate-y-0.5 active:translate-y-0 transition flex items-center gap-1.5 cursor-pointer"
                  title="Ekspor ke template Excel master UP3 Kupang"
                >
                  <span>📥</span>
                  <span>Export Excel</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Modal / Slide-over Lebar (Full-Screen View) ─── */}
      {isExpandedModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h2 className="text-lg font-black text-white">
                    Rincian Perhitungan Real-Time RAB PLN UP3 Kupang
                  </h2>
                  <p className="text-xs text-emerald-200/80">
                    Sesuai rumus template KHS 2026: L=I×J, M=I×K, N=L+M
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExpandedModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Toolbar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter nama/kode item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:border-emerald-500 w-64"
                />
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                  {(["ALL", "JTM", "GARDU", "JTR"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSelectedFilter(tab)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        selectedFilter === tab
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">SUBTOTAL JTM</span>
                  <span className="font-extrabold text-emerald-900">{formatRupiah(rabSummary.subtotalJtm)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">SUBTOTAL GARDU</span>
                  <span className="font-extrabold text-amber-900">{formatRupiah(rabSummary.subtotalGardu)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px]">SUBTOTAL JTR</span>
                  <span className="font-extrabold text-cyan-900">{formatRupiah(rabSummary.subtotalJtr)}</span>
                </div>
                <div className="pl-3 border-l border-slate-300">
                  <span className="text-emerald-700 font-bold block text-[10px]">GRAND TOTAL</span>
                  <span className="text-base font-black text-emerald-900">{formatRupiah(rabSummary.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase font-extrabold text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-xs">
                    <th className="py-2.5 px-3">Row</th>
                    <th className="py-2.5 px-3">Uraian Pekerjaan / Material</th>
                    <th className="py-2.5 px-3">Satuan</th>
                    <th className="py-2.5 px-2 text-right">Vol JTM (F)</th>
                    <th className="py-2.5 px-2 text-right">Vol Gardu (G)</th>
                    <th className="py-2.5 px-2 text-right">Vol JTR (H)</th>
                    <th className="py-2.5 px-3 text-right">Total Vol (I)</th>
                    <th className="py-2.5 px-3 text-right">Hrg Bahan (J)</th>
                    <th className="py-2.5 px-3 text-right">Hrg Upah (K)</th>
                    <th className="py-2.5 px-3 text-right text-emerald-900">Jumlah Harga (N)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map(item => (
                    <tr key={item.row} className="hover:bg-emerald-50/40 transition">
                      <td className="py-2 px-3 font-mono font-bold text-slate-400 text-[11px]">{item.row}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-800">{item.description}</div>
                        {item.subsection && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{item.subsection}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-medium">{item.satuan}</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-700">{item.volJtm > 0 ? item.volJtm : "-"}</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-700">{item.volGardu > 0 ? item.volGardu : "-"}</td>
                      <td className="py-2 px-2 text-right font-mono text-slate-700">{item.volJtr > 0 ? item.volJtr : "-"}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{item.totalVolume}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">{item.hargaSatuanBahan ? formatRupiah(item.hargaSatuanBahan) : "-"}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">{item.hargaSatuanUpah ? formatRupiah(item.hargaSatuanUpah) : "-"}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                        {item.jumlahHarga !== null ? (
                          formatRupiah(item.jumlahHarga)
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                            Harga belum tersedia
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Menampilkan {filteredItems.length} item RAB ter-mapping. Angka otomatis disinkronkan saat ekspor Excel.
              </span>
              <button
                onClick={() => setIsExpandedModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-200 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
