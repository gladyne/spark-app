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
    <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200/80">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-3 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <span className="text-white font-bold text-sm tracking-wide">Tentukan Titik</span>
      </div>

      <div className="bg-white p-4 flex flex-col gap-2">
        {/* Titik Awal */}
        <button onClick={onSetStart}
          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            mode === "start"
              ? "bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900 shadow-md shadow-amber-200/50 ring-2 ring-amber-300"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0"
          }`}>
          <span className="text-base">📍</span>
          {mode === "start" ? "Menunggu klik peta..." : "Set Titik Awal"}
        </button>
        {snapStart && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold border ${snapStart.isMidLine ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
            <span>{snapStart.isMidLine ? "⑂" : "⚡"}</span>
            <span className="flex-1 truncate">{snapStart.isMidLine ? "Cabang dari" : "Snap ke"} <b>{snapStart.label}</b></span>
            <button onClick={onClearStart} className="w-4 h-4 rounded-full bg-slate-200 hover:bg-red-200 text-slate-500 hover:text-red-600 flex items-center justify-center text-[9px] font-black transition-colors flex-shrink-0">✕</button>
          </div>
        )}

        {/* Titik Akhir */}
        <button onClick={onSetEnd}
          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            mode === "end"
              ? "bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-900 shadow-md shadow-amber-200/50 ring-2 ring-amber-300"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0"
          }`}>
          <span className="text-base">🏁</span>
          {mode === "end" ? "Menunggu klik peta..." : "Set Titik Akhir"}
        </button>
        {snapEnd && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold border ${snapEnd.isMidLine ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
            <span>{snapEnd.isMidLine ? "⑂" : "⚡"}</span>
            <span className="flex-1 truncate">{snapEnd.isMidLine ? "Cabang dari" : "Snap ke"} <b>{snapEnd.label}</b></span>
            <button onClick={onClearEnd} className="w-4 h-4 rounded-full bg-slate-200 hover:bg-red-200 text-slate-500 hover:text-red-600 flex items-center justify-center text-[9px] font-black transition-colors flex-shrink-0">✕</button>
          </div>
        )}

        <p className="text-[10px] text-slate-400 text-center pt-1">Klik dekat ujung atau tengah jaringan untuk sambung otomatis</p>
      </div>
    </div>
  );
}
