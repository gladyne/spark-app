"use client";
import { useEffect } from "react";
import type { GarduConfig } from "../../types/spark";
import {
  CANTOL_MAX_KVA,
  getValidTrafoOptions,
  parseKva,
  GARDU_TRAFO_OPTIONS,
} from "../../lib/assetStyles";

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
    if (tempGardu.jenis === "Cantol" && parseKva(tempGardu.trafo) > CANTOL_MAX_KVA) {
      setTempGardu({ ...tempGardu, trafo: "100 kVA" });
    }
  }, [tempGardu.jenis]);

  const activeOptions = trafoOptions && trafoOptions.length > 0 ? trafoOptions : (GARDU_TRAFO_OPTIONS as unknown as string[]);
  const filteredTrafoOptions = getValidTrafoOptions(tempGardu.jenis, activeOptions);
  const showCantolWarning = tempGardu.jenis === "Cantol" && parseKva(tempGardu.trafo) > CANTOL_MAX_KVA;

  const currentRot =
    typeof tempGardu.rotationDeg === "number"
      ? tempGardu.rotationDeg
      : tempGardu.orientasi === "Vertikal"
      ? 90
      : 0;

  const currentOffX = tempGardu.offsetX || 0;
  const currentOffY = tempGardu.offsetY || 0;

  const setRotation = (deg: number) => {
    const normalized = ((deg % 360) + 360) % 360;
    const isVert = normalized >= 45 && normalized < 135 || normalized >= 225 && normalized < 315;
    setTempGardu({
      ...tempGardu,
      rotationDeg: normalized,
      orientasi: isVert ? "Vertikal" : "Horizontal",
    });
  };

  const setOffset = (dx: number, dy: number) => {
    setTempGardu({
      ...tempGardu,
      offsetX: dx,
      offsetY: dy,
    });
  };

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-5 rounded-2xl shadow-2xl z-[9999] border border-purple-200 w-96 max-w-[95vw] max-h-[92vh] overflow-y-auto">
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
              newJenis === "Cantol" && parseKva(tempGardu.trafo) > CANTOL_MAX_KVA
                ? "100 kVA"
                : tempGardu.trafo;
            setTempGardu({ ...tempGardu, jenis: newJenis, trafo: newTrafo });
          }}
        >
          <option value="Cantol">Gardu Cantol (1 Tiang – s/d 100 kVA)</option>
          <option value="Portal">Gardu Portal (2 Tiang – s/d 1000 kVA)</option>
        </select>
      </div>

      {showCantolWarning && (
        <div className="mb-3 bg-red-50 border border-red-400 rounded-lg px-2.5 py-1.5">
          <p className="text-[10px] text-red-700 font-bold">
            ❌ Kapasitas {tempGardu.trafo} melebihi batas Cantol ({CANTOL_MAX_KVA} kVA).
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

      {/* ── Kontrol Rotasi Orientasi Bebas (0-360°) ── */}
      <div className="mb-3 bg-purple-50/70 border border-purple-200 rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-purple-900 font-bold flex items-center gap-1">
            <span>🔄</span> Rotasi Simbol:
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={360}
              value={Math.round(currentRot)}
              onChange={e => setRotation(parseInt(e.target.value) || 0)}
              className="w-16 px-1.5 py-0.5 text-center text-xs font-bold border border-purple-300 rounded bg-white font-mono"
            />
            <span className="text-xs font-bold text-purple-700">°</span>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={360}
          step={5}
          value={Math.round(currentRot)}
          onChange={e => setRotation(parseInt(e.target.value) || 0)}
          className="w-full accent-purple-600 cursor-pointer h-1.5 bg-purple-200 rounded-lg"
        />

        <div className="grid grid-cols-4 gap-1 pt-1">
          <button
            type="button"
            onClick={() => setRotation(0)}
            className={`py-1 text-[10px] font-bold rounded border transition-colors ${
              Math.round(currentRot) === 0
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "bg-white text-purple-700 border-purple-200 hover:bg-purple-100"
            }`}
          >
            0° Horiz
          </button>
          <button
            type="button"
            onClick={() => setRotation(90)}
            className={`py-1 text-[10px] font-bold rounded border transition-colors ${
              Math.round(currentRot) === 90
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "bg-white text-purple-700 border-purple-200 hover:bg-purple-100"
            }`}
          >
            90° Vert
          </button>
          <button
            type="button"
            onClick={() => setRotation(180)}
            className={`py-1 text-[10px] font-bold rounded border transition-colors ${
              Math.round(currentRot) === 180
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "bg-white text-purple-700 border-purple-200 hover:bg-purple-100"
            }`}
          >
            180°
          </button>
          <button
            type="button"
            onClick={() => setRotation(270)}
            className={`py-1 text-[10px] font-bold rounded border transition-colors ${
              Math.round(currentRot) === 270
                ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                : "bg-white text-purple-700 border-purple-200 hover:bg-purple-100"
            }`}
          >
            270°
          </button>
        </div>
      </div>

      {/* ── Kontrol Offset Posisi dari Tiang ── */}
      <div className="mb-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-700 font-bold flex items-center gap-1">
            <span>📐</span> Geser Posisi (Offset):
          </label>
          {(currentOffX !== 0 || currentOffY !== 0) && (
            <button
              type="button"
              onClick={() => setOffset(0, 0)}
              className="text-[10px] text-purple-700 hover:underline font-bold"
            >
              Reset ke Pusat
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1">
            <span className="text-[10px] font-bold text-slate-500">X:</span>
            <input
              type="number"
              value={currentOffX}
              onChange={e => setOffset(parseInt(e.target.value) || 0, currentOffY)}
              className="w-full text-xs font-bold text-slate-800 outline-none font-mono"
            />
            <span className="text-[10px] text-slate-400">px</span>
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1">
            <span className="text-[10px] font-bold text-slate-500">Y:</span>
            <input
              type="number"
              value={currentOffY}
              onChange={e => setOffset(currentOffX, parseInt(e.target.value) || 0)}
              className="w-full text-xs font-bold text-slate-800 outline-none font-mono"
            />
            <span className="text-[10px] text-slate-400">px</span>
          </div>
        </div>

        {/* Nudge buttons */}
        <div className="flex items-center justify-center gap-1 pt-1">
          <button
            type="button"
            onClick={() => setOffset(currentOffX - 5, currentOffY)}
            className="px-2 py-0.5 text-xs font-bold bg-white border border-slate-300 rounded hover:bg-slate-100"
            title="Geser Kiri 5px"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setOffset(currentOffX, currentOffY - 5)}
            className="px-2 py-0.5 text-xs font-bold bg-white border border-slate-300 rounded hover:bg-slate-100"
            title="Geser Atas 5px"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => setOffset(currentOffX, currentOffY + 5)}
            className="px-2 py-0.5 text-xs font-bold bg-white border border-slate-300 rounded hover:bg-slate-100"
            title="Geser Bawah 5px"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => setOffset(currentOffX + 5, currentOffY)}
            className="px-2 py-0.5 text-xs font-bold bg-white border border-slate-300 rounded hover:bg-slate-100"
            title="Geser Kanan 5px"
          >
            →
          </button>
        </div>
      </div>

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
