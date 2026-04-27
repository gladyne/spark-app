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

// Batas kapasitas maksimum untuk Gardu Cantol (standar PLN)
const CANTOL_MAX_KVA = 50;

// Cek apakah nilai trafo (misal "100 kVA") melebihi batas kVA tertentu
function getKva(trafoLabel: string): number {
  return parseInt(trafoLabel.replace(/[^0-9]/g, ""), 10) || 0;
}

export default function GarduModal({ selectedGarduIdx, gardus, tempGardu, setTempGardu, trafoOptions, onSave, onRemove, onClose }: Props) {

  // ─── Efek: auto-reset trafo ke 50 kVA saat berganti ke Cantol ─────────────
  // Jika user memilih "Cantol" tapi trafo sebelumnya > 50 kVA,
  // otomatis turunkan ke 50 kVA agar tidak melanggar batasan teknis
  useEffect(() => {
    if (tempGardu.jenis === "Cantol" && getKva(tempGardu.trafo) > CANTOL_MAX_KVA) {
      setTempGardu({ ...tempGardu, trafo: "50 kVA" });
    }
  }, [tempGardu.jenis]);

  // ─── Filter opsi trafo berdasarkan jenis gardu ───────────────────────────
  // Cantol hanya boleh 50 kVA; Portal boleh semua pilihan
  const filteredTrafoOptions = tempGardu.jenis === "Cantol"
    ? trafoOptions.filter(t => getKva(t) <= CANTOL_MAX_KVA)
    : trafoOptions;

  // Peringatan aktif jika entah bagaimana trafo > 50 kVA untuk Cantol (defensive check)
  const showCantolWarning = tempGardu.jenis === "Cantol" && getKva(tempGardu.trafo) > CANTOL_MAX_KVA;

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-5 rounded-2xl shadow-2xl z-[9999] border border-blue-200 w-80">
      <h3 className="font-extrabold text-blue-800 text-lg mb-4 border-b pb-2">⚙️ Setup Gardu Trafo</h3>

      <div className="mb-3">
        <label className="text-xs text-gray-600 font-bold mb-1 block">Jenis Konstruksi:</label>
        <select
          className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
          value={tempGardu.jenis}
          onChange={e => {
            const newJenis = e.target.value as GarduConfig["jenis"];
            // Saat berganti ke Cantol, paksa trafo ke 50 kVA jika perlu
            const newTrafo = newJenis === "Cantol" && getKva(tempGardu.trafo) > CANTOL_MAX_KVA
              ? "50 kVA"
              : tempGardu.trafo;
            setTempGardu({ ...tempGardu, jenis: newJenis, trafo: newTrafo });
          }}
        >
          <option value="Cantol">Gardu Cantol (1 Tiang)</option>
          <option value="Portal">Gardu Portal (2 Tiang)</option>
        </select>
      </div>

      {/* ─── Informasi batas kapasitas Cantol ─────────────────────────────── */}
      {tempGardu.jenis === "Cantol" && (
        <div className="mb-3 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 flex items-start gap-2">
          <span className="text-amber-500 text-base flex-shrink-0">⚠️</span>
          <p className="text-[11px] text-amber-700 font-semibold leading-snug">
            Gardu Cantol hanya diizinkan kapasitas <strong>maksimal 50 kVA</strong> sesuai standar konstruksi PLN.
          </p>
        </div>
      )}

      {/* ─── Peringatan jika validasi dilanggar (defensive) ────────────────── */}
      {showCantolWarning && (
        <div className="mb-3 bg-red-50 border border-red-400 rounded-lg px-3 py-2">
          <p className="text-[11px] text-red-700 font-bold">
            ❌ Kapasitas {tempGardu.trafo} tidak valid untuk Cantol! Maksimal 50 kVA.
          </p>
        </div>
      )}

      {tempGardu.jenis === "Portal" && (
        <div className="mb-3">
          <label className="text-xs text-gray-600 font-bold mb-1 block">Orientasi Portal:</label>
          <select
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
            value={tempGardu.orientasi}
            onChange={e => setTempGardu({ ...tempGardu, orientasi: e.target.value as GarduConfig["orientasi"] })}
          >
            <option value="Horizontal">Horizontal (Sejajar Jalan)</option>
            <option value="Vertikal">Vertikal (Melintang Jalan)</option>
          </select>
        </div>
      )}

      <div className="mb-4">
        <label className="text-xs text-gray-600 font-bold mb-1 block">
          Kapasitas Trafo:
          {/* Badge kunci untuk Cantol */}
          {tempGardu.jenis === "Cantol" && (
            <span className="ml-2 bg-amber-200 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              🔒 Terkunci ≤ 50 kVA
            </span>
          )}
        </label>
        {/* Dropdown hanya menampilkan opsi yang valid untuk jenis gardu yang dipilih */}
        <select
          className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
          value={tempGardu.trafo}
          onChange={e => setTempGardu({ ...tempGardu, trafo: e.target.value })}
        >
          {filteredTrafoOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={showCantolWarning}
          className={`flex-1 font-bold py-2 rounded-lg text-sm shadow-sm transition-all ${showCantolWarning ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
        >
          Simpan
        </button>
        {gardus[selectedGarduIdx] && (
          <button onClick={onRemove} className="flex-1 bg-red-100 text-red-600 font-bold py-2 rounded-lg text-sm shadow-sm hover:bg-red-200">Hapus</button>
        )}
        <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-700 font-bold py-2 rounded-lg text-sm shadow-sm hover:bg-gray-300">Batal</button>
      </div>
    </div>
  );
}
