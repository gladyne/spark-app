"use client";
import type { GarduConfig, SchoorConfig, NetworkLayer, Connection, ConnectFirstState } from "../../types/spark";
import { getValidTrafoOptions } from "../../lib/assetStyles";

interface Props {
  poles: [number, number][];
  editMode: string | null;
  isKabelTanah: boolean;
  paletteGarduJenis: GarduConfig["jenis"];
  paletteGarduTrafo: string;
  setPaletteGarduTrafo: (v: string) => void;
  paletteGarduOrientasi: GarduConfig["orientasi"];
  setPaletteGarduOrientasi: (v: GarduConfig["orientasi"]) => void;
  trafoOptions: string[];
  paletteSchoorJenis: SchoorConfig["jenis"];
  savedLayers: NetworkLayer[];
  connections: Connection[];
  connectMode: boolean;
  connectFirst: ConnectFirstState;
  setConnections: (v: Connection[]) => void;
  setConnectMode: (v: boolean) => void;
  setConnectFirst: (v: ConnectFirstState) => void;
  activatePalette: (type: "schoor" | "gardu", subtype: string) => void;
  toggleEditMode: (mode: "insert" | "delete" | "gardu" | "schoor" | "konstruksi") => void;
  highlightedLayerIds: Set<number>;
}

const labelCls = "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block";
const selectCls = "w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent";

export default function ComponentPalette({
  poles, editMode, isKabelTanah,
  paletteGarduJenis, paletteGarduTrafo, setPaletteGarduTrafo,
  paletteGarduOrientasi, setPaletteGarduOrientasi, trafoOptions,
  paletteSchoorJenis,
  savedLayers, connections, connectMode, connectFirst,
  setConnections, setConnectMode, setConnectFirst,
  activatePalette, toggleEditMode,
  highlightedLayerIds,
}: Props) {
  if (poles.length === 0 && highlightedLayerIds.size === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200/80">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-blue-800 px-4 py-3 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <span className="text-white font-bold text-sm tracking-wide">Komponen</span>
      </div>

      <div className="bg-white p-4 flex flex-col gap-4">

        {/* Trafo / Gardu */}
        <div>
          <p className={labelCls}>Trafo / Gardu</p>
          <div className="flex gap-2">
            {(["Cantol", "Portal"] as GarduConfig["jenis"][]).map(j => (
              <button key={j} onClick={() => activatePalette("gardu", j)}
                className={`flex-1 py-2.5 text-xs rounded-xl font-bold border transition-all ${
                  editMode === "gardu" && paletteGarduJenis === j
                    ? "bg-gradient-to-r from-purple-600 to-violet-600 text-white border-transparent shadow-md shadow-purple-300/40"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                }`}>
                🏗️ {j}
              </button>
            ))}
          </div>
          {editMode === "gardu" && (
            <div className="mt-2 rounded-xl bg-purple-50 border border-purple-100 p-3 flex flex-col gap-2">
              <div>
                <label className="text-[10px] text-purple-600 font-bold block mb-1">Kapasitas Trafo</label>
                <select value={paletteGarduTrafo} onChange={e => setPaletteGarduTrafo(e.target.value)} className={selectCls}>
                  {getValidTrafoOptions(paletteGarduJenis, trafoOptions).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {paletteGarduJenis === "Portal" && (
                <div>
                  <label className="text-[10px] text-purple-600 font-bold block mb-1">Orientasi</label>
                  <select value={paletteGarduOrientasi} onChange={e => setPaletteGarduOrientasi(e.target.value as GarduConfig["orientasi"])} className={selectCls}>
                    <option value="Horizontal">Horizontal (Sejajar Jalan)</option>
                    <option value="Vertikal">Vertikal (Melintang Jalan)</option>
                  </select>
                </div>
              )}
              <p className="text-[10px] text-purple-700 font-semibold flex items-center gap-1">
                <span>👆</span> Klik tiang di peta untuk pasang gardu {paletteGarduJenis} {paletteGarduTrafo}
              </p>
            </div>
          )}
        </div>

        {/* Schoor */}
        {!isKabelTanah && (
          <div>
            <p className={labelCls}>Penopang (Schoor)</p>
            <div className="flex gap-1.5">
              {([
                { jenis: "Treck" as const,     grad: "from-red-500 to-rose-600",     idle: "border-red-200 text-red-600 hover:bg-red-50",   ring: "ring-red-300" },
                { jenis: "Druck" as const,     grad: "from-blue-500 to-indigo-600",  idle: "border-blue-200 text-blue-600 hover:bg-blue-50", ring: "ring-blue-300" },
                { jenis: "Kontramast" as const, grad: "from-emerald-500 to-green-600", idle: "border-emerald-200 text-emerald-600 hover:bg-emerald-50", ring: "ring-emerald-300" },
              ]).map(({ jenis, grad, idle, ring }) => {
                const isActive = editMode === "schoor" && paletteSchoorJenis === jenis;
                return (
                  <button key={jenis} onClick={() => activatePalette("schoor", jenis)}
                    className={`flex-1 py-2 text-[10px] rounded-xl font-bold border transition-all ${
                      isActive ? `bg-gradient-to-r ${grad} text-white border-transparent shadow-sm ring-2 ${ring}` : `bg-slate-50 ${idle}`
                    }`}>
                    ⚓ {jenis === "Kontramast" ? "K.mast" : jenis}
                  </button>
                );
              })}
            </div>
            {editMode === "schoor" && (
              <div className="mt-2 rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                <p className="text-[10px] text-slate-600 font-medium">
                  👆 Klik tiang untuk pasang <strong>{paletteSchoorJenis}</strong><br/>
                  🔄 Drag ujung schoor untuk merotasi arahnya
                </p>
              </div>
            )}
          </div>
        )}

        {/* Sambungan Kabel */}
        {savedLayers.length >= 2 && (
          <div>
            <p className={labelCls}>Sambungan Kabel</p>
            <button
              onClick={() => { setConnectMode(!connectMode); setConnectFirst(null); }}
              className={`w-full py-2.5 text-xs rounded-xl font-bold border transition-all ${
                connectMode
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-transparent shadow-md ring-2 ring-orange-300"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
              }`}>
              🔗 {connectMode ? (connectFirst ? "Pilih Titik Kedua..." : "Pilih Titik Pertama...") : "Sambungkan Jaringan"}
            </button>
            {connectMode && (
              <div className="mt-2 rounded-xl bg-orange-50 border border-orange-100 px-3 py-2">
                <p className="text-[10px] text-orange-700 font-semibold">
                  {connectFirst ? "👆 Klik tiang HOST (titik yang dipertahankan)" : "👆 Klik tiang BRANCH (tiang yang disambung)"}
                </p>
              </div>
            )}
            {connections.length > 0 && (
              <button onClick={() => setConnections([])}
                className="mt-1.5 w-full py-2 text-[10px] rounded-xl font-bold border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 transition-all">
                🗑️ Hapus Semua Sambungan ({connections.length})
              </button>
            )}
          </div>
        )}

        {/* Konstruksi Tiang */}
        <div>
          <p className={labelCls}>Konstruksi Tiang</p>
          <button onClick={() => toggleEditMode("konstruksi")}
            className={`w-full py-2.5 text-xs rounded-xl font-bold border transition-all ${
              editMode === "konstruksi"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-md ring-2 ring-amber-300"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
            }`}>
            ⚙️ Edit Konstruksi
          </button>
          {editMode === "konstruksi" && (
            <div className="mt-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
              <p className="text-[10px] text-amber-700 font-semibold">👆 Klik tiang untuk ganti tipe konstruksi</p>
            </div>
          )}
        </div>

        {/* Edit Tiang */}
        <div className="border-t border-dashed border-slate-100 pt-3">
          <p className={labelCls}>Edit Tiang</p>
          <div className="flex gap-2">
            <button onClick={() => toggleEditMode("insert")}
              className={`flex-1 py-2.5 text-xs rounded-xl font-bold border transition-all ${
                editMode === "insert"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-md ring-2 ring-blue-300"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              }`}>
              ➕ Sisip
            </button>
            <button onClick={() => toggleEditMode("delete")}
              className={`flex-1 py-2.5 text-xs rounded-xl font-bold border transition-all ${
                editMode === "delete"
                  ? "bg-gradient-to-r from-red-500 to-rose-600 text-white border-transparent shadow-md ring-2 ring-red-300"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              }`}>
              🗑️ Hapus
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
