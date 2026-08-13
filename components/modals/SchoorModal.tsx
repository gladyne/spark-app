"use client";
import type { SchoorConfig, PoleData } from "../../types/spark";

interface Props {
  selectedSchoorIdx: number;
  schoors: Record<number, SchoorConfig>;
  tempSchoor: SchoorConfig;
  setTempSchoor: (s: SchoorConfig) => void;
  poleData: PoleData[];
  autoSchoor: boolean;
  autoSchoorThreshold: number;
  onSave: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function SchoorModal({
  selectedSchoorIdx, schoors, tempSchoor, setTempSchoor,
  poleData, autoSchoor, autoSchoorThreshold,
  onSave, onRemove, onClose,
}: Props) {
  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-5 rounded-2xl shadow-2xl z-[9999] border border-emerald-200 w-80">
      <h3 className="font-extrabold text-emerald-800 text-lg mb-4 border-b pb-2">⚓ Setup Penopang (Schoor)</h3>

      {autoSchoor && poleData[selectedSchoorIdx] && poleData[selectedSchoorIdx].angle >= autoSchoorThreshold && !schoors[selectedSchoorIdx] && (
        <div className="mb-3 bg-emerald-50 border border-emerald-300 rounded-lg p-2 text-xs text-emerald-700 font-semibold">
          ⚡ Tiang ini sudah dapat Auto Schoor ({poleData[selectedSchoorIdx].angle.toFixed(1)}° ≥ {autoSchoorThreshold}°). Setting manual akan override auto.
        </div>
      )}

      <div className="mb-4">
        <label className="text-xs text-gray-600 font-bold mb-1 block">Jenis Penopang Mekanis:</label>
        <select className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
          value={tempSchoor.jenis} onChange={e => setTempSchoor({ ...tempSchoor, jenis: e.target.value as SchoorConfig["jenis"] })}>
          <option value="Treck">Treck Schoor (Kawat Tarik Keluar)</option>
          <option value="Druck">Druck Schoor (Tiang Dorong ke Dalam)</option>
          <option value="Kontramast">Kontramast (Tiang Jangkar Seberang)</option>
        </select>
        <p className="text-[10px] text-slate-400 mt-1.5">Putar arah langsung di peta dengan drag ujung penopang.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={onSave} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg text-sm shadow-sm hover:bg-emerald-700">Simpan</button>
        <button onClick={onRemove} className="flex-1 bg-red-100 text-red-600 font-bold py-2 rounded-lg text-sm shadow-sm hover:bg-red-200">🗑️ Hapus</button>
        <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-700 font-bold py-2 rounded-lg text-sm shadow-sm hover:bg-gray-300">Batal</button>
      </div>
    </div>
  );
}
