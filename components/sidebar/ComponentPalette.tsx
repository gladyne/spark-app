"use client";
import type { GarduConfig, SchoorConfig, NetworkLayer, Connection, ConnectFirstState } from "../../types/spark";

interface Props {
  poles: [number, number][];
  editMode: string | null;
  isKabelTanah: boolean;
  // Gardu palette
  paletteGarduJenis: GarduConfig["jenis"];
  paletteGarduTrafo: string;
  setPaletteGarduTrafo: (v: string) => void;
  paletteGarduOrientasi: GarduConfig["orientasi"];
  setPaletteGarduOrientasi: (v: GarduConfig["orientasi"]) => void;
  trafoOptions: string[];
  // Schoor palette
  paletteSchoorJenis: SchoorConfig["jenis"];
  // Connect
  savedLayers: NetworkLayer[];
  connections: Connection[];
  connectMode: boolean;
  connectFirst: ConnectFirstState;
  setConnections: (v: Connection[]) => void;
  setConnectMode: (v: boolean) => void;
  setConnectFirst: (v: ConnectFirstState) => void;
  // Handlers
  activatePalette: (type: "schoor" | "gardu", subtype: string) => void;
  toggleEditMode: (mode: "insert" | "delete" | "gardu" | "schoor") => void;
  handleUndo: () => void;
  historyLength: number;
  highlightedLayerIds: Set<number>;
}

const SCHOOR_TYPES = [
  { jenis: "Treck" as const, color: "red", label: "⚓ Treck" },
  { jenis: "Druck" as const, color: "blue", label: "⚓ Druck" },
  { jenis: "Kontramast" as const, color: "green", label: "⚓ K.mast" },
] as const;

const ACTIVE_CLS: Record<string, string> = {
  red: "bg-red-600 text-white ring-2 ring-red-300 border-red-600",
  blue: "bg-blue-600 text-white ring-2 ring-blue-300 border-blue-600",
  green: "bg-green-600 text-white ring-2 ring-green-300 border-green-600",
};
const HOVER_CLS: Record<string, string> = {
  red: "hover:bg-red-50 hover:border-red-300",
  blue: "hover:bg-blue-50 hover:border-blue-300",
  green: "hover:bg-green-50 hover:border-green-300",
};

export default function ComponentPalette({
  poles, editMode, isKabelTanah,
  paletteGarduJenis, paletteGarduTrafo, setPaletteGarduTrafo,
  paletteGarduOrientasi, setPaletteGarduOrientasi, trafoOptions,
  paletteSchoorJenis,
  savedLayers, connections, connectMode, connectFirst,
  setConnections, setConnectMode, setConnectFirst,
  activatePalette, toggleEditMode, handleUndo, historyLength,
  highlightedLayerIds,
}: Props) {
  if (poles.length === 0 && highlightedLayerIds.size === 0) return null;

  return (
    <div className="border-2 border-indigo-200 p-4 rounded-xl bg-indigo-50">
      <h3 className="font-bold text-indigo-800 mb-3 text-sm uppercase">🧰 Komponen</h3>

      {/* Trafo / Gardu */}
      <div className="mb-3">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Trafo / Gardu</p>
        <div className="flex gap-2 mb-2">
          {(["Cantol", "Portal"] as GarduConfig["jenis"][]).map(j => (
            <button key={j} onClick={() => activatePalette("gardu", j)}
              className={`flex-1 p-2.5 text-xs rounded-lg font-bold border transition-all ${editMode === "gardu" && paletteGarduJenis === j ? "bg-purple-600 text-white ring-2 ring-purple-300 border-purple-600" : "bg-white border-gray-300 text-gray-700 hover:bg-purple-50 hover:border-purple-300"}`}>
              🏗️ {j}
            </button>
          ))}
        </div>
        {editMode === "gardu" && (
          <div className="bg-white border border-purple-200 rounded-lg p-2.5 flex flex-col gap-2">
            <div>
              <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Kapasitas Trafo:</label>
              <select value={paletteGarduTrafo} onChange={e => setPaletteGarduTrafo(e.target.value)}
                className="w-full p-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400 bg-gray-50">
                {(paletteGarduJenis === "Cantol" ? trafoOptions.filter(t => parseInt(t) <= 50) : trafoOptions).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {paletteGarduJenis === "Portal" && (
              <div>
                <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Orientasi:</label>
                <select value={paletteGarduOrientasi} onChange={e => setPaletteGarduOrientasi(e.target.value as GarduConfig["orientasi"])}
                  className="w-full p-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-purple-400 bg-gray-50">
                  <option value="Horizontal">Horizontal (Sejajar Jalan)</option>
                  <option value="Vertikal">Vertikal (Melintang Jalan)</option>
                </select>
              </div>
            )}
            <p className="text-[10px] text-purple-700 font-semibold bg-purple-50 rounded px-2 py-1">
              👆 Klik tiang di peta untuk memasang gardu {paletteGarduJenis} {paletteGarduTrafo}
            </p>
          </div>
        )}
      </div>

      {/* Penopang (Schoor) */}
      {!isKabelTanah && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Penopang (Schoor)</p>
          <div className="flex gap-1.5">
            {SCHOOR_TYPES.map(({ jenis, color, label }) => {
              const isActive = editMode === "schoor" && paletteSchoorJenis === jenis;
              return (
                <button key={jenis} onClick={() => activatePalette("schoor", jenis)}
                  className={`flex-1 p-2 text-[10px] rounded-lg font-bold border transition-all ${isActive ? ACTIVE_CLS[color] : `bg-white border-gray-300 text-gray-700 ${HOVER_CLS[color]}`}`}>
                  {label}
                </button>
              );
            })}
          </div>
          {editMode === "schoor" && (
            <div className="mt-1.5 bg-white border border-emerald-200 rounded p-2 flex flex-col gap-1.5">
              <p className="text-[10px] text-emerald-700 font-semibold">
                👆 Klik tiang untuk pasang schoor {paletteSchoorJenis}.<br/>
                🔄 Drag ujung schoor untuk merotasi arahnya.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sambungkan Layer */}
      {savedLayers.length >= 2 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Sambungan Kabel</p>
          <button
            onClick={() => { setConnectMode(!connectMode); setConnectFirst(null); }}
            className={`w-full p-2 text-xs rounded-lg font-bold border transition-all ${connectMode ? "bg-orange-500 text-white ring-2 ring-orange-300 border-orange-500" : "bg-white border-gray-300 text-gray-700 hover:bg-orange-50 hover:border-orange-300"}`}>
            🔗 {connectMode ? (connectFirst ? "Pilih Titik Kedua..." : "Pilih Titik Pertama...") : "Sambungkan Jaringan"}
          </button>
          {connectMode && (
            <p className="text-[10px] text-orange-600 font-semibold mt-1 bg-orange-50 border border-orange-200 rounded px-2 py-1">
              {connectFirst ? "👆 Klik tiang HOST (titik yang dipertahankan)" : "👆 Klik tiang BRANCH (tiang yang akan disambung)"}
            </p>
          )}
          {connections.length > 0 && (
            <button onClick={() => setConnections([])}
              className="mt-1 w-full p-1.5 text-[10px] rounded-lg font-bold border border-red-200 text-red-500 hover:bg-red-50 transition-all">
              🗑️ Hapus Semua Sambungan ({connections.length})
            </button>
          )}
        </div>
      )}

      {/* Edit Tiang */}
      <div className="pt-3 border-t border-indigo-200">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1.5">Edit Tiang</p>
        <div className="flex gap-2">
          <button onClick={() => toggleEditMode("insert")} className={`flex-1 p-2 text-xs rounded-lg font-bold shadow-sm transition-all ${editMode === "insert" ? "bg-blue-600 text-white ring-2 ring-blue-300" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"}`}>➕ Sisip</button>
          <button onClick={() => toggleEditMode("delete")} className={`flex-1 p-2 text-xs rounded-lg font-bold shadow-sm transition-all ${editMode === "delete" ? "bg-red-600 text-white ring-2 ring-red-300" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"}`}>🗑️ Hapus</button>
          <button onClick={handleUndo} disabled={historyLength === 0}
            className={`flex-1 p-2 text-xs rounded-lg font-bold shadow-sm transition-all flex items-center justify-center gap-1 ${historyLength > 0 ? "bg-amber-100 border border-amber-300 text-amber-800 hover:bg-amber-200" : "bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"}`}>
            ↩️ Undo {historyLength > 0 && <span className="bg-amber-300 text-amber-900 px-1.5 py-0.5 rounded-full text-[9px]">{historyLength}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
