"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import type { SchematicData, SchematicNode, SchematicEdge, SchematicKop } from "../../types/schematic";
import { convertSchematicToRabLayers } from "../../lib/rab/schematicAdapter";
import { calculateRabVolumes } from "../../lib/rab/rabMapper";
import { exportSchematicToPdf, exportSchematicToPng } from "../../lib/exportSchematicPdf";
import SchematicCanvas from "./SchematicCanvas";
import KopGambar from "./KopGambar";
import TabelLegenda from "./TabelLegenda";
import RabSummaryPanel, { formatRupiah } from "../sidebar/RabSummaryPanel";
import RabExportModal from "../modals/RabExportModal";

interface Props {
  onSwitchToMap?: () => void;
}

const DEFAULT_KOP: SchematicKop = {
  unit: "UP3 KUPANG - ULP KUPANG",
  namaPekerjaan: "PEMBANGUNAN JTM & GARDU DISTRIBUSI",
  lokasi: "KUPANG, NTT",
  nomorGambar: "01/SKM/SPARK/2026",
  skala: "NOT TO SCALE (NTS)",
  ukuranKertas: "A4",
  disurveyOleh: "SURVEYOR SPARK",
  tglSurvey: new Date().toISOString().slice(0, 10),
  diperiksaOleh: "TL TEKNIK ULP",
  tglPeriksa: new Date().toISOString().slice(0, 10),
  disetujuiOleh: "ASMAN TEKNIK UP3",
  tglSetuju: new Date().toISOString().slice(0, 10),
};

// Preset contoh ELEVATE 197 kVA seperti dokumen PLN standar
const PRESET_ELEVATE_197KVA: SchematicData = {
  kop: {
    unit: "UP3 KUPANG - ULP KUPANG",
    namaPekerjaan: "PB ELEVATE 197 kVA (PEMASANGAN GARDU & BOX APP)",
    lokasi: "KOTA KUPANG, NTT",
    nomorGambar: "02/PB-197/SPARK/2026",
    skala: "NOT TO SCALE (NTS)",
    ukuranKertas: "A4",
    disurveyOleh: "SURVEYOR SPARK",
    tglSurvey: new Date().toISOString().slice(0, 10),
    diperiksaOleh: "TL TEKNIK ULP",
    tglPeriksa: new Date().toISOString().slice(0, 10),
    disetujuiOleh: "ASMAN TEKNIK UP3",
    tglSetuju: new Date().toISOString().slice(0, 10),
  },
  nodes: [
    {
      id: "node_p1",
      type: "tiang-existing",
      x: 160,
      y: 220,
      label: "T.01 (Exist)",
      tinggiTiang: 12,
      kekuatanTiang: 350,
      materialTiang: "Beton",
      posisiTiang: "Ujung",
      konstruksi: "C1",
    },
    {
      id: "node_p2",
      type: "tiang-rencana",
      x: 380,
      y: 220,
      label: "T.02 (Rencana)",
      tinggiTiang: 12,
      kekuatanTiang: 200,
      materialTiang: "Beton",
      posisiTiang: "Tumpu",
      konstruksi: "C1",
    },
    {
      id: "node_gardu",
      type: "gardu",
      x: 620,
      y: 220,
      label: "GARDU PORTAL 200 kVA",
      garduJenis: "Portal",
      trafoKva: 200,
      fasa: "3 phs",
    },
    {
      id: "node_app",
      type: "box-app",
      x: 820,
      y: 220,
      label: "BOX APP 197 kVA",
      boxKva: 197,
      boxType: "Pengukuran Tidak Langsung",
    },
    {
      id: "node_km",
      type: "kontramast",
      x: 380,
      y: 340,
      label: "KM-01",
      kontramastTipe: "Standar",
    },
  ],
  edges: [
    {
      id: "edge_1",
      type: "kabel-rencana",
      fromNodeId: "node_p1",
      toNodeId: "node_p2",
      lengthM: 85,
      jenisJaringan: "SUTM",
      konduktorJenis: "AAAC/S",
      kondukturUkuran: 70,
    },
    {
      id: "edge_2",
      type: "kabel-rencana",
      fromNodeId: "node_p2",
      toNodeId: "node_gardu",
      lengthM: 70,
      jenisJaringan: "SUTM",
      konduktorJenis: "AAAC/S",
      kondukturUkuran: 70,
    },
  ],
};

const STORAGE_KEY = "spark_schematic_v1";

export default function SchematicWorkspace({ onSwitchToMap }: Props) {
  // Inisialisasi schematic state
  const [schematic, setSchematic] = useState<SchematicData>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.nodes && parsed.edges && parsed.kop) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn("Gagal membaca schematic dari localStorage:", e);
      }
    }
    return {
      kop: { ...DEFAULT_KOP },
      nodes: [],
      edges: [],
    };
  });

  const [isRabOpen, setIsRabOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Simpan ke localStorage saat berubah
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schematic));
    } catch (e) {
      console.warn("Gagal menyimpan ke localStorage:", e);
    }
  }, [schematic]);

  // Perhitungan RAB otomatis via mapper yang sudah ada
  const rabLayers = useMemo(() => {
    return convertSchematicToRabLayers(schematic);
  }, [schematic]);

  const rabSummary = useMemo(() => {
    return calculateRabVolumes(rabLayers);
  }, [rabLayers]);

  // Handle update kop
  const handleUpdateKop = (updated: Partial<SchematicKop>) => {
    setSchematic(prev => ({
      ...prev,
      kop: {
        ...prev.kop,
        ...updated,
      },
    }));
  };

  // Muat template preset
  const handleLoadPresetElevate = () => {
    if (schematic.nodes.length > 0 && !confirm("Muat preset contoh PB ELEVATE 197 kVA? Gambar kanvas saat ini akan ditimpa.")) {
      return;
    }
    setSchematic(PRESET_ELEVATE_197KVA);
  };

  // Reset kanvas
  const handleResetCanvas = () => {
    if (confirm("Kosongkan kanvas skematik? Tindakan ini tidak dapat dibatalkan.")) {
      setSchematic({
        kop: { ...DEFAULT_KOP },
        nodes: [],
        edges: [],
      });
    }
  };

  // Export PDF A4
  const handleExportPdf = async () => {
    if (!printAreaRef.current) return;
    setIsExportingPdf(true);
    try {
      await exportSchematicToPdf(printAreaRef.current, schematic.kop.namaPekerjaan || "Gambar_Kerja_PLN");
    } catch (err) {
      console.error("Gagal export PDF:", err);
      alert("Gagal melakukan export PDF. Pastikan browser mendukung canvas export.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export PNG
  const handleExportPng = async () => {
    if (!printAreaRef.current) return;
    setIsExportingPng(true);
    try {
      await exportSchematicToPng(printAreaRef.current, schematic.kop.namaPekerjaan || "Gambar_Kerja_PLN");
    } catch (err) {
      console.error("Gagal export PNG:", err);
      alert("Gagal melakukan export PNG.");
    } finally {
      setIsExportingPng(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden select-none">
      {/* ─── Topbar Navigation ─── */}
      <header className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 z-20 flex-shrink-0 shadow-md">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-slate-950 text-base shadow-sm">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-white">SPARK</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase tracking-wide">
                  Mode Skematik
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Standard Single Line Diagram & Kop PLN</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-800">
            <input
              type="text"
              value={schematic.kop.namaPekerjaan}
              onChange={(e) => handleUpdateKop({ namaPekerjaan: e.target.value })}
              className="bg-slate-900 hover:bg-slate-850 border border-slate-700/80 rounded-lg px-3 py-1 text-xs text-slate-200 font-semibold focus:border-amber-400 outline-none w-72 transition"
              title="Nama Pekerjaan (tersimpan di Kop)"
              placeholder="Nama Pekerjaan / Proyek..."
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Preset Buttons */}
          <div className="hidden sm:flex items-center gap-1.5 mr-2 pr-2 border-r border-slate-800">
            <button
              onClick={handleLoadPresetElevate}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-amber-300 hover:bg-slate-800/80 border border-slate-700/60 transition flex items-center gap-1.5 cursor-pointer"
              title="Muat contoh skematik PB ELEVATE 197 kVA"
            >
              <span>📋</span>
              <span className="hidden md:inline">Preset 197 kVA</span>
            </button>
            <button
              onClick={handleResetCanvas}
              className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition cursor-pointer"
              title="Bersihkan Kanvas"
            >
              🗑️
            </button>
          </div>

          {/* Toggle RAB Panel */}
          <button
            onClick={() => setIsRabOpen(!isRabOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs ${
              isRabOpen
                ? "bg-amber-400 text-slate-950 shadow-amber-400/20"
                : "bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700"
            }`}
          >
            <span>📊</span>
            <span>RAB Real-Time</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
              isRabOpen ? "bg-slate-950 text-amber-400" : "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
            }`}>
              {formatRupiah(rabSummary.grandTotal)}
            </span>
          </button>

          {/* Export RAB Excel Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Auto-fill ke template Excel KHS 2026"
          >
            <span>📥</span>
            <span className="hidden sm:inline">Export RAB Excel</span>
          </button>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            title="Export Lembar Kerja A4 PDF dengan Kop dan Legenda"
          >
            <span>📄</span>
            <span>{isExportingPdf ? "Mencetak..." : "Export PDF (A4)"}</span>
          </button>

          {/* Export PNG */}
          <button
            onClick={handleExportPng}
            disabled={isExportingPng}
            className="hidden xl:flex px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Export Gambar PNG Resolusi Tinggi"
          >
            <span>🖼️</span>
            <span>PNG</span>
          </button>

          {/* Switch back to GIS Map Mode */}
          {onSwitchToMap && (
            <button
              onClick={onSwitchToMap}
              className="ml-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Kembali ke Mode Peta GIS"
            >
              <span>🗺️</span>
              <span className="hidden md:inline">Mode Peta</span>
            </button>
          )}
        </div>
      </header>

      {/* ─── Main Workspace Body ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Canvas & Drawing Sheet Scroll Area */}
        <div className="flex-1 flex flex-col bg-slate-900 overflow-auto p-4 items-center justify-start">
          {/* Printable Container: A4 Landscape Proportion */}
          <div
            id="schematic-printable-area"
            ref={printAreaRef}
            className="w-full max-w-[1240px] bg-white text-slate-900 border-2 border-slate-800 rounded shadow-2xl flex flex-col my-auto transition-all"
            style={{
              minHeight: "780px",
            }}
          >
            {/* Top Area: Interactive 2D Canvas */}
            <div className="flex-1 min-h-[500px] relative border-b-2 border-slate-800 bg-slate-50/20">
              <SchematicCanvas
                schematic={schematic}
                onChange={setSchematic}
                isPrinting={isExportingPdf || isExportingPng}
              />
            </div>

            {/* Bottom Area: Tabel Legenda & Kop Gambar PLN */}
            <div className="grid grid-cols-12 divide-x-2 divide-slate-800 bg-white">
              {/* Kolom Kiri: Tabel Legenda Auto-Fill */}
              <div className="col-span-6 p-2 flex flex-col justify-start">
                <TabelLegenda schematic={schematic} />
              </div>

              {/* Kolom Kanan: Kop Gambar PLN Resmi */}
              <div className="col-span-6 flex flex-col justify-end">
                <KopGambar
                  kop={schematic.kop}
                  onChange={handleUpdateKop}
                  isPrinting={isExportingPdf || isExportingPng}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Collapsible Real-Time RAB Summary Panel */}
        {isRabOpen && (
          <aside className="w-96 lg:w-[420px] bg-slate-950 border-l border-slate-800 flex flex-col h-full shadow-2xl z-30 transition-all">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2">
                <span className="text-base">📊</span>
                <span className="font-extrabold text-sm text-white">RAB Skematik Real-Time</span>
              </div>
              <button
                onClick={() => setIsRabOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 text-xs cursor-pointer"
                title="Tutup Panel"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <RabSummaryPanel
                rabSummary={rabSummary}
                onOpenExportModal={() => setIsExportModalOpen(true)}
              />
            </div>
          </aside>
        )}
      </div>

      {/* ─── Modal Export RAB Excel ─── */}
      <RabExportModal
        open={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        rabSummary={rabSummary}
        projectName={schematic.kop.namaPekerjaan || "Skematik_PLN"}
      />
    </div>
  );
}
