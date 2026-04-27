"use client";
import type { SchoorConfig } from "../../types/spark";

interface Props {
  autoSchoor: boolean;
  setAutoSchoor: (v: boolean) => void;
  autoSchoorThreshold: number;
  setAutoSchoorThreshold: (v: number) => void;
  autoSchoorJenis: SchoorConfig["jenis"];
  setAutoSchoorJenis: (v: SchoorConfig["jenis"]) => void;
  autoSchoorCount: number;
  polesLength: number;
}

export default function AutoSchoorCard({
  autoSchoor, setAutoSchoor, autoSchoorThreshold, setAutoSchoorThreshold,
  autoSchoorJenis, setAutoSchoorJenis, autoSchoorCount, polesLength,
}: Props) {
  return (
    <div className="border-2 border-emerald-300 p-4 rounded-xl bg-emerald-50">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-bold text-emerald-800 text-sm uppercase">⚡ Auto Schoor per Sudut</h3>
          {autoSchoor && autoSchoorCount > 0 && (
            <span className="mt-1 inline-block bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{autoSchoorCount} tiang terdeteksi</span>
          )}
          {autoSchoor && autoSchoorCount === 0 && polesLength > 0 && (
            <span className="mt-1 inline-block bg-gray-300 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">Tidak ada tiang yang memenuhi syarat</span>
          )}
        </div>
        <button onClick={() => setAutoSchoor(!autoSchoor)}
          className={`relative inline-flex h-7 items-center rounded-full transition-colors duration-200 focus:outline-none shadow-inner ${autoSchoor ? "bg-emerald-500" : "bg-gray-300"}`}
          style={{ width: 52 }}>
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${autoSchoor ? "translate-x-7" : "translate-x-1"}`} />
        </button>
      </div>

      {autoSchoor && (
        <div className="flex flex-col gap-3 mt-3">
          <div>
            <label className="text-[11px] text-gray-600 font-semibold block mb-1">
              Min. Sudut Belok: <span className="text-emerald-700 font-bold text-sm">{autoSchoorThreshold}°</span>
            </label>
            <input type="range" min={5} max={60} step={5} value={autoSchoorThreshold}
              onChange={e => setAutoSchoorThreshold(Number(e.target.value))}
              className="w-full accent-emerald-500" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>5° (Ketat)</span><span>30° (Sedang)</span><span>60° (Longgar)</span>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-gray-600 font-semibold block mb-1">Jenis Schoor Default:</label>
            <select className="w-full p-2 border border-emerald-300 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-400"
              value={autoSchoorJenis} onChange={e => setAutoSchoorJenis(e.target.value as SchoorConfig["jenis"])}>
              <option value="Treck">Treck Schoor (Kawat Tarik Keluar)</option>
              <option value="Druck">Druck Schoor (Tiang Dorong ke Dalam)</option>
              <option value="Kontramast">Kontramast (Tiang Jangkar Seberang)</option>
            </select>
          </div>
          <div className="bg-white border border-emerald-200 rounded-lg p-2.5 text-[11px] text-emerald-800 leading-relaxed">
            💡 Tiang dengan sudut belok ≥ <strong>{autoSchoorThreshold}°</strong> otomatis diberi schoor.<br/>
            Set manual tetap bisa dilakukan dan akan <strong>override</strong> auto.<br/>
            Schoor auto tampil <span className="opacity-60">lebih transparan</span> di peta.
          </div>
        </div>
      )}

      {!autoSchoor && (
        <p className="text-[11px] text-gray-500 mt-1">Aktifkan untuk memberi penopang otomatis pada semua tiang yang punya sudut belok signifikan.</p>
      )}
    </div>
  );
}
