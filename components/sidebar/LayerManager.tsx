"use client";
import { useState, useRef, useEffect } from "react";
import type { NetworkLayer, JunctionInfo } from "../../types/spark";
import { getSidebarDotColor } from "../../lib/layerColors";

interface Props {
  savedLayers: NetworkLayer[];
  junctions: JunctionInfo[];
  poles: [number, number][];
  jenisJaringan: string;
  statusJaringan: string;
  activeEditLayerId: number | null;
  saveName: string;
  setSaveName: (v: string) => void;
  groupNames: Record<string, string>;
  onLoadLayer: (layer: NetworkLayer) => void;
  onDeleteLayer: (id: number) => void;
  onSave: () => void;
  onRenameLayer: (id: number, newLabel: string) => void;
  onRenameGroup: (groupKey: string, newName: string) => void;
  onMergeGroup: (groupLayerIds: number[], groupName: string) => void;
  highlightedLayerIds: Set<number>;
  onSetHighlightedLayerIds: (ids: Set<number>) => void;
}

/** Derive connected-component groups from junction topology.
 *  Excludes ACTIVE_LAYER_ID (-1). Returns arrays of layer IDs. */
function deriveGroups(layers: NetworkLayer[], junctions: JunctionInfo[]): number[][] {
  const adj = new Map<number, Set<number>>();
  for (const j of junctions) {
    if (j.hostLayerId === -1 || j.branchLayerId === -1) continue;
    if (!adj.has(j.hostLayerId)) adj.set(j.hostLayerId, new Set());
    if (!adj.has(j.branchLayerId)) adj.set(j.branchLayerId, new Set());
    adj.get(j.hostLayerId)!.add(j.branchLayerId);
    adj.get(j.branchLayerId)!.add(j.hostLayerId);
  }
  const visited = new Set<number>();
  const groups: number[][] = [];
  for (const layer of layers) {
    if (visited.has(layer.id) || !adj.has(layer.id)) continue;
    const group: number[] = [];
    const queue = [layer.id];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      group.push(id);
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) queue.push(nb);
      }
    }
    if (group.length >= 2) groups.push(group);
  }
  return groups;
}

// ── Inline editable label ──────────────────────────────────────────────────
function InlineEdit({
  value, onCommit, placeholder, className,
}: { value: string; onCommit: (v: string) => void; placeholder?: string; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else setDraft(value); // revert if empty
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setDraft(value); } }}
        className={`flex-1 min-w-0 text-xs font-semibold border border-blue-400 rounded px-1 py-0.5 outline-none ${className ?? ""}`}
        placeholder={placeholder}
      />
    );
  }
  return (
    <span
      className={`flex-1 min-w-0 truncate cursor-text group-hover:underline decoration-dashed decoration-gray-300 ${className ?? ""}`}
      title="Klik untuk ubah nama"
      onClick={() => setEditing(true)}
    >
      {value}
    </span>
  );
}

export default function LayerManager({
  savedLayers, junctions, poles, jenisJaringan, statusJaringan,
  activeEditLayerId, saveName, setSaveName, groupNames,
  onLoadLayer, onDeleteLayer, onSave, onRenameLayer, onRenameGroup,
  onMergeGroup, highlightedLayerIds, onSetHighlightedLayerIds,
}: Props) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Key grup yang sedang dalam mode group-edit
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);

  if (savedLayers.length === 0 && poles.length === 0) return null;

  const groups = deriveGroups(savedLayers, junctions);
  const groupedLayerIds = new Set(groups.flat());
  const standaloneLayers = savedLayers.filter(l => !groupedLayerIds.has(l.id));

  const toggleGroup = (key: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  /** Masuk / keluar mode group-edit untuk sebuah grup */
  const toggleGroupEdit = (groupKey: string, groupLayerIds: number[]) => {
    if (activeGroupKey === groupKey) {
      // Keluar dari mode group-edit
      setActiveGroupKey(null);
      onSetHighlightedLayerIds(new Set());
    } else {
      setActiveGroupKey(groupKey);
      // Expand grup agar terlihat
      setCollapsedGroups(prev => { const n = new Set(prev); n.delete(groupKey); return n; });
      // Kirim ke peta agar semua layer dalam grup di-highlight
      onSetHighlightedLayerIds(new Set(groupLayerIds));
    }
  };

  // ── Helper: hitung panjang total jaringan dari array poles ────────────────
  const calcPanjang = (poles: [number, number][]) => {
    if (poles.length < 2) return null;
    let total = 0;
    for (let i = 1; i < poles.length; i++) {
      const dx = (poles[i][1] - poles[i-1][1]) * Math.cos(poles[i-1][0] * Math.PI / 180) * 111320;
      const dy = (poles[i][0] - poles[i-1][0]) * 110540;
      total += Math.sqrt(dx*dx + dy*dy);
    }
    return total >= 1000 ? `${(total/1000).toFixed(2)} km` : `${total.toFixed(0)} m`;
  };

  // ── Single layer row (standalone or child of group) ───────────────────────
  const LayerRow = ({
    layer, isChild = false, isLastChild = false, isHighlighted = false,
  }: { layer: NetworkLayer; isChild?: boolean; isLastChild?: boolean; isHighlighted?: boolean }) => {
    const dotColor = getSidebarDotColor(layer.jenisJaringan, layer.statusJaringan);
    const isKT = layer.jenisJaringan.startsWith("SK");
    const panjang = calcPanjang(layer.poles);

    return (
      <div className={`rounded-lg border shadow-sm transition-all overflow-hidden
        ${isHighlighted ? "border-indigo-300" : "border-gray-200"}
        ${isChild ? "ml-3" : "mb-2"}`}>

        {/* Baris nama + aksi */}
        <div className={`group flex items-center gap-2 px-2.5 pt-2.5 pb-1
          ${isHighlighted ? "bg-indigo-50" : "bg-white"}`}>
          {isChild && (
            <span className="text-gray-300 text-xs flex-shrink-0 font-mono select-none">
              {isLastChild ? "└" : "├"}
            </span>
          )}
          <span style={{
            width: 10, height: 10, borderRadius: "50%", background: dotColor,
            flexShrink: 0, display: "inline-block", border: "2px solid rgba(0,0,0,0.15)",
          }} />
          <InlineEdit
            value={layer.label}
            onCommit={v => onRenameLayer(layer.id, v)}
            placeholder="Nama layer"
            className="text-xs font-semibold text-gray-700"
          />
          <button onClick={() => onLoadLayer(layer)} title="Edit layer ini" className="text-blue-500 hover:text-blue-700 flex-shrink-0 text-base ml-auto">✏️</button>
          <button onClick={() => onDeleteLayer(layer.id)} title="Hapus layer" className="text-red-400 hover:text-red-600 flex-shrink-0 text-base">🗑️</button>
        </div>

        {/* Atribut ringkas */}
        <div className={`flex flex-wrap gap-x-2 gap-y-0.5 px-2.5 pb-2 text-[10px]
          ${isHighlighted ? "bg-indigo-50" : "bg-white"}`}>
          {/* Jenis & Status */}
          <span className={`font-semibold ${layer.statusJaringan === "Existing" ? "text-gray-600" : "text-green-700"}`}>
            {layer.jenisJaringan} · {layer.statusJaringan}
          </span>
          {/* Material & tinggi (hanya non-kabel tanah) */}
          {!isKT && (
            <span className="text-gray-500">
              Tiang {layer.materialTiang} {layer.tinggiTiang}m
            </span>
          )}
          {/* Jarak gawang / seksi */}
          {!isKT && (
            <span className="text-gray-500">Gawang {layer.jarakGawang}m</span>
          )}
          {/* Total panjang */}
          {panjang && (
            <span className="text-indigo-600 font-semibold">📏 {panjang}</span>
          )}
          {/* Jumlah titik */}
          <span className="text-gray-400">{layer.poles.length} {isKT ? "titik" : "tiang"}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="border border-gray-200 p-4 rounded-xl bg-slate-50">
      <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase">🗂️ Layer Jaringan</h3>

      {/* ── Standalone layers ────────────────────────────────────────────────── */}
      {standaloneLayers.map(layer => (
        <LayerRow key={layer.id} layer={layer} />
      ))}

      {/* ── Grouped layers → 1 baris tunggal per grup ────────────────────────── */}
      {groups.map((groupIds, gi) => {
        const groupKey = [...groupIds].sort((a, b) => a - b).join("-");
        const groupLayers = groupIds
          .map(id => savedLayers.find(l => l.id === id))
          .filter((l): l is NetworkLayer => !!l);
        const totalPoles = groupLayers.reduce((sum, l) => sum + l.poles.length, 0);
        const defaultGroupName = `Jaringan Gabungan #${gi + 1}`;
        const groupDisplayName = groupNames[groupKey] || defaultGroupName;
        const isEditingThisGroup = activeGroupKey === groupKey;

        return (
          <div key={groupKey} className={`flex flex-col rounded-lg border-2 shadow-sm mb-2 overflow-hidden transition-all
            ${isEditingThisGroup
              ? "border-indigo-400 shadow-indigo-100"
              : "border-purple-200 hover:border-purple-400"}`}>

            {/* Baris utama */}
            <div className={`flex items-center gap-2 p-2.5 transition-colors
              ${isEditingThisGroup ? "bg-indigo-50" : "bg-white"}`}>
              <span className="text-purple-500 text-base flex-shrink-0">🔗</span>

              <InlineEdit
                value={groupDisplayName}
                onCommit={v => onRenameGroup(groupKey, v)}
                placeholder={defaultGroupName}
                className={`text-xs font-semibold ${isEditingThisGroup ? "text-indigo-700" : "text-purple-700"}`}
              />

              <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap">
                {groupLayers.length}L · {totalPoles}T
              </span>

              {/* Tombol Edit / Selesai */}
              <button
                onClick={() => toggleGroupEdit(groupKey, groupIds)}
                title={isEditingThisGroup
                  ? "Selesai edit grup — keluar dari mode edit"
                  : `Edit semua ${groupLayers.length} layer dalam grup sekaligus`}
                className={`flex-shrink-0 text-[9px] font-bold px-2 py-1 rounded transition-colors ${
                  isEditingThisGroup
                    ? "bg-indigo-500 text-white hover:bg-indigo-600"
                    : "bg-purple-100 text-purple-600 hover:bg-purple-200"}`}
              >
                {isEditingThisGroup ? "✓ Selesai" : "✎ Edit"}
              </button>

              <button
                onClick={() => {
                  if (!window.confirm(`Hapus semua ${groupLayers.length} layer dalam grup "${groupDisplayName}"?`)) return;
                  if (isEditingThisGroup) { setActiveGroupKey(null); onSetHighlightedLayerIds(new Set()); }
                  groupIds.forEach(id => onDeleteLayer(id));
                }}
                title="Hapus semua layer dalam grup"
                className="text-red-400 hover:text-red-600 flex-shrink-0 text-base"
              >🗑️</button>
            </div>

            {/* Banner saat mode edit aktif */}
            {isEditingThisGroup && (
              <div className="px-3 py-1.5 bg-indigo-500 text-white text-[10px] font-medium flex items-center gap-1.5">
                <span>🖊️</span>
                <span>Mode edit aktif — drag titik manapun di peta. Koneksi sambungan otomatis terjaga.</span>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Draft / active edit indicator + name input ───────────────────────── */}
      {poles.length > 0 && (
        <>
          <div className="flex items-center gap-2 p-2.5 bg-yellow-50 rounded-lg border-2 border-yellow-300 border-dashed mb-2">
            <span className="text-yellow-500 text-base flex-shrink-0">✏️</span>
            <span className="flex-1 text-xs font-bold text-yellow-700 truncate">
              {activeEditLayerId !== null ? "Editing: " : "Draft: "}{jenisJaringan} {statusJaringan}
            </span>
            <span className="text-[10px] text-yellow-600 flex-shrink-0">{poles.length} titik</span>
          </div>

          {/* Input nama layer sebelum simpan */}
          <div className="mb-2">
            <label className="block text-[10px] text-gray-500 font-semibold mb-1 uppercase tracking-wide">
              Nama Layer (opsional)
            </label>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder={`${jenisJaringan} ${statusJaringan} (default)`}
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-gray-300 bg-white"
            />
          </div>

          <button
            onClick={onSave}
            className="w-full p-2 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm transition-all"
          >
            💾 Simpan Jaringan
          </button>
        </>
      )}
    </div>
  );
}
