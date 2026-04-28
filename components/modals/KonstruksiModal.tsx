"use client";
import { useState, useEffect } from "react";

interface Props {
  jenisJaringan: string;
  computedShort: string;
  computedLong: string;
  overrideValue: string | undefined;
  onSave: (value: string | undefined) => void;
  onClose: () => void;
}

function getOptions(jenisJaringan: string): { value: string; label: string }[] {
  if (jenisJaringan.includes("SUTM")) {
    return [
      { value: "A1", label: "A1 – Tiang Lurus" },
      { value: "A2", label: "A2 – Tiang Belok Ringan (10–30°)" },
      { value: "A3", label: "A3 – Tiang Ujung / Tarik" },
      { value: "B3", label: "B3 – Gawang Panjang (≥70m)" },
      { value: "2xA3", label: "2xA3 – Tiang Belok Berat (>30°)" },
    ];
  }
  if (jenisJaringan.includes("SKUTR") || jenisJaringan.includes("Underbuild")) {
    return [
      { value: "FDE", label: "FDE – Fix Dead End (Tiang Awal)" },
      { value: "S", label: "S – Suspension Assembly" },
      { value: "LA", label: "LA – Large Angle Assembly" },
      { value: "BDL+DE", label: "BDL+DE – Bundle End + Dead End (Tiang Akhir)" },
    ];
  }
  if (jenisJaringan === "SKUTM") {
    return [
      { value: "Trm", label: "Trm – Terminasi" },
      { value: "2xTrm", label: "2×Trm – Double Terminasi (500m / 1000m)" },
      { value: "LA", label: "LA – Large Angle (5–75°)" },
      { value: "S", label: "S – Suspension" },
    ];
  }
  if (jenisJaringan === "SKTM" || jenisJaringan === "SKTR") {
    return [
      { value: "TRM", label: "TRM – Terminasi (Ujung Kabel)" },
      { value: "JNT", label: "JNT – Jointing (Sambungan Tengah)" },
    ];
  }
  return [];
}

export default function KonstruksiModal({ jenisJaringan, computedShort, computedLong, overrideValue, onSave, onClose }: Props) {
  const options = getOptions(jenisJaringan);
  const [selected, setSelected] = useState<string>(overrideValue ?? computedShort);

  useEffect(() => {
    setSelected(overrideValue ?? computedShort);
  }, [overrideValue, computedShort]);

  const isOverridden = overrideValue !== undefined;
  const hasChanged = selected !== (overrideValue ?? computedShort);

  if (options.length === 0) return null;

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-5 rounded-2xl shadow-2xl z-[9999] border border-orange-200 w-80">
      <h3 className="font-extrabold text-orange-800 text-lg mb-1 border-b pb-2">⚙️ Edit Konstruksi Tiang</h3>
      <p className="text-[11px] text-gray-400 mb-3">{jenisJaringan}</p>

      <div className="mb-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Konstruksi Otomatis</p>
        <p className="text-sm font-bold text-gray-700">
          {computedShort}
          {computedLong && computedLong !== computedShort && (
            <span className="ml-1 font-normal text-gray-400 text-xs">– {computedLong.replace(/\s*\(.*?\)\s*/g, "").trim()}</span>
          )}
        </p>
      </div>

      {isOverridden && (
        <div className="mb-3 bg-orange-50 border border-orange-300 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-orange-500 text-sm">✏️</span>
          <p className="text-[11px] text-orange-700 font-semibold">Override aktif: <strong>{overrideValue}</strong></p>
        </div>
      )}

      <div className="mb-4">
        <label className="text-xs text-gray-600 font-bold mb-1 block">Pilih Konstruksi:</label>
        <select
          className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(selected)}
          disabled={!hasChanged && !isOverridden && selected === computedShort}
          className={`flex-1 font-bold py-2 rounded-lg text-sm shadow-sm transition-all ${
            selected !== computedShort || isOverridden
              ? "bg-orange-600 text-white hover:bg-orange-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          Simpan
        </button>
        {isOverridden && (
          <button
            onClick={() => onSave(undefined)}
            className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-lg text-sm shadow-sm hover:bg-gray-200"
          >
            ↩ Reset Otomatis
          </button>
        )}
        <button onClick={onClose} className="flex-1 bg-red-50 text-red-600 font-bold py-2 rounded-lg text-sm shadow-sm hover:bg-red-100">Batal</button>
      </div>
    </div>
  );
}
