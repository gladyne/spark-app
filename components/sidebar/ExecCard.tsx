"use client";

interface Props {
  routingMode: "jalan" | "lurus";
  setRoutingMode: (v: "jalan" | "lurus") => void;
  isLoading: boolean;
  onGenerate: () => void;
  onClear: () => void;
}

export default function ExecCard({ routingMode, setRoutingMode, isLoading, onGenerate, onClear }: Props) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200/80">
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-3 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
          </svg>
        </div>
        <span className="text-white font-bold text-sm tracking-wide">Eksekusi</span>
      </div>

      <div className="bg-white p-4 flex flex-col gap-3">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Mode Rute</p>
          <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <button onClick={() => setRoutingMode("jalan")}
              className={`flex-1 py-2.5 text-xs font-bold transition-all ${routingMode === "jalan" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
              🛣️ Ikut Jalan
            </button>
            <div className="w-px bg-slate-200" />
            <button onClick={() => setRoutingMode("lurus")}
              className={`flex-1 py-2.5 text-xs font-bold transition-all ${routingMode === "lurus" ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
              📐 Garis Lurus
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            {routingMode === "jalan" ? "Rute mengikuti jalur jalan via OSRM" : "Garis langsung A→B, cocok area non-jalan"}
          </p>
        </div>

        <button onClick={onGenerate} disabled={isLoading}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            isLoading
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
          }`}>
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Menghitung Rute...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Jaringan
            </>
          )}
        </button>

        <button onClick={onClear}
          className="w-full py-2.5 rounded-xl text-xs font-bold border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 hover:border-red-300 transition-all flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Reset Peta
        </button>
      </div>
    </div>
  );
}
