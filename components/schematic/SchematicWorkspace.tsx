"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import type { SchematicData, SchematicNode, SchematicEdge, SchematicKop } from "../../types/schematic";
import { convertSchematicToRabLayers } from "../../lib/rab/schematicAdapter";
import { calculateRabVolumes } from "../../lib/rab/rabMapper";
import { exportSchematicToPdf, exportSchematicToPng } from "../../lib/exportSchematicPdf";
import SchematicCanvas, { type SchematicCanvasRef } from "./SchematicCanvas";
import KopGambar from "./KopGambar";
import TabelLegenda from "./TabelLegenda";
import RabSummaryPanel, { formatRupiah } from "../sidebar/RabSummaryPanel";
import RabExportModal from "../modals/RabExportModal";
import SurveyDataModal from "./export/SurveyDataModal";
import SurveyExportModal from "./export/SurveyExportModal";
import SchematicErrorBoundary from "./SchematicErrorBoundary";
import MapSyncModal from "./sync/MapSyncModal";
import type { SparkMapSyncPayload } from "../../lib/schematic/mapSyncEngine";
import { getDefaultSurveyData, type SurveyFormData } from "../../types/schematic";

interface Props {
  onSwitchToMap?: () => void;
  projectId?: string;
}

const DEFAULT_KOP: SchematicKop = {
  unit: "UP3 KUPANG - ULP KUPANG",
  namaPekerjaan: "",
  lokasi: "",
  nomorGambar: "",
  skala: "NOT TO SCALE (NTS)",
  ukuranKertas: "A2",
  disurveyOleh: "",
  tglSurvey: new Date().toISOString().slice(0, 10),
  diperiksaOleh: "",
  tglPeriksa: new Date().toISOString().slice(0, 10),
  disetujuiOleh: "",
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
      x: 120,
      y: 220,
      label: "T.01",
      tinggiTiang: 12,
      kekuatanTiang: 350,
      materialTiang: "Beton",
      posisiTiang: "Ujung",
      konstruksi: "A3 Pole",
      schoor: { jenis: "Treck", tipe: "Standar", rotation: 270 },
    },
    {
      id: "node_p2",
      type: "tiang-rencana",
      x: 190,
      y: 220,
      label: "T.02",
      tinggiTiang: 12,
      kekuatanTiang: 200,
      materialTiang: "Beton",
      posisiTiang: "Tumpu",
      konstruksi: "A1",
    },
    {
      id: "node_p3",
      type: "tiang-existing",
      x: 260,
      y: 220,
      label: "TB.00",
      tinggiTiang: 12,
      kekuatanTiang: 200,
      materialTiang: "Baja",
      posisiTiang: "Tumpu",
      konstruksi: "A1",
    },
    {
      id: "node_gc",
      type: "gardu",
      x: 330,
      y: 220,
      label: "G.Cantol",
      garduJenis: "Cantol",
      trafoKva: 50,
      konstruksi: "A2",
      fasa: "3 phs",
    },
    {
      id: "node_p5",
      type: "tiang-tm",
      x: 410,
      y: 220,
      label: "TB.01",
      materialTiang: "Baja",
      tinggiTiang: 12,
      kekuatanTiang: 200,
      posisiTiang: "Tumpu",
      konstruksi: "A1",
    },
    {
      id: "node_gp",
      type: "gardu",
      x: 500,
      y: 220,
      label: "G.Portal",
      garduJenis: "Portal",
      trafoKva: 100,
      konstruksi: "A1",
      fasa: "3 phs",
    },
    {
      id: "node_p7",
      type: "tiang-rencana",
      x: 580,
      y: 220,
      label: "T.07",
      tinggiTiang: 12,
      kekuatanTiang: 200,
      materialTiang: "Beton",
      posisiTiang: "Tumpu",
      konstruksi: "A1",
    },
    {
      id: "node_p8",
      type: "tiang-rencana",
      x: 650,
      y: 220,
      label: "T.08",
      tinggiTiang: 12,
      kekuatanTiang: 200,
      materialTiang: "Beton",
      posisiTiang: "Topang-Sudut",
      konstruksi: "A3",
      schoor: { jenis: "Druck", rotation: 90 },
    },
    {
      id: "node_app",
      type: "box-app",
      x: 740,
      y: 220,
      label: "BOX APP",
      boxKva: 197,
      boxType: "Pengukuran Tidak Langsung",
    },
    {
      id: "node_km",
      type: "kontramast",
      x: 260,
      y: 310,
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
      lengthM: 50,
      jenisJaringan: "SUTM",
      konduktorJenis: "AAAC/S",
      kondukturUkuran: 70,
    },
    {
      id: "edge_2",
      type: "kabel-rencana",
      fromNodeId: "node_p2",
      toNodeId: "node_p3",
      lengthM: 50,
      jenisJaringan: "SUTM",
      konduktorJenis: "AAAC/S",
      kondukturUkuran: 70,
    },
    {
      id: "edge_3",
      type: "kabel-rencana",
      fromNodeId: "node_p3",
      toNodeId: "node_gc",
      lengthM: 50,
      jenisJaringan: "SUTM",
      konduktorJenis: "AAAC/S",
      kondukturUkuran: 70,
    },
    {
      id: "edge_4",
      type: "kabel-rencana",
      fromNodeId: "node_gc",
      toNodeId: "node_p5",
      lengthM: 50,
      jenisJaringan: "SUTM",
      konduktorJenis: "AAAC/S",
      kondukturUkuran: 70,
    },
    {
      id: "edge_5",
      type: "kabel-rencana",
      fromNodeId: "node_p5",
      toNodeId: "node_gp",
      lengthM: 50,
      jenisJaringan: "SUTM",
      konduktorJenis: "AAAC/S",
      kondukturUkuran: 70,
    },
    {
      id: "edge_6",
      type: "kabel-rencana",
      fromNodeId: "node_gp",
      toNodeId: "node_p7",
      lengthM: 50,
      jenisJaringan: "SUTM",
      konduktorJenis: "AAAC/S",
      kondukturUkuran: 70,
    },
    {
      id: "edge_7",
      type: "kabel-rencana",
      fromNodeId: "node_p7",
      toNodeId: "node_p8",
      lengthM: 53,
      jenisJaringan: "SUTM",
      konduktorJenis: "AAAC/S",
      kondukturUkuran: 70,
    },
  ],
  obstacles: [
    {
      id: "obs_road_1",
      type: "obstacle",
      obstacleType: "road",
      x: 0,
      y: 0,
      points: [
        { x: 60, y: 290 },
        { x: 770, y: 290 },
      ],
      roadWidth: 26,
      label: "Jl. Timor Raya",
    },
    {
      id: "obs_alley_1",
      type: "obstacle",
      obstacleType: "alley",
      x: 0,
      y: 0,
      points: [
        { x: 340, y: 140 },
        { x: 340, y: 290 },
      ],
      roadWidth: 11,
      label: "Gang Mawar",
    },
    {
      id: "obs_bld_1",
      type: "obstacle",
      obstacleType: "building",
      x: 460,
      y: 130,
      width: 90,
      height: 55,
      rotationDeg: 0,
      label: "Gedung Pabrik",
      color: "#ea580c",
    },
    {
      id: "obs_bld_2",
      type: "obstacle",
      obstacleType: "building",
      x: 620,
      y: 135,
      width: 80,
      height: 50,
      rotationDeg: 0,
      label: "Kantor",
      color: "#475569",
    },
  ],
};

const STORAGE_KEY = "spark_schematic_v1";

export default function SchematicWorkspace({ onSwitchToMap, projectId }: Props) {
  // Inisialisasi schematic state dengan deep merge & migrasi data legacy
  const [schematic, setSchematic] = useState<SchematicData>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
            const safeKop: SchematicKop = {
              ...DEFAULT_KOP,
              ...(parsed.kop || {}),
            };
            const defaultSurvey = getDefaultSurveyData(safeKop);
            const safeSurvey: SurveyFormData = parsed.surveyData
              ? {
                  ...defaultSurvey,
                  ...parsed.surveyData,
                  kop: { ...defaultSurvey.kop, ...(parsed.surveyData.kop || {}) },
                  jtm: { ...defaultSurvey.jtm, ...(parsed.surveyData.jtm || {}) },
                  gardu: { ...defaultSurvey.gardu, ...(parsed.surveyData.gardu || {}) },
                  jtr: { ...defaultSurvey.jtr, ...(parsed.surveyData.jtr || {}) },
                  pengukuran: {
                    ...defaultSurvey.pengukuran,
                    ...(parsed.surveyData.pengukuran || {}),
                    bebanJalurRows: Array.isArray(parsed.surveyData.pengukuran?.bebanJalurRows)
                      ? parsed.surveyData.pengukuran.bebanJalurRows
                      : defaultSurvey.pengukuran.bebanJalurRows,
                    teganganPangkalRows: Array.isArray(parsed.surveyData.pengukuran?.teganganPangkalRows)
                      ? parsed.surveyData.pengukuran.teganganPangkalRows
                      : defaultSurvey.pengukuran.teganganPangkalRows,
                  },
                  dokumentasi: { ...defaultSurvey.dokumentasi, ...(parsed.surveyData.dokumentasi || {}) },
                }
              : defaultSurvey;

            return {
              kop: safeKop,
              nodes: parsed.nodes,
              edges: parsed.edges,
              obstacles: Array.isArray(parsed.obstacles) ? parsed.obstacles : [],
              surveyData: safeSurvey,
            };
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
      obstacles: [],
      surveyData: getDefaultSurveyData(DEFAULT_KOP),
    };
  });

  const [isRabOpen, setIsRabOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [isSurveyDataModalOpen, setIsSurveyDataModalOpen] = useState(false);
  const [isSurveyExportModalOpen, setIsSurveyExportModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [mapSyncData, setMapSyncData] = useState<SparkMapSyncPayload | null>(null);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const canvasRef = useRef<SchematicCanvasRef>(null);

  const [surveyData, setSurveyData] = useState<SurveyFormData>(() => {
    return schematic.surveyData || getDefaultSurveyData(schematic.kop);
  });

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

  // Handle update survey data
  const handleUpdateSurveyData = (updated: SurveyFormData) => {
    setSurveyData(updated);
    setSchematic(prev => ({
      ...prev,
      surveyData: updated,
      kop: {
        ...prev.kop,
        namaPekerjaan: updated.kop.namaPekerjaan !== undefined ? updated.kop.namaPekerjaan : prev.kop.namaPekerjaan,
        nomorGambar: updated.kop.nomorGambar !== undefined ? updated.kop.nomorGambar : prev.kop.nomorGambar,
      },
    }));
  };

  // Handle update kop
  const handleUpdateKop = (updated: Partial<SchematicKop>) => {
    setSchematic(prev => {
      const nextKop = {
        ...prev.kop,
        ...updated,
      };
      const nextSurveyData: SurveyFormData = prev.surveyData
        ? {
            ...prev.surveyData,
            kop: {
              ...prev.surveyData.kop,
              namaPekerjaan: updated.namaPekerjaan !== undefined ? updated.namaPekerjaan : prev.surveyData.kop.namaPekerjaan,
              nomorGambar: updated.nomorGambar !== undefined ? updated.nomorGambar : prev.surveyData.kop.nomorGambar,
            },
          }
        : getDefaultSurveyData(nextKop);
      setSurveyData(nextSurveyData);
      return {
        ...prev,
        kop: nextKop,
        surveyData: nextSurveyData,
      };
    });
  };

  // Muat template preset
  const handleLoadPresetElevate = () => {
    if (schematic.nodes.length > 0 && !confirm("Muat preset contoh PB ELEVATE 197 kVA? Gambar kanvas saat ini akan ditimpa.")) {
      return;
    }
    const defaultSurvey = getDefaultSurveyData(PRESET_ELEVATE_197KVA.kop);
    defaultSurvey.kop.namaPekerjaan = PRESET_ELEVATE_197KVA.kop.namaPekerjaan;
    defaultSurvey.kop.nomorGambar = PRESET_ELEVATE_197KVA.kop.nomorGambar;
    const presetWithSurvey: SchematicData = {
      ...PRESET_ELEVATE_197KVA,
      surveyData: defaultSurvey,
    };
    setSchematic(presetWithSurvey);
    setSurveyData(defaultSurvey);
  };

  // Reset kanvas
  const handleResetCanvas = () => {
    if (confirm("Kosongkan kanvas skematik? Tindakan ini tidak dapat dibatalkan.")) {
      const resetKop = { ...DEFAULT_KOP };
      const resetSurvey = getDefaultSurveyData(resetKop);
      setSchematic({
        kop: resetKop,
        nodes: [],
        edges: [],
        obstacles: [],
        surveyData: resetSurvey,
      });
      setSurveyData(resetSurvey);
    }
  };

  // Handler Buka Modal Sinkron dari Peta
  const handleOpenSyncModal = async () => {
    let payload: SparkMapSyncPayload | null = null;

    try {
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem("spark_map_sync_state");
        if (raw) {
          payload = JSON.parse(raw);
        }
      }
    } catch (e) {
      console.warn("Gagal membaca spark_map_sync_state:", e);
    }

    // Jika projectId ada dan local state belum punya layer, coba ambil dari API project
    if ((!payload || (!payload.savedLayers?.length && !payload.draftLayer?.poles?.length)) && projectId) {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const proj = await res.json();
          if (proj.data?.savedLayers) {
            payload = {
              projectId,
              projectName: proj.name || "Project Peta",
              savedLayers: proj.data.savedLayers || [],
              junctions: proj.data.junctions || [],
              connections: proj.data.connections || [],
              draftLayer: null,
              updatedAt: Date.now(),
            };
          }
        }
      } catch (e) {
        console.warn("Gagal memuat project dari API:", e);
      }
    }

    const hasSaved = Boolean(payload?.savedLayers && payload.savedLayers.length > 0);
    const hasDraft = Boolean(payload?.draftLayer && payload.draftLayer.poles && payload.draftLayer.poles.length > 0);

    if (!payload || (!hasSaved && !hasDraft)) {
      alert("Tidak ditemukan data aset pada peta untuk disinkronkan. Silakan gambar tiang atau kabel di Mode Peta terlebih dahulu.");
      return;
    }

    setMapSyncData(payload);
    setIsSyncModalOpen(true);
  };

  // Handler Terapkan Sinkronisasi (dengan 1 langkah Undo/Redo)
  const handleApplySync = (newSchematic: SchematicData, summaryMsg: string) => {
    if (canvasRef.current) {
      canvasRef.current.pushHistoryState(schematic);
    }
    setSchematic(newSchematic);
    setSyncToast(summaryMsg);
    setTimeout(() => {
      setSyncToast(null);
    }, 4500);
  };

  // Export PDF legacy fallback
  const handleExportPdf = async () => {
    setIsSurveyExportModalOpen(true);
  };

  // Export PNG legacy fallback
  const handleExportPng = async () => {
    setIsSurveyExportModalOpen(true);
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

          {/* Tombol Sinkron dari Peta */}
          <button
            onClick={handleOpenSyncModal}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Ambil dan sinkronkan hasil gambar aset dari Peta ke Skematik"
          >
            <span>🔄</span>
            <span>Sinkron dari Peta</span>
          </button>

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

          {/* Panel Isian Data Gambar Survei */}
          <button
            onClick={() => setIsSurveyDataModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/40 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Buka Panel Isian Data Gambar Survei (Kop, JTM, Gardu, JTR, Pengukuran, Dokumentasi)"
          >
            <span>📋</span>
            <span className="hidden sm:inline">Data Gambar Survei</span>
          </button>

          {/* Export Form Gambar Survei A2 Button */}
          <button
            onClick={() => setIsSurveyExportModalOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Export Form Resmi Gambar Survei UP3 Kupang (A2 PDF/PNG)"
          >
            <span>📄</span>
            <span>Export Gambar Survei (A2)</span>
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
              <SchematicErrorBoundary
                fallbackTitle="Terjadi Kendala pada Kanvas Skematik"
                onReset={handleResetCanvas}
              >
                <SchematicCanvas
                  ref={canvasRef}
                  schematic={schematic}
                  onChange={setSchematic}
                  isPrinting={isExportingPdf || isExportingPng}
                />
              </SchematicErrorBoundary>
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

      {/* ─── Modal Isian Data Gambar Survei UP3 Kupang ─── */}
      <SurveyDataModal
        open={isSurveyDataModalOpen}
        onClose={() => setIsSurveyDataModalOpen(false)}
        surveyData={surveyData}
        onChange={handleUpdateSurveyData}
      />

      {/* ─── Modal Export Lembar Gambar Survei A2 ─── */}
      {isSurveyExportModalOpen && (
        <SurveyExportModal
          open={isSurveyExportModalOpen}
          onClose={() => setIsSurveyExportModalOpen(false)}
          schematic={schematic}
          surveyData={surveyData}
          onChangeSurveyData={handleUpdateSurveyData}
          onOpenDataModal={() => {
            setIsSurveyExportModalOpen(false);
            setIsSurveyDataModalOpen(true);
          }}
        />
      )}

      {/* ─── Modal Sinkron dari Peta ─── */}
      {isSyncModalOpen && mapSyncData && (
        <MapSyncModal
          open={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          mapData={mapSyncData}
          currentSchematic={schematic}
          onApply={handleApplySync}
        />
      )}

      {/* ─── Toast Notifikasi Sinkronisasi ─── */}
      {syncToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2.5 rounded-xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2 border border-blue-400">
          <span>🔄</span>
          <span>{syncToast}</span>
        </div>
      )}
    </div>
  );
}
