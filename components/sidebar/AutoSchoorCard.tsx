"use client";

interface Props {
  autoSchoor: boolean;
  setAutoSchoor: (v: boolean) => void;
  autoSchoorThreshold: number;
  setAutoSchoorThreshold: (v: number) => void;
  autoSchoorCount: number;
  polesLength: number;
}

export default function AutoSchoorCard({
  autoSchoor, setAutoSchoor, autoSchoorThreshold, setAutoSchoorThreshold,
  autoSchoorCount, polesLength,
}: Props) {
  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm border transition-all duration-300 ${autoSchoor ? "border-emerald-200 shadow-emerald-100" : "border-slate-200"}`}>

      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between transition-all duration-300 ${autoSchoor ? "bg-gradient-to-r from-emerald-600 to-teal-600" : "bg-gradient-to-r from-slate-600 to-slate-700"}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs">⚡</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-wide">Auto Schoor</p>
            {autoSchoor && autoSchoorCount > 0 && (
              <span className="text-emerald-100 text-[10px] font-medium">{autoSchoorCount} tiang terdeteksi</span>
            )}
            {autoSchoor && autoSchoorCount === 0 && polesLength > 0 && (
              <span className="text-slate-300 text-[10px] font-medium">Tidak ada yang memenuhi syarat</span>
            )}
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setAutoSchoor(!autoSchoor)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none shadow-inner ${autoSchoor ? "bg-white/30" : "bg-slate-500"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${autoSchoor ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {/* Body */}
      <div className="bg-white p-4">
        {autoSchoor ? (
          <div className="flex flex-col gap-3">
            {/* Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Min. Sudut Belok</span>
                <span className="text-lg font-black text-emerald-600">{autoSchoorThreshold}°</span>
              </div>
              <input
                type="range" min={5} max={60} step={5}
                value={autoSchoorThreshold}
                onChange={e => setAutoSchoorThreshold(Number(e.target.value))}
                className="w-full accent-emerald-500 h-1.5"
              />
              <div className="flex justify-between text-[10px] text-slate-300 mt-1 font-medium">
                <span>5° Ketat</span><span>30° Sedang</span><span>60° Longgar</span>
              </div>
            </div>

            {/* Legend */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-[11px] text-slate-600"><strong>Belok kanan</strong> → <span className="text-red-600 font-bold">Treck</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-[11px] text-slate-600"><strong>Belok kiri</strong> → <span className="text-blue-600 font-bold">Druck</span></span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Set manual akan override auto schoor.</p>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Aktifkan untuk memberi penopang otomatis pada tiang yang punya sudut belok signifikan.
          </p>
        )}
      </div>
    </div>
  );
}
