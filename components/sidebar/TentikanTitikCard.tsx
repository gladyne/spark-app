"use client";

interface SnapInfo { layerId: number; label: string; isMidLine?: boolean; }

interface Props {
  mode: "start" | "end" | null;
  snapStart: SnapInfo | null;
  snapEnd: SnapInfo | null;
  onSetStart: () => void;
  onSetEnd: () => void;
  onClearStart: () => void;
  onClearEnd: () => void;
}

export default function TentikanTitikCard({ mode, snapStart, snapEnd, onSetStart, onSetEnd, onClearStart, onClearEnd }: Props) {
  return (
    <div className="border border-gray-200 p-4 rounded-xl bg-gray-50">
      <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase">Tentukan Titik</h3>
      <button onClick={onSetStart}
        className={`w-full p-2 mb-1 text-sm rounded-lg font-semibold transition-colors ${mode === "start" ? "bg-yellow-400 text-black" : "bg-blue-600 text-white"}`}>
        📍 Set Titik Awal
      </button>
      {snapStart && (
        <div className={`flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold ${snapStart.isMidLine ? "bg-teal-50 border border-teal-300 text-teal-700" : "bg-green-50 border border-green-300 text-green-700"}`}>
          <span className="text-base">{snapStart.isMidLine ? "⑂" : "⚡"}</span>
          <span>{snapStart.isMidLine ? "Cabang dari" : "Tersambung ke"} <b>{snapStart.label}</b></span>
          <button onClick={onClearStart} className="ml-auto text-gray-400 hover:text-red-500 font-bold text-xs">✕</button>
        </div>
      )}
      <button onClick={onSetEnd}
        className={`w-full p-2 mb-1 text-sm rounded-lg font-semibold transition-colors ${mode === "end" ? "bg-yellow-400 text-black" : "bg-blue-600 text-white"}`}>
        📍 Set Titik Akhir
      </button>
      {snapEnd && (
        <div className={`flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold ${snapEnd.isMidLine ? "bg-teal-50 border border-teal-300 text-teal-700" : "bg-green-50 border border-green-300 text-green-700"}`}>
          <span className="text-base">{snapEnd.isMidLine ? "⑂" : "⚡"}</span>
          <span>{snapEnd.isMidLine ? "Cabang dari" : "Tersambung ke"} <b>{snapEnd.label}</b></span>
          <button onClick={onClearEnd} className="ml-auto text-gray-400 hover:text-red-500 font-bold text-xs">✕</button>
        </div>
      )}
      <p className="text-[10px] text-gray-400 mt-1 text-center">💡 Klik dekat ujung atau tengah jaringan lain untuk sambung otomatis</p>
    </div>
  );
}
