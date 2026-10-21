"use client";

import React, { useState } from "react";
import type {
  SurveyFormData,
  BebanJalurRow,
  TeganganPangkalRow,
} from "../../../types/schematic";

interface Props {
  open: boolean;
  onClose: () => void;
  surveyData: SurveyFormData;
  onChange: (updated: SurveyFormData) => void;
}

type TabType = "kop" | "jaringan" | "pengukuran" | "persetujuan" | "dokumentasi";

export default function SurveyDataModal({
  open,
  onClose,
  surveyData,
  onChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("kop");

  if (!open) return null;

  // Helper deep update
  const updateKop = (field: string, val: string) => {
    onChange({
      ...surveyData,
      kop: {
        ...(surveyData?.kop || {}),
        [field]: val,
      },
    });
  };

  const updateJtm = (field: string, val: string) => {
    onChange({
      ...surveyData,
      jtm: {
        ...(surveyData?.jtm || {}),
        [field]: val,
      },
    });
  };

  const updateGardu = (field: string, val: string) => {
    onChange({
      ...surveyData,
      gardu: {
        ...(surveyData?.gardu || {}),
        [field]: val,
      },
    });
  };

  const updateJtr = (field: string, val: string) => {
    onChange({
      ...surveyData,
      jtr: {
        ...(surveyData?.jtr || {}),
        [field]: val,
      },
    });
  };

  const updatePengukuran = (field: string, val: unknown) => {
    onChange({
      ...surveyData,
      pengukuran: {
        ...(surveyData?.pengukuran || {}),
        [field]: val,
      },
    });
  };

  const updatePersetujuan = (index: 0 | 1 | 2, field: string, val: string) => {
    const defaultPersetujuan = [
      { roleTitle: "DISETUJUI", staffTitle: "STAFF TEKNIK", nama: "" },
      { roleTitle: "DISETUJUI", staffTitle: "STAFF TEKNIK", nama: "" },
      { roleTitle: "DISETUJUI", staffTitle: "STAFF TEKNIK", nama: "" },
    ];
    const sourceCols = surveyData?.kop?.persetujuan || defaultPersetujuan;
    const nextCols = [...sourceCols] as [
      (typeof defaultPersetujuan)[0],
      (typeof defaultPersetujuan)[1],
      (typeof defaultPersetujuan)[2]
    ];
    nextCols[index] = {
      ...(nextCols[index] || defaultPersetujuan[index]),
      [field]: val,
    };
    onChange({
      ...surveyData,
      kop: {
        ...(surveyData?.kop || {}),
        persetujuan: nextCols,
      },
    });
  };

  // Handle Photo Upload (Base64)
  const handlePhotoUpload = (
    key: "fotoBangunanPelanggan" | "fotoTitikPengambilan" | "fotoLokasiRencanaGarsip" | "customLogoUrl",
    file: File | null
  ) => {
    if (!file) {
      if (key === "customLogoUrl") {
        onChange({ ...surveyData, customLogoUrl: undefined });
      } else {
        onChange({
          ...surveyData,
          dokumentasi: {
            ...surveyData.dokumentasi,
            [key]: undefined,
          },
        });
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (key === "customLogoUrl") {
        onChange({ ...surveyData, customLogoUrl: result });
      } else {
        onChange({
          ...surveyData,
          dokumentasi: {
            ...surveyData.dokumentasi,
            [key]: result,
          },
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Dynamic Row: Beban Jalur Jurusan
  const addBebanJurusanRow = () => {
    const current = surveyData.pengukuran.bebanJalurRows || [];
    const count = current.length;
    const newRow: BebanJalurRow = {
      id: `bj_jurusan_${Date.now()}`,
      nama: `JURUSAN ${String.fromCharCode(64 + count)}`,
      r: "",
      s: "",
      t: "",
      n: "",
    };
    updatePengukuran("bebanJalurRows", [...current, newRow]);
  };

  const removeBebanJurusanRow = (id: string) => {
    const current = surveyData.pengukuran.bebanJalurRows || [];
    if (current.length <= 1) return; // jangan hapus jika tinggal 1
    updatePengukuran("bebanJalurRows", current.filter(r => r.id !== id));
  };

  const updateBebanJurusanRow = (id: string, field: string, val: string) => {
    const current = surveyData.pengukuran.bebanJalurRows || [];
    const next = current.map(r => (r.id === id ? { ...r, [field]: val } : r));
    updatePengukuran("bebanJalurRows", next);
  };

  // Dynamic Row: Tegangan Pangkal Jurusan
  const addTeganganJurusanRow = () => {
    const current = surveyData.pengukuran.teganganPangkalRows || [];
    const count = current.length;
    const newRow: TeganganPangkalRow = {
      id: `tp_jurusan_${Date.now()}`,
      nama: `JURUSAN ${String.fromCharCode(64 + count)}`,
      rn: "",
      sn: "",
      tn: "",
      rs: "",
      rt: "",
      st: "",
    };
    updatePengukuran("teganganPangkalRows", [...current, newRow]);
  };

  const removeTeganganJurusanRow = (id: string) => {
    const current = surveyData.pengukuran.teganganPangkalRows || [];
    if (current.length <= 1) return;
    updatePengukuran("teganganPangkalRows", current.filter(r => r.id !== id));
  };

  const updateTeganganJurusanRow = (id: string, field: string, val: string) => {
    const current = surveyData.pengukuran.teganganPangkalRows || [];
    const next = current.map(r => (r.id === id ? { ...r, [field]: val } : r));
    updatePengukuran("teganganPangkalRows", next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📋</span>
            <div>
              <h3 className="font-extrabold text-base text-white tracking-tight">
                Panel Isian Data Gambar Survei UP3 Kupang
              </h3>
              <p className="text-xs text-slate-400">
                Data tersimpan per proyek dan otomatis mengisi format cetak A2
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-slate-800 bg-slate-900/90 overflow-x-auto">
          {[
            { id: "kop", label: "Kop & Pelanggan", icon: "📑" },
            { id: "jaringan", label: "Data Jaringan (TM/Gardu/TR)", icon: "⚡" },
            { id: "pengukuran", label: "Tabel Pengukuran", icon: "📐" },
            { id: "persetujuan", label: "Persetujuan (3 Kolom)", icon: "✍️" },
            { id: "dokumentasi", label: "Dokumentasi & Logo", icon: "📷" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-3 py-2 rounded-t-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-slate-800 text-blue-400 border-blue-500"
                  : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ════════ TAB 1: KOP & PELANGGAN ════════ */}
          {activeTab === "kop" && (
            <div className="space-y-4">
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Judul &amp; Data Pelanggan
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Nama Pekerjaan / Konstruksi:
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.namaPekerjaan || ""}
                      onChange={e => updateKop("namaPekerjaan", e.target.value)}
                      placeholder="e.g. PEMBANGUNAN JTM & GARDU ELEVATE"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Data Pelanggan (Nama):
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.dataPelanggan || ""}
                      onChange={e => updateKop("dataPelanggan", e.target.value)}
                      placeholder="Nama pelanggan / instansi"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Alamat Pelanggan:
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.alamat || ""}
                      onChange={e => updateKop("alamat", e.target.value)}
                      placeholder="Alamat lengkap lokasi survei"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Jenis Permohonan:
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.permohonan || ""}
                      onChange={e => updateKop("permohonan", e.target.value)}
                      placeholder="e.g. Pasang Baru / Tambah Daya"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Keterangan:
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.keterangan || ""}
                      onChange={e => updateKop("keterangan", e.target.value)}
                      placeholder="Catatan tambahan (default: -)"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Daya Lama (kVA):
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.dayaLama || ""}
                      onChange={e => updateKop("dayaLama", e.target.value)}
                      placeholder="000 (kosong = 000)"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Daya Baru (kVA):
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.dayaBaru || ""}
                      onChange={e => updateKop("dayaBaru", e.target.value)}
                      placeholder="000 (kosong = 000)"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Metadata &amp; Pengarsipan Gambar
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Titik Koordinat:
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.titikKoordinat || ""}
                      onChange={e => updateKop("titikKoordinat", e.target.value)}
                      placeholder="e.g. -10.123456 / 123.456789"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Nomor Gambar:
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.nomorGambar || ""}
                      onChange={e => updateKop("nomorGambar", e.target.value)}
                      placeholder="e.g. 01/SKM/SPARK/2026"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Revisi:
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.revisi || ""}
                      onChange={e => updateKop("revisi", e.target.value)}
                      placeholder="e.g. 00 / 01"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Halaman:
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.halaman || "1 / 1"}
                      onChange={e => updateKop("halaman", e.target.value)}
                      placeholder="e.g. 1 / 1"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Tanggal:
                    </label>
                    <input
                      type="text"
                      value={surveyData.kop.tanggal || ""}
                      onChange={e => updateKop("tanggal", e.target.value)}
                      placeholder="dd / mm / yyyy"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════ TAB 2: DATA JARINGAN ════════ */}
          {activeTab === "jaringan" && (
            <div className="space-y-4">
              {/* 1. DATA JTM */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <span>⚡</span> DATA JARINGAN TEGANGAN MENENGAH (PERLUASAN)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Nama Penyulang:
                    </label>
                    <input
                      type="text"
                      value={surveyData.jtm.namaPenyulang || ""}
                      onChange={e => updateJtm("namaPenyulang", e.target.value)}
                      placeholder="Nama penyulang eksisting"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Titik Pengambilan (Koordinat):
                    </label>
                    <input
                      type="text"
                      value={surveyData.jtm.titikPengambilan || ""}
                      onChange={e => updateJtm("titikPengambilan", e.target.value)}
                      placeholder="-10.xxxxxx / 123.xxxxxx"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Konstruksi Pengambilan:
                    </label>
                    <input
                      type="text"
                      value={surveyData.jtm.konstruksiPengambilan || ""}
                      onChange={e => updateJtm("konstruksiPengambilan", e.target.value)}
                      placeholder="e.g. 2 x A3 - TIANG BETON 12M 350 daN"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Konduktor Pengambilan:
                    </label>
                    <input
                      type="text"
                      value={surveyData.jtm.konduktorPengambilan || ""}
                      onChange={e => updateJtm("konduktorPengambilan", e.target.value)}
                      placeholder="e.g. AAAC/S atau AAAC"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Ukuran Konduktor (MM):
                    </label>
                    <input
                      type="text"
                      value={surveyData.jtm.ukuranKonduktor || ""}
                      onChange={e => updateJtm("ukuranKonduktor", e.target.value)}
                      placeholder="e.g. 70 atau 150"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. DATA GARDU DISTRIBUSI */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <span>🏛️</span> DATA GARDU DISTRIBUSI
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Kode Gardu:
                    </label>
                    <input
                      type="text"
                      value={surveyData.gardu.kodeGardu || ""}
                      onChange={e => updateGardu("kodeGardu", e.target.value)}
                      placeholder="e.g. KPG012"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Kapasitas Gardu (kVA):
                    </label>
                    <input
                      type="text"
                      value={surveyData.gardu.kapasitasGardu || ""}
                      onChange={e => updateGardu("kapasitasGardu", e.target.value)}
                      placeholder="e.g. 100, 160, 200"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Beban Gardu / % (kVA):
                    </label>
                    <input
                      type="text"
                      value={surveyData.gardu.bebanGardu || ""}
                      onChange={e => updateGardu("bebanGardu", e.target.value)}
                      placeholder="e.g. 80"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Tipe PHB TR (Jurusan):
                    </label>
                    <input
                      type="text"
                      value={surveyData.gardu.tipePhbTr || ""}
                      onChange={e => updateGardu("tipePhbTr", e.target.value)}
                      placeholder="e.g. 2 atau 4"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. DATA JTR */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-green-400 flex items-center gap-1.5">
                  <span>🔌</span> DATA JARINGAN TEGANGAN RENDAH (PERLUASAN)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Jurusan Pengambilan:
                    </label>
                    <input
                      type="text"
                      value={surveyData.jtr.jurusanPengambilan || ""}
                      onChange={e => updateJtr("jurusanPengambilan", e.target.value)}
                      placeholder="e.g. JURUSAN A"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Konstruksi Eksisting:
                    </label>
                    <input
                      type="text"
                      value={surveyData.jtr.konstruksiEksisting || ""}
                      onChange={e => updateJtr("konstruksiEksisting", e.target.value)}
                      placeholder="e.g. LA - TIANG BESI 9M 200 daN"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Kabel Power Eksisting:
                    </label>
                    <input
                      type="text"
                      value={surveyData.jtr.kabelPowerEksisting || ""}
                      onChange={e => updateJtr("kabelPowerEksisting", e.target.value)}
                      placeholder="e.g. LVTC"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Ukuran Kabel Power:
                    </label>
                    <input
                      type="text"
                      value={surveyData.jtr.ukuranKabelPower || ""}
                      onChange={e => updateJtr("ukuranKabelPower", e.target.value)}
                      placeholder="e.g. 4 x 70 MM"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Jarak Gardu ke Lokasi / Pengambilan (kms):
                    </label>
                    <input
                      type="text"
                      value={surveyData.jtr.jarakGarduKeLokasi || ""}
                      onChange={e => updateJtr("jarakGarduKeLokasi", e.target.value)}
                      placeholder="e.g. 0.5 atau 1"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════ TAB 3: TABEL PENGUKURAN ════════ */}
          {activeTab === "pengukuran" && (
            <div className="space-y-4">
              {/* Header Pengukuran Gardu */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    1. Pengukuran Gardu Distribusi
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-semibold">Kode Gardu:</span>
                    <input
                      type="text"
                      value={surveyData.pengukuran.kodeGardu || ""}
                      onChange={e => updatePengukuran("kodeGardu", e.target.value)}
                      placeholder="e.g. KPG123"
                      className="w-28 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white text-center font-mono outline-none"
                    />
                  </div>
                </div>

                {/* Sub-tabel 1: Beban Jalur */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-300 uppercase">
                      Tabel Beban Jalur (Ampere)
                    </span>
                    <button
                      onClick={addBebanJurusanRow}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>+</span> Tambah Baris Jurusan
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 border-b border-slate-700 font-semibold">
                          <th className="p-2">Jalur / Jurusan</th>
                          <th className="p-2 w-20 text-center">R (A)</th>
                          <th className="p-2 w-20 text-center">S (A)</th>
                          <th className="p-2 w-20 text-center">T (A)</th>
                          <th className="p-2 w-20 text-center">N (A)</th>
                          <th className="p-2 w-12 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {surveyData.pengukuran.bebanJalurRows.map((row, idx) => (
                          <tr key={row.id || idx}>
                            <td className="p-1.5">
                              {idx === 0 ? (
                                <span className="font-bold text-slate-200">BEBAN UTAMA</span>
                              ) : (
                                <input
                                  type="text"
                                  value={row.nama}
                                  onChange={e => updateBebanJurusanRow(row.id, "nama", e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                                />
                              )}
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.r || ""}
                                onChange={e => updateBebanJurusanRow(row.id, "r", e.target.value)}
                                placeholder="-"
                                className="w-full px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-center font-mono text-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.s || ""}
                                onChange={e => updateBebanJurusanRow(row.id, "s", e.target.value)}
                                placeholder="-"
                                className="w-full px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-center font-mono text-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.t || ""}
                                onChange={e => updateBebanJurusanRow(row.id, "t", e.target.value)}
                                placeholder="-"
                                className="w-full px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-center font-mono text-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.n || ""}
                                onChange={e => updateBebanJurusanRow(row.id, "n", e.target.value)}
                                placeholder="-"
                                className="w-full px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-center font-mono text-white"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              {idx > 0 && (
                                <button
                                  onClick={() => removeBebanJurusanRow(row.id)}
                                  className="text-red-400 hover:text-red-300 p-1 text-xs cursor-pointer"
                                  title="Hapus baris"
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sub-tabel 2: Tegangan Pangkal */}
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-300 uppercase">
                      Tabel Tegangan Pangkal (Volt)
                    </span>
                    <button
                      onClick={addTeganganJurusanRow}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>+</span> Tambah Baris Jurusan
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 border-b border-slate-700 font-semibold">
                          <th className="p-2">Jalur / Jurusan</th>
                          <th className="p-2 w-16 text-center">R-N (V)</th>
                          <th className="p-2 w-16 text-center">S-N (V)</th>
                          <th className="p-2 w-16 text-center">T-N (V)</th>
                          <th className="p-2 w-16 text-center">R-S (V)</th>
                          <th className="p-2 w-16 text-center">R-T (V)</th>
                          <th className="p-2 w-16 text-center">S-T (V)</th>
                          <th className="p-2 w-10 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {surveyData.pengukuran.teganganPangkalRows.map((row, idx) => (
                          <tr key={row.id || idx}>
                            <td className="p-1.5">
                              {idx === 0 ? (
                                <span className="font-bold text-slate-200">UTAMA</span>
                              ) : (
                                <input
                                  type="text"
                                  value={row.nama}
                                  onChange={e => updateTeganganJurusanRow(row.id, "nama", e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                                />
                              )}
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.rn || ""}
                                onChange={e => updateTeganganJurusanRow(row.id, "rn", e.target.value)}
                                placeholder="-"
                                className="w-full px-1 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-center font-mono text-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.sn || ""}
                                onChange={e => updateTeganganJurusanRow(row.id, "sn", e.target.value)}
                                placeholder="-"
                                className="w-full px-1 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-center font-mono text-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.tn || ""}
                                onChange={e => updateTeganganJurusanRow(row.id, "tn", e.target.value)}
                                placeholder="-"
                                className="w-full px-1 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-center font-mono text-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.rs || ""}
                                onChange={e => updateTeganganJurusanRow(row.id, "rs", e.target.value)}
                                placeholder="-"
                                className="w-full px-1 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-center font-mono text-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.rt || ""}
                                onChange={e => updateTeganganJurusanRow(row.id, "rt", e.target.value)}
                                placeholder="-"
                                className="w-full px-1 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-center font-mono text-white"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.st || ""}
                                onChange={e => updateTeganganJurusanRow(row.id, "st", e.target.value)}
                                placeholder="-"
                                className="w-full px-1 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-center font-mono text-white"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              {idx > 0 && (
                                <button
                                  onClick={() => removeTeganganJurusanRow(row.id)}
                                  className="text-red-400 hover:text-red-300 p-1 text-xs cursor-pointer"
                                  title="Hapus baris"
                                >
                                  ✕
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* 2. Pengukuran JTR */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-green-400">
                  2. Pengukuran JTR &amp; Tegangan APP
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Kode JTR:
                    </label>
                    <input
                      type="text"
                      value={surveyData.pengukuran.kodeJtr || ""}
                      onChange={e => updatePengukuran("kodeJtr", e.target.value)}
                      placeholder="e.g. JTR KPG123 D2A1C5"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      V Pangkal R-N (V):
                    </label>
                    <input
                      type="text"
                      value={surveyData.pengukuran.jtrRn || ""}
                      onChange={e => updatePengukuran("jtrRn", e.target.value)}
                      placeholder="-"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      V Pangkal S-N (V):
                    </label>
                    <input
                      type="text"
                      value={surveyData.pengukuran.jtrSn || ""}
                      onChange={e => updatePengukuran("jtrSn", e.target.value)}
                      placeholder="-"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      V Pangkal T-N (V):
                    </label>
                    <input
                      type="text"
                      value={surveyData.pengukuran.jtrTn || ""}
                      onChange={e => updatePengukuran("jtrTn", e.target.value)}
                      placeholder="-"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      IDPEL Pelanggan (Khusus Landscape):
                    </label>
                    <input
                      type="text"
                      value={surveyData.pengukuran.idpel || ""}
                      onChange={e => updatePengukuran("idpel", e.target.value)}
                      placeholder="e.g. 531100000000"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Tegangan APP (Volt - Khusus Landscape):
                    </label>
                    <input
                      type="text"
                      value={surveyData.pengukuran.teganganApp || ""}
                      onChange={e => updatePengukuran("teganganApp", e.target.value)}
                      placeholder="e.g. 220 atau 380"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════ TAB 4: PERSETUJUAN ════════ */}
          {activeTab === "persetujuan" && (
            <div className="space-y-4">
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Tiga Kolom Paraf &amp; Persetujuan Resmi
                </h4>
                <p className="text-xs text-slate-400">
                  Kolom persetujuan ini tampil di bagian bawah kop gambar resmi (default kosong &quot;-&quot;).
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[0, 1, 2].map(idx => {
                    const col = surveyData.kop.persetujuan[idx as 0 | 1 | 2];
                    return (
                      <div
                        key={idx}
                        className="bg-slate-900 p-3.5 rounded-xl border border-slate-700/80 space-y-2.5"
                      >
                        <div className="font-bold text-xs text-amber-400">
                          Kolom {idx + 1}
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                            Status / Keputusan:
                          </label>
                          <input
                            type="text"
                            value={col.roleTitle}
                            onChange={e => updatePersetujuan(idx as 0 | 1 | 2, "roleTitle", e.target.value)}
                            placeholder="DISETUJUI"
                            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-650 rounded-lg text-xs text-white font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                            Jabatan:
                          </label>
                          <input
                            type="text"
                            value={col.staffTitle}
                            onChange={e => updatePersetujuan(idx as 0 | 1 | 2, "staffTitle", e.target.value)}
                            placeholder="STAFF TEKNIK"
                            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-650 rounded-lg text-xs text-white font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                            Nama Terang:
                          </label>
                          <input
                            type="text"
                            value={col.nama}
                            onChange={e => updatePersetujuan(idx as 0 | 1 | 2, "nama", e.target.value)}
                            placeholder="Nama Petugas / Pejabat"
                            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-650 rounded-lg text-xs text-white"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ════════ TAB 5: DOKUMENTASI & LOGO ════════ */}
          {activeTab === "dokumentasi" && (
            <div className="space-y-4">
              {/* Foto Dokumentasi Lapangan */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                    Foto Dokumentasi Lapangan (Ref Halaman 4)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Unggah foto untuk halaman lampiran dokumentasi. Foto akan otomatis di-crop proporsional tanpa distorsi.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Foto 1: Bangunan Pelanggan */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
                    <span className="font-extrabold text-[11px] text-slate-300 uppercase mb-2 text-center">
                      Foto Bangunan Pelanggan
                    </span>
                    <div className="w-full h-44 bg-slate-950 border border-dashed border-slate-700 rounded-lg overflow-hidden flex items-center justify-center relative mb-2">
                      {surveyData.dokumentasi.fotoBangunanPelanggan ? (
                        <img
                          src={surveyData.dokumentasi.fotoBangunanPelanggan}
                          alt="Bangunan"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-500 font-medium">(Kosong)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <label className="flex-1 py-1.5 text-center bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer transition">
                        Unggah Foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handlePhotoUpload("fotoBangunanPelanggan", e.target.files?.[0] || null)}
                        />
                      </label>
                      {surveyData.dokumentasi.fotoBangunanPelanggan && (
                        <button
                          onClick={() => handlePhotoUpload("fotoBangunanPelanggan", null)}
                          className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Foto 2: Titik Pengambilan */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
                    <span className="font-extrabold text-[11px] text-slate-300 uppercase mb-2 text-center">
                      Foto Titik Pengambilan
                    </span>
                    <div className="w-full h-44 bg-slate-950 border border-dashed border-slate-700 rounded-lg overflow-hidden flex items-center justify-center relative mb-2">
                      {surveyData.dokumentasi.fotoTitikPengambilan ? (
                        <img
                          src={surveyData.dokumentasi.fotoTitikPengambilan}
                          alt="Titik Pengambilan"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-500 font-medium">(Kosong)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <label className="flex-1 py-1.5 text-center bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer transition">
                        Unggah Foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handlePhotoUpload("fotoTitikPengambilan", e.target.files?.[0] || null)}
                        />
                      </label>
                      {surveyData.dokumentasi.fotoTitikPengambilan && (
                        <button
                          onClick={() => handlePhotoUpload("fotoTitikPengambilan", null)}
                          className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Foto 3: Lokasi Rencana Garsip */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
                    <span className="font-extrabold text-[11px] text-slate-300 uppercase mb-2 text-center">
                      Foto Lokasi Rencana Garsip
                    </span>
                    <div className="w-full h-44 bg-slate-950 border border-dashed border-slate-700 rounded-lg overflow-hidden flex items-center justify-center relative mb-2">
                      {surveyData.dokumentasi.fotoLokasiRencanaGarsip ? (
                        <img
                          src={surveyData.dokumentasi.fotoLokasiRencanaGarsip}
                          alt="Lokasi Garsip"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-500 font-medium">(Kosong)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <label className="flex-1 py-1.5 text-center bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer transition">
                        Unggah Foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handlePhotoUpload("fotoLokasiRencanaGarsip", e.target.files?.[0] || null)}
                        />
                      </label>
                      {surveyData.dokumentasi.fotoLokasiRencanaGarsip && (
                        <button
                          onClick={() => handlePhotoUpload("fotoLokasiRencanaGarsip", null)}
                          className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Logo Kustom Opsional */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Logo Kop Atas Kustom (Opsional)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Secara default menggunakan Emblem Vektor Resmi UP3 Kupang. Unggah logo kustom jika diperlukan.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {surveyData.customLogoUrl ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={surveyData.customLogoUrl}
                        alt="Logo"
                        className="w-10 h-10 object-contain rounded-full border border-slate-650 bg-white p-0.5"
                      />
                      <button
                        onClick={() => handlePhotoUpload("customLogoUrl", null)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-bold rounded cursor-pointer"
                      >
                        Reset ke Default
                      </button>
                    </div>
                  ) : (
                    <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold cursor-pointer transition">
                      Pilih Gambar Logo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handlePhotoUpload("customLogoUrl", e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Perubahan otomatis tersimpan ke dalam proyek.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-500 transition shadow-md cursor-pointer"
          >
            Selesai &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
