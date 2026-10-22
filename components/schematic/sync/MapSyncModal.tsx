"use client";

import React, { useState } from "react";
import type { MapSyncPlan, SparkMapSyncPayload } from "../../../lib/schematic/mapSyncEngine";
import { buildMapSyncPlan } from "../../../lib/schematic/mapSyncEngine";
import type { SchematicData } from "../../../types/schematic";
import { formatRupiah } from "../../sidebar/RabSummaryPanel";

interface Props {
  open: boolean;
  onClose: () => void;
  mapData: SparkMapSyncPayload;
  currentSchematic: SchematicData;
  onApply: (newSchematic: SchematicData, summaryMsg: string) => void;
}

type TabType = "changes" | "deleted" | "unsynced" | "rab";

export default function MapSyncModal({
  open,
  onClose,
  mapData,
  currentSchematic,
  onApply,
}: Props) {
  const [includeDraft, setIncludeDraft] = useState(true);
  const [deleteRemovedNodes, setDeleteRemovedNodes] = useState(false);
  const [excludedDeleteNodeIds, setExcludedDeleteNodeIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabType>("changes");

  if (!open) return null;

  // Re-calculate plan when options change
  const plan: MapSyncPlan = buildMapSyncPlan(mapData, currentSchematic, {
    includeDraft,
    deleteRemovedNodes,
    excludedDeleteNodeIds,
  });

  const totalAdded = plan.toAddNodes.length + plan.toAddEdges.length;
  const totalUpdated = plan.toUpdateNodes.length + plan.toUpdateEdges.length;
  const totalDeleted = plan.toDeleteNodes.length + plan.toDeleteEdges.length;
  const totalUnsynced = plan.unsyncedItems.length;

  const handleToggleExcludeNode = (nodeId: string) => {
    setExcludedDeleteNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleConfirmApply = () => {
    const summaryMsg = `Sinkronisasi berhasil: ${plan.toAddNodes.length} tiang baru, ${plan.toAddEdges.length} kabel, ${plan.toUpdateNodes.length} diperbarui.`;
    onApply(plan.candidateSchematic, summaryMsg);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 text-xl font-bold">
              🔄
            </div>
            <div>
              <h3 className="font-black text-base text-white tracking-tight flex items-center gap-2">
                Sinkronisasi Aset dari Mode Peta
                <span className="px-2 py-0.5 rounded bg-blue-600/30 text-blue-400 border border-blue-500/40 text-[10px] font-bold">
                  Peta → Skematik
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Proyek: <span className="font-semibold text-slate-200">{plan.projectName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Draft Warning Banner (Jika ada layer draft di peta) */}
        {plan.hasDraft && (
          <div className="bg-amber-950/40 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>
                Ditemukan <strong>Layer Draft</strong> yang belum disimpan di peta ({plan.draftPolesCount} tiang, {plan.draftEdgesCount} kabel).
              </span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-bold select-none">
              <input
                type="checkbox"
                checked={includeDraft}
                onChange={(e) => setIncludeDraft(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
              />
              <span>Sertakan Draft</span>
            </label>
          </div>
        )}

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-4 gap-2.5 p-4 border-b border-slate-800 bg-slate-900/60">
          <div
            onClick={() => setActiveTab("changes")}
            className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
              activeTab === "changes"
                ? "bg-emerald-950/40 border-emerald-500/50 shadow-xs"
                : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              🟢 Ditambahkan
            </span>
            <span className="text-xl font-black text-emerald-400">{totalAdded}</span>
            <span className="text-[10px] text-slate-500">
              {plan.toAddNodes.length} tiang, {plan.toAddEdges.length} kabel
            </span>
          </div>

          <div
            onClick={() => setActiveTab("changes")}
            className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
              activeTab === "changes"
                ? "bg-blue-950/40 border-blue-500/50 shadow-xs"
                : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              🔵 Diperbarui
            </span>
            <span className="text-xl font-black text-blue-400">{totalUpdated}</span>
            <span className="text-[10px] text-slate-500">
              Atribut tiang &amp; kabel
            </span>
          </div>

          <div
            onClick={() => setActiveTab("deleted")}
            className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
              activeTab === "deleted"
                ? "bg-amber-950/40 border-amber-500/50 shadow-xs"
                : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              🟠 Dihapus di Peta
            </span>
            <span className="text-xl font-black text-amber-400">{totalDeleted}</span>
            <span className="text-[10px] text-slate-500">Perlu keputusan</span>
          </div>

          <div
            onClick={() => setActiveTab("unsynced")}
            className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
              activeTab === "unsynced"
                ? "bg-purple-950/40 border-purple-500/50 shadow-xs"
                : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
            }`}
          >
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              ⚪ Belum Didukung
            </span>
            <span className="text-xl font-black text-purple-300">{totalUnsynced}</span>
            <span className="text-[10px] text-slate-500">Aksesoris khusus</span>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-1">
          <button
            onClick={() => setActiveTab("changes")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === "changes"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Rincian Perubahan ({totalAdded + totalUpdated})
          </button>
          <button
            onClick={() => setActiveTab("deleted")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "deleted"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Aset Dihapus di Peta ({totalDeleted})
          </button>
          <button
            onClick={() => setActiveTab("unsynced")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === "unsynced"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Item Tanpa Padanan ({totalUnsynced})
          </button>
          <button
            onClick={() => setActiveTab("rab")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "rab"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Evaluasi RAB Peta vs Skematik
            {plan.rabDiff > 0 ? (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: CHANGES (ADD & UPDATE) */}
          {activeTab === "changes" && (
            <div className="space-y-4 text-xs">
              <div className="bg-blue-950/20 border border-blue-500/30 rounded-xl p-3 text-slate-300">
                <span className="font-bold text-blue-400 block mb-1">
                  💡 Aturan Pembaruan:
                </span>
                Aset yang sudah ada di skematik akan diperbarui <strong>atribut teknisnya</strong> (material, tinggi, daN, jenis kabel, panjang meter nyata), namun <strong>posisi X/Y</strong> yang telah Anda geser dan rapikan di kanvas akan <strong>tetap dipertahankan</strong>.
              </div>

              {/* Added Nodes */}
              {plan.toAddNodes.length > 0 && (
                <div>
                  <h4 className="font-bold text-emerald-400 uppercase text-[11px] mb-2 flex items-center gap-1.5">
                    <span>🟢</span> Tiang &amp; Gardu Baru ({plan.toAddNodes.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {plan.toAddNodes.map((n) => (
                      <div
                        key={n.id}
                        className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {n.type === "gardu" ? "🏬" : "📍"}
                          </span>
                          <div>
                            <span className="font-bold text-white block">
                              {n.label || "Tiang"} ({n.type})
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {n.materialTiang} {n.tinggiTiang}m / {n.kekuatanTiang} daN
                              {n.garduJenis ? ` • Gardu ${n.garduJenis} ${n.trafoKva} kVA` : ""}
                              {n.schoor ? ` • Schoor ${n.schoor.jenis}` : ""}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                          Baru
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Added Edges */}
              {plan.toAddEdges.length > 0 && (
                <div>
                  <h4 className="font-bold text-emerald-400 uppercase text-[11px] mb-2 flex items-center gap-1.5">
                    <span>⚡</span> Kabel Konduktor Baru ({plan.toAddEdges.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {plan.toAddEdges.map((e) => (
                      <div
                        key={e.id}
                        className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-200 block">
                            {e.jenisJaringan} ({e.konduktorJenis} {e.kondukturUkuran} mm²)
                          </span>
                          <span className="text-[11px] text-cyan-400 font-mono">
                            Jarak Nyata: {e.lengthM} meter (geodesik)
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                          Baru
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Updated Nodes */}
              {plan.toUpdateNodes.length > 0 && (
                <div>
                  <h4 className="font-bold text-blue-400 uppercase text-[11px] mb-2 flex items-center gap-1.5">
                    <span>🔵</span> Atribut Aset yang Diperbarui ({plan.toUpdateNodes.length})
                  </h4>
                  <div className="space-y-1.5">
                    {plan.toUpdateNodes.map((u) => (
                      <div
                        key={u.node.id}
                        className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-white">
                            {u.node.label || "Tiang"} ({u.node.type})
                          </span>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Perubahan: {u.changes?.join(", ")}
                          </p>
                        </div>
                        <span className="text-[10px] text-blue-400 font-semibold">
                          Posisi tetap
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {totalAdded === 0 && totalUpdated === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-sm">Tidak ada perubahan aset baru atau pembaruan atribut dari peta.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DELETED ON MAP */}
          {activeTab === "deleted" && (
            <div className="space-y-3 text-xs">
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 text-slate-300">
                <span className="font-bold text-amber-400 block mb-1">
                  ⚠️ Kebijakan Penghapusan Aset:
                </span>
                Aset yang telah dihapus di peta <strong>tidak dihapus otomatis</strong> dari skematik Anda. Anda dapat menentukan apakah ingin menghapusnya sekarang atau mempertahankannya di kanvas.
              </div>

              {plan.toDeleteNodes.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[11px]">
                    <span className="text-slate-400 font-semibold">Daftar Aset yang Dihapus di Peta</span>
                    <button
                      type="button"
                      onClick={() => setDeleteRemovedNodes(!deleteRemovedNodes)}
                      className="text-amber-400 hover:underline font-bold"
                    >
                      {deleteRemovedNodes ? "Batalkan Hapus Semua" : "Hapus Semua dari Skematik"}
                    </button>
                  </div>

                  {plan.toDeleteNodes.map((n) => {
                    const willDelete = deleteRemovedNodes && !excludedDeleteNodeIds.has(n.id);
                    return (
                      <div
                        key={n.id}
                        className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={willDelete}
                            onChange={() => {
                              if (!deleteRemovedNodes) setDeleteRemovedNodes(true);
                              handleToggleExcludeNode(n.id);
                            }}
                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-white block">
                              {n.label || "Tiang"} ({n.type})
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Posisi kanvas: ({Math.round(n.x)}, {Math.round(n.y)})
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            willDelete
                              ? "bg-red-950 text-red-400 border border-red-800/40"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {willDelete ? "Akan Dihapus" : "Dipertahankan"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-sm">✓ Tidak ada aset yang dihapus di peta.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: UNSYNCED ITEMS */}
          {activeTab === "unsynced" && (
            <div className="space-y-3 text-xs">
              <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-3 text-slate-300">
                <span className="font-bold text-purple-300 block mb-1">
                  ℹ️ Item Tanpa Padanan Simbol Skematik:
                </span>
                Item-item berikut ada pada data peta, namun tidak memiliki simbol 2D resmi tersendiri di kanvas skematik garis tunggal. Item ini <strong>tidak dibuang diam-diam</strong>, dan tetap diperhitungkan di dalam RAB.
              </div>

              {plan.unsyncedItems.length > 0 ? (
                <div className="space-y-2">
                  {plan.unsyncedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-lg flex items-start gap-3"
                    >
                      <span className="text-purple-400 text-base">📌</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{item.title}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-300/80 block mt-0.5">
                          Lokasi: {item.location}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-1">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400">
                  <p className="text-sm">✓ Seluruh item di peta memiliki padanan di kanvas skematik.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RAB EVALUATION */}
          {activeTab === "rab" && (
            <div className="space-y-4 text-xs">
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 text-slate-300">
                <span className="font-bold text-emerald-400 block mb-1">
                  💰 Evaluasi Konsistensi RAB:
                </span>
                Sesuai aturan arsitektur, RAB skematik dihitung murni dari data skematik hasil sinkronisasi (tidak menjumlahkan peta + skematik). Nilai berikut memverifikasi kesesuaian antara kedua mode.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-slate-400 font-semibold">Total RAB dari Peta:</span>
                  <span className="text-2xl font-black text-white mt-1">
                    {formatRupiah(plan.mapRabTotal)}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-2">
                    Dihitung dari layer aktif &amp; tersimpan peta
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-slate-400 font-semibold">Estimasi RAB Skematik Hasil Sinkron:</span>
                  <span className="text-2xl font-black text-cyan-400 mt-1">
                    {formatRupiah(plan.schematicRabTotal)}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-2">
                    Dihitung dari node &amp; kabel skematik
                  </span>
                </div>
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  plan.rabDiff === 0
                    ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                    : "bg-amber-950/30 border-amber-500/40 text-amber-300"
                }`}
              >
                <span className="text-2xl">{plan.rabDiff === 0 ? "✅" : "⚠️"}</span>
                <div>
                  <span className="font-bold block">
                    {plan.rabDiff === 0
                      ? "Kesesuaian Sempurna (100% Cocok)"
                      : `Terdapat Selisih Nilai: ${formatRupiah(plan.rabDiff)}`}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {plan.rabDiff === 0
                      ? "Total RAB skematik dan peta menghasilkan angka yang identik untuk seluruh aset yang tersinkronisasi."
                      : "Selisih dapat disebabkan oleh aksesoris khusus (misal Arrester/Grounding) atau node manual yang sudah ada sebelumnya di skematik."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleConfirmApply}
            disabled={totalAdded === 0 && totalUpdated === 0 && totalDeleted === 0}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>🔄</span>
            <span>Terapkan Sinkronisasi</span>
          </button>
        </div>
      </div>
    </div>
  );
}
