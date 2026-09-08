"use client";
import { useEffect } from "react";
import type { GarduConfig } from "../../types/spark";

interface Props {
  selectedGarduIdx: number;
  gardus: Record<number, GarduConfig>;
  tempGardu: GarduConfig;
  setTempGardu: (g: GarduConfig) => void;
  trafoOptions: string[];
  onSave: () => void;
  onRemove: () => void;
  onClose: () => void;
}

const CANTOL_MAX_KVA = 50;

function getKva(trafoLabel: string): number {
  return parseInt(trafoLabel.replace(/[^0-9]/g, ""), 10) || 0;
}

export default function GarduModal({
  selectedGarduIdx,
  gardus,
  tempGardu,
  setTempGardu,
  trafoOptions,
  onSave,
  onRemove,
  onClose,
}: Props) {
  useEffect(() => {
    if (tempGardu.jenis === "Cantol" && getKva(tempGardu.trafo) > CANTOL_MAX_KVA) {
      setTempGardu({ ...tempGardu, trafo: "50 kVA" });
    }
  }, [tempGardu.jenis]);

  const defaultTrafoList = [
    "25 kVA",
    "50 kVA",
    "100 kVA",
    "160 kVA",
    "200 kVA",
    "250 kVA",
    "400 kVA",
    "630 kVA",
    "1000 kVA",
  ];
  const activeOptions = trafoOptions && trafoOptions.length > 0 ? trafoOptions : defaultTrafoList;

  const filteredTrafoOptions =
    tempGardu.jenis === "Cantol"
      ? activeOptions.filter(t => getKva(t) <= CANTOL_MAX_KVA)
      : activeOptions;

  const showCantolWarning = tempGardu.jenis === "Cantol" && getKva(tempGardu.trafo) > CANTOL_MAX_KVA;

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-5 rounded-2xl shadow-2xl z-[9999] border border-purple-200 w-84 max-w-[90vw]">
      <div className="flex items-center justify-between border-b pb-2 mb-3">
        <h3 className="font-extrabold text-purple-900 text-base flex items-center gap-1.5">
          <span>⚙️</span> Setup Gardu Distribusi
        </h3>
        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
          RAB Kolom G
        </span>
      </div>

      <div className="mb-3">
        <label className="text-xs text-gray-600 font-bold mb-1 block">Jenis Gardu:</label>
        <select
          className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-semibold focus:ring-2 focus:ring-purple-400 outline-none"
          value={tempGardu.jenis}
          onChange={e => {
            const newJenis = e.target.value as GarduConfig["jenis"];
            const newTrafo =
              newJenis === "Cantol" && getKva(tempGardu.trafo) > CANTOL_MAX_KVA
                ? "50 kVA"
                : tempGardu.trafo;
            setTempGardu({ ...tempGardu, jenis: newJenis, trafo: newTrafo });
          }}
        >
          <option value="Cantol">Gardu Cantol (1 Tiang – Maks 50 kVA)</option>
          <option value="Portal">Gardu Portal (2 Tiang – s/d 1000 kVA)</option>
        </select>
      </div>

      {tempGardu.jenis === "Cantol" && (
        <div className="mb-3 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
          <span className="text-amber-500 text-xs flex-shrink-0">⚠️</span>
          <p className="text-[10px] text-amber-800 font-semibold leading-snug">
            Gardu Cantol dibatasi maks 50 kVA sesuai standar KHS PLN UP3 Kupang.
          </p>
        </div>
      )}

      {showCantolWarning && (
        <div className="mb-3 bg-red-50 border border-red-400 rounded-lg px-2.5 py-1.5">
          <p className="text-[10px] text-red-700 font-bold">
            ❌ Kapasitas {tempGardu.trafo} melebihi batas Cantol (50 kVA).
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-gray-600 font-bold mb-1 block">Fasa Trafo:</label>
          <select
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-semibold focus:ring-2 focus:ring-purple-400 outline-none"
            value={tempGardu.fasa || "3 phs"}
            onChange={e => setTempGardu({ ...tempGardu, fasa: e.target.value as any })}
          >
            <option value="3 phs">3 Fasa (Standar KHS)</option>
            <option value="1 phs">1 Fasa</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-600 font-bold mb-1 block">Kapasitas (kVA):</label>
          <select
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-semibold focus:ring-2 focus:ring-purple-400 outline-none"
            value={tempGardu.trafo}
            onChange={e => setTempGardu({ ...tempGardu, trafo: e.target.value })}
          >
            {filteredTrafoOptions.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {tempGardu.jenis === "Portal" && (
        <div className="mb-3">
          <label className="text-xs text-gray-600 font-bold mb-1 block">Orientasi Portal:</label>
          <select
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-xs font-semibold focus:ring-2 focus:ring-purple-400 outline-none"
            value={tempGardu.orientasi}
            onChange={e => setTempGardu({ ...tempGardu, orientasi: e.target.value as GarduConfig["orientasi"] })}
          >
            <option value="Horizontal">Horizontal (Sejajar Rute)</option>
            <option value="Vertikal">Vertikal (Melintang Rute)</option>
          </select>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onSave}
          disabled={showCantolWarning}
          className={`flex-1 font-bold py-2 rounded-xl text-xs shadow-sm transition-all ${
            showCantolWarning
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-purple-700 text-white hover:bg-purple-800 shadow-purple-500/25"
          }`}
        >
          Simpan Gardu
        </button>
        {gardus[selectedGarduIdx] && (
          <button
            onClick={onRemove}
            className="px-3 bg-red-50 text-red-600 font-bold py-2 rounded-xl text-xs hover:bg-red-100 border border-red-200"
          >
            Hapus
          </button>
        )}
        <button
          onClick={onClose}
          className="px-3 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-xs hover:bg-gray-200"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
