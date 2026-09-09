"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { SchematicData, SchematicNode, SchematicEdge, SchematicNodeType, SchematicEdgeType } from "../../types/schematic";
import { ASSET_COLORS, getCableStyle, getPoleStyle } from "../../lib/assetStyles";

interface Props {
  schematic: SchematicData;
  onChange: (updated: SchematicData) => void;
  isPrinting?: boolean;
}

type ActiveTool =
  | "select"
  | "tiang-tm"
  | "tiang-tr"
  | "tiang-existing"
  | "gardu"
  | "box-app"
  | "kontramast"
  | "kabel-tm"
  | "kabel-tr"
  | "kabel-existing"
  // Legacy aliases
  | "tiang-rencana"
  | "kabel-rencana";

export default function SchematicCanvas({ schematic, onChange, isPrinting = false }: Props) {
  const { nodes, edges, kop } = schematic;

  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [cableStartNodeId, setCableStartNodeId] = useState<string | null>(null);

  // Dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStartSnapshot, setDragStartSnapshot] = useState<{ id: string; x: number; y: number } | null>(null);

  // Undo / Redo History Stack (in-memory, maks 50 langkah)
  const [past, setPast] = useState<SchematicData[]>([]);
  const [future, setFuture] = useState<SchematicData[]>([]);

  // Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Snap to grid
  const [snapGrid, setSnapGrid] = useState(true);
  const GRID_SIZE = 20;

  const svgRef = useRef<SVGSVGElement>(null);

  // Helper snap
  const snap = useCallback((val: number) => {
    return snapGrid ? Math.round(val / GRID_SIZE) * GRID_SIZE : val;
  }, [snapGrid]);

  // Convert client coordinate to SVG viewBox coordinate
  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    return { x, y };
  }, [zoom, pan]);

  // Helper push ke history sebelum commit perubahan
  const pushState = useCallback((newSchematic: SchematicData) => {
    setPast(prev => [...prev.slice(-49), schematic]);
    setFuture([]);
    onChange(newSchematic);
  }, [schematic, onChange]);

  // Handler Undo
  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setFuture(f => [schematic, ...f.slice(0, 49)]);
    setPast(newPast);
    onChange(previous);
  }, [past, schematic, onChange]);

  // Handler Redo
  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast(p => [...p.slice(-49), schematic]);
    setFuture(newFuture);
    onChange(next);
  }, [future, schematic, onChange]);

  // Global Keyboard Shortcuts (Undo/Redo & Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) {
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId) {
          pushState({
            ...schematic,
            nodes: nodes.filter(n => n.id !== selectedNodeId),
            edges: edges.filter(e => e.fromNodeId !== selectedNodeId && e.toNodeId !== selectedNodeId),
          });
          setSelectedNodeId(null);
        } else if (selectedEdgeId) {
          pushState({
            ...schematic,
            edges: edges.filter(e => e.id !== selectedEdgeId),
          });
          setSelectedEdgeId(null);
        }
      }

      // Escape cancel selection
      if (e.key === "Escape") {
        setActiveTool("select");
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setCableStartNodeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, selectedNodeId, selectedEdgeId, nodes, edges, schematic, pushState]);

  // Handler klik pada kanvas (tambah node atau clear selection)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isPanning) return;

    if (activeTool === "select") {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setCableStartNodeId(null);
      return;
    }

    // Jika tool adalah kabel, klik pada kanvas kosong membatalkan penarikan kabel
    if (
      activeTool === "kabel-tm" ||
      activeTool === "kabel-tr" ||
      activeTool === "kabel-rencana" ||
      activeTool === "kabel-existing"
    ) {
      setCableStartNodeId(null);
      return;
    }

    // Tambah node baru
    const { x, y } = getCanvasCoords(e);
    const snappedX = snap(x);
    const snappedY = snap(y);

    const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let newNode: SchematicNode;

    if (activeTool === "tiang-tm" || activeTool === "tiang-rencana") {
      const idx = nodes.filter(n => n.type === "tiang-tm" || n.type === "tiang-rencana").length + 1;
      newNode = {
        id: newNodeId,
        type: "tiang-tm",
        kategori: "TM",
        x: snappedX,
        y: snappedY,
        label: `T.${idx}`,
        materialTiang: "Beton",
        tinggiTiang: 12,
        kekuatanTiang: 200,
        posisiTiang: "Tumpu",
        konstruksi: "C1",
      };
    } else if (activeTool === "tiang-tr") {
      const idx = nodes.filter(n => n.type === "tiang-tr").length + 1;
      newNode = {
        id: newNodeId,
        type: "tiang-tr",
        kategori: "TR",
        x: snappedX,
        y: snappedY,
        label: `TR.${idx}`,
        materialTiang: "Beton",
        tinggiTiang: 9,
        kekuatanTiang: 200,
        posisiTiang: "Tumpu",
        konstruksi: "S1",
      };
    } else if (activeTool === "tiang-existing") {
      const idx = nodes.filter(n => n.type === "tiang-existing").length + 1;
      newNode = {
        id: newNodeId,
        type: "tiang-existing",
        x: snappedX,
        y: snappedY,
        label: `E.${idx}`,
        materialTiang: "Beton",
        tinggiTiang: 12,
        kekuatanTiang: 200,
        posisiTiang: "Tumpu",
      };
    } else if (activeTool === "gardu") {
      newNode = {
        id: newNodeId,
        type: "gardu",
        x: snappedX,
        y: snappedY,
        label: "Gardu 100kVA",
        garduJenis: "Portal",
        trafoKva: 100,
        fasa: "3 phs",
      };
    } else if (activeTool === "box-app") {
      newNode = {
        id: newNodeId,
        type: "box-app",
        x: snappedX,
        y: snappedY,
        label: "APP 197kVA",
        boxKva: 197,
      };
    } else if (activeTool === "kontramast") {
      newNode = {
        id: newNodeId,
        type: "kontramast",
        x: snappedX,
        y: snappedY,
        label: "KM-01",
        kontramastTipe: "Standar",
      };
    } else {
      return;
    }

    pushState({
      ...schematic,
      nodes: [...nodes, newNode],
    });
    setSelectedNodeId(newNodeId);
  };

  // Handler klik pada node (select node atau sambung kabel)
  const handleNodeClick = (node: SchematicNode, e: React.MouseEvent) => {
    e.stopPropagation();

    const isCableTool =
      activeTool === "kabel-tm" ||
      activeTool === "kabel-tr" ||
      activeTool === "kabel-rencana" ||
      activeTool === "kabel-existing";

    if (isCableTool) {
      if (!cableStartNodeId) {
        // Klik node awal
        setCableStartNodeId(node.id);
      } else {
        // Klik node tujuan
        if (cableStartNodeId === node.id) {
          setCableStartNodeId(null);
          return;
        }

        // Hitung jarak perkiraan piksel untuk rekomendasi
        const startNode = nodes.find(n => n.id === cableStartNodeId);
        const distPx = startNode ? Math.hypot(node.x - startNode.x, node.y - startNode.y) : 100;
        const recommendedM = Math.max(10, Math.round(distPx * 0.5));

        const isTR = activeTool === "kabel-tr";
        const isExist = activeTool === "kabel-existing";

        const newEdgeId = `edge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newEdge: SchematicEdge = {
          id: newEdgeId,
          type: isExist ? "kabel-existing" : (isTR ? "kabel-tr" : "kabel-tm"),
          fromNodeId: cableStartNodeId,
          toNodeId: node.id,
          lengthM: recommendedM,
          jenisJaringan: isTR ? "SKUTR" : "SUTM",
          konduktorJenis: "AAAC/S",
          kondukturUkuran: 70,
        };

        pushState({
          ...schematic,
          edges: [...edges, newEdge],
        });
        setCableStartNodeId(null);
        setSelectedEdgeId(newEdge.id);
      }
      return;
    }

    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  };

  // Drag node start
  const handleNodeMouseDown = (node: SchematicNode, e: React.MouseEvent) => {
    if (activeTool !== "select") return;
    e.stopPropagation();
    setDraggingNodeId(node.id);
    setDragStartSnapshot({ id: node.id, x: node.x, y: node.y });
    const coords = getCanvasCoords(e);
    setDragOffset({ x: coords.x - node.x, y: coords.y - node.y });
  };

  // Mouse move on canvas (drag node atau panning)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const coords = getCanvasCoords(e);
      const newX = snap(coords.x - dragOffset.x);
      const newY = snap(coords.y - dragOffset.y);

      onChange({
        ...schematic,
        nodes: nodes.map(n => n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n),
      });
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  // Drag end: commit history jika node berpindah
  const handleMouseUp = () => {
    if (draggingNodeId && dragStartSnapshot) {
      const currentNode = nodes.find(n => n.id === draggingNodeId);
      if (currentNode && (currentNode.x !== dragStartSnapshot.x || currentNode.y !== dragStartSnapshot.y)) {
        // Simpan snapshot lama ke history past
        const previousSchematic: SchematicData = {
          ...schematic,
          nodes: nodes.map(n => n.id === dragStartSnapshot.id ? { ...n, x: dragStartSnapshot.x, y: dragStartSnapshot.y } : n),
        };
        setPast(prev => [...prev.slice(-49), previousSchematic]);
        setFuture([]);
      }
    }
    setDraggingNodeId(null);
    setDragStartSnapshot(null);
    setIsPanning(false);
  };

  // Hapus elemen terpilih
  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeId) {
      pushState({
        ...schematic,
        nodes: nodes.filter(n => n.id !== selectedNodeId),
        edges: edges.filter(e => e.fromNodeId !== selectedNodeId && e.toNodeId !== selectedNodeId),
      });
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      pushState({
        ...schematic,
        edges: edges.filter(e => e.id !== selectedEdgeId),
      });
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId, nodes, edges, schematic, pushState]);

  // Update atribut node terpilih
  const updateSelectedNode = (attrs: Partial<SchematicNode>) => {
    if (!selectedNodeId) return;
    pushState({
      ...schematic,
      nodes: nodes.map(n => n.id === selectedNodeId ? { ...n, ...attrs } : n),
    });
  };

  // Update atribut edge terpilih
  const updateSelectedEdge = (attrs: Partial<SchematicEdge>) => {
    if (!selectedEdgeId) return;
    pushState({
      ...schematic,
      edges: edges.map(e => e.id === selectedEdgeId ? { ...e, ...attrs } : e),
    });
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedEdge = edges.find(e => e.id === selectedEdgeId);

  return (
    <div className="flex flex-col h-full w-full bg-white select-none">
      {/* ─── Toolbar Atas Kanvas ─── */}
      {!isPrinting && (
        <div className="bg-slate-900 border-b border-slate-800 p-2 flex items-center justify-between gap-2 z-10 flex-wrap">
          {/* Tool Palette */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Tool Pointer */}
            <button
              onClick={() => { setActiveTool("select"); setCableStartNodeId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "select"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Pilih & Pindah Simbol (Klik & Geser)"
            >
              <span>👆</span>
              <span>Pilih</span>
            </button>

            <div className="h-5 w-px bg-slate-700 mx-1" />

            {/* Simbol Tiang TM (Titik Hitam Core Kuning) */}
            <button
              onClick={() => setActiveTool("tiang-tm")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "tiang-tm"
                  ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Tiang TM 20kV (Titik Hitam dengan Core Kuning)"
            >
              <div
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: ASSET_COLORS.TIANG_TM.core, border: `2px solid ${ASSET_COLORS.TIANG_TM.color}` }}
              />
              <span>Tiang TM</span>
            </button>

            {/* Simbol Tiang TR (Titik Putih Border Biru) */}
            <button
              onClick={() => setActiveTool("tiang-tr")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "tiang-tr"
                  ? "bg-sky-700 text-white shadow-sm ring-2 ring-sky-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Tiang TR 380V (Titik Putih dengan Border Biru)"
            >
              <div
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: ASSET_COLORS.TIANG_TR.core, border: `2px solid ${ASSET_COLORS.TIANG_TR.color}` }}
              />
              <span>Tiang TR</span>
            </button>

            {/* Simbol Tiang Exist (Titik Solid Gelap) */}
            <button
              onClick={() => setActiveTool("tiang-existing")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "tiang-existing"
                  ? "bg-slate-700 text-white border border-slate-500 shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Tiang Existing (Titik Solid Gelap)"
            >
              <div
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: ASSET_COLORS.TIANG_EXISTING.color }}
              />
              <span>Tiang Exist</span>
            </button>

            {/* Simbol Gardu (Kotak/Segitiga Ungu) */}
            <button
              onClick={() => setActiveTool("gardu")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "gardu"
                  ? "bg-purple-700 text-white shadow-sm ring-2 ring-purple-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Gardu Trafo Distribusi Portal/Cantol (Kotak/Segitiga Ungu)"
            >
              <div
                className="w-4 h-4 rounded-xs flex items-center justify-center"
                style={{ backgroundColor: ASSET_COLORS.GARDU.bg, border: `1.5px solid ${ASSET_COLORS.GARDU.border}` }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24">
                  <polygon points="12,2 2,22 22,22" fill={ASSET_COLORS.GARDU.fill} stroke={ASSET_COLORS.GARDU.primary} strokeWidth="3" />
                </svg>
              </div>
              <span>Gardu</span>
            </button>

            {/* Simbol Box APP */}
            <button
              onClick={() => setActiveTool("box-app")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "box-app"
                  ? "bg-orange-700 text-white shadow-sm ring-2 ring-orange-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Box APP kWh Meter"
            >
              <div
                className="w-3.5 h-3.5 rounded-xs flex items-center justify-center text-[7px] font-black"
                style={{ backgroundColor: ASSET_COLORS.BOX_APP.bg, border: `1.5px solid ${ASSET_COLORS.BOX_APP.border}`, color: ASSET_COLORS.BOX_APP.text }}
              >
                A
              </div>
              <span>Box APP</span>
            </button>

            {/* Simbol Kontramast */}
            <button
              onClick={() => setActiveTool("kontramast")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "kontramast"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Kontramast / Schoor"
            >
              <span style={{ color: ASSET_COLORS.KONTRAMAST.primary, fontWeight: 900 }}>⇗</span>
              <span>Schoor</span>
            </button>

            <div className="h-5 w-px bg-slate-700 mx-1" />

            {/* Kabel TM (Garis Merah) */}
            <button
              onClick={() => { setActiveTool("kabel-tm"); setCableStartNodeId(null); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "kabel-tm"
                  ? "bg-red-700 text-white shadow-sm ring-2 ring-red-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Kabel TM (SUTM/SKUTM 20kV - Garis Merah)"
            >
              <div className="w-4 h-1 rounded-full" style={{ backgroundColor: ASSET_COLORS.KABEL_TM.stroke }} />
              <span>Kabel TM</span>
            </button>

            {/* Kabel TR (Garis Hijau) */}
            <button
              onClick={() => { setActiveTool("kabel-tr"); setCableStartNodeId(null); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "kabel-tr"
                  ? "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Kabel TR (SKUTR/SUTR 380V - Garis Hijau)"
            >
              <div className="w-4 h-1 rounded-full" style={{ backgroundColor: ASSET_COLORS.KABEL_TR.stroke }} />
              <span>Kabel TR</span>
            </button>

            {/* Kabel Exist */}
            <button
              onClick={() => { setActiveTool("kabel-existing"); setCableStartNodeId(null); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "kabel-existing"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Kabel Existing (Garis Abu-abu)"
            >
              <div className="w-4 h-0.5 bg-slate-400 rounded-full" />
              <span>Kabel Exist</span>
            </button>
          </div>

          {/* Undo, Redo, Zoom & Action Controls */}
          <div className="flex items-center gap-2">
            {/* Undo Button */}
            <button
              onClick={handleUndo}
              disabled={past.length === 0}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 transition cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <span>↩️</span>
              <span className="hidden sm:inline">Undo</span>
            </button>

            {/* Redo Button */}
            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 transition cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <span>↪️</span>
              <span className="hidden sm:inline">Redo</span>
            </button>

            <div className="h-5 w-px bg-slate-700 mx-0.5" />

            {/* Grid Snap Toggle */}
            <button
              onClick={() => setSnapGrid(v => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                snapGrid
                  ? "bg-slate-800 text-emerald-400 border-emerald-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
              title="Toggle Snap Grid 20px"
            >
              Grid {snapGrid ? "ON" : "OFF"}
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
                className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white font-bold text-sm cursor-pointer"
                title="Zoom Out"
              >
                -
              </button>
              <span className="text-[11px] font-mono font-bold px-1 text-slate-200">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(2.5, Number((z + 0.1).toFixed(1))))}
                className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white font-bold text-sm cursor-pointer"
                title="Zoom In"
              >
                +
              </button>
            </div>

            {/* Reset View */}
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="p-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded border border-slate-700 cursor-pointer"
              title="Reset Zoom & Pan"
            >
              🎯
            </button>
          </div>
        </div>
      )}

      {/* ─── Canvas Workspace Area ─── */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-100">
        <div
          className="flex-1 w-full h-full relative overflow-hidden cursor-crosshair"
          onMouseDown={(e) => {
            if (e.button === 1 || e.altKey) {
              setIsPanning(true);
              setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            }
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleCanvasClick}
        >
          {/* Petunjuk aktif */}
          {!isPrinting && (
            <div className="absolute top-2 left-2 z-10 pointer-events-none bg-slate-900/80 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded shadow border border-slate-700/60 font-medium">
              {cableStartNodeId ? (
                <span className="text-amber-300 font-bold animate-pulse">
                  ⚡ Klik tiang/gardu tujuan untuk menyambungkan kabel...
                </span>
              ) : activeTool === "select" ? (
                <span>Mode Pilih: Klik simbol untuk geser atau edit atribut. [Ctrl+Z]: Undo, [Del]: Hapus.</span>
              ) : (
                <span>Mode Tambah: Klik di area gambar untuk meletakkan simbol.</span>
              )}
            </div>
          )}

          {/* SVG Canvas Board */}
          <svg
            ref={svgRef}
            className="w-full h-full bg-white select-none block"
            style={{ touchAction: "none" }}
          >
            <defs>
              {/* Pola grid 20px */}
              <pattern id="grid-pattern" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <circle cx={GRID_SIZE} cy={GRID_SIZE} r="1" fill="#E2E8F0" />
              </pattern>

              {/* Marker panah kontramast */}
              <marker
                id="arrow-kontramast"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={ASSET_COLORS.KONTRAMAST.stroke} />
              </marker>
            </defs>

            {/* Transform Layer for Zoom & Pan */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Background Grid */}
              {snapGrid && (
                <rect
                  x={-5000}
                  y={-5000}
                  width={10000}
                  height={10000}
                  fill="url(#grid-pattern)"
                  pointerEvents="none"
                />
              )}

              {/* ─── Render Edges (Garis Kabel) ─── */}
              {edges.map(edge => {
                const fromNode = nodes.find(n => n.id === edge.fromNodeId);
                const toNode = nodes.find(n => n.id === edge.toNodeId);
                if (!fromNode || !toNode) return null;

                const isSelected = selectedEdgeId === edge.id;
                const isTR = edge.type === "kabel-tr" || (edge.jenisJaringan && (edge.jenisJaringan.includes("TR") || edge.jenisJaringan.includes("SKUTR")));
                const isExist = edge.type === "kabel-existing";

                // Warna kabel konsisten FieldMap.tsx: Merah untuk TM, Hijau untuk TR
                const strokeColor = isSelected
                  ? ASSET_COLORS.SELECTED.stroke
                  : isExist
                  ? ASSET_COLORS.KABEL_EXISTING.stroke
                  : isTR
                  ? ASSET_COLORS.KABEL_TR.stroke
                  : ASSET_COLORS.KABEL_TM.stroke;

                const midX = (fromNode.x + toNode.x) / 2;
                const midY = (fromNode.y + toNode.y) / 2;

                return (
                  <g
                    key={edge.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                    }}
                    className="cursor-pointer group"
                  >
                    {/* Invisible thick line for easy selection target */}
                    <line
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      stroke="transparent"
                      strokeWidth={18}
                    />

                    {/* Visible Cable Line */}
                    <line
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 4 : isExist ? 2 : 2.8}
                      strokeDasharray={isExist ? ASSET_COLORS.KABEL_EXISTING.dashArray : undefined}
                      strokeLinecap="round"
                    />

                    {/* Cable Length Tag (Meter) */}
                    <g transform={`translate(${midX}, ${midY - 9})`}>
                      <rect
                        x={-28}
                        y={-8}
                        width={56}
                        height={16}
                        rx={4}
                        fill="white"
                        stroke={isSelected ? ASSET_COLORS.SELECTED.stroke : "#CBD5E1"}
                        strokeWidth={isSelected ? 1.5 : 1}
                        className="shadow-xs"
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        className="font-mono font-bold text-[9px] fill-slate-800 select-none"
                      >
                        {edge.lengthM} m
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* ─── Render Nodes (Simbol Konsisten FieldMap.tsx) ─── */}
              {nodes.map(node => {
                const isSelected = selectedNodeId === node.id;
                const isCableStart = cableStartNodeId === node.id;

                const isTM = node.type === "tiang-tm" || (node.type === "tiang-rencana" && node.kategori !== "TR");
                const isTR = node.type === "tiang-tr" || (node.kategori === "TR");

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={(e) => handleNodeClick(node, e)}
                    onMouseDown={(e) => handleNodeMouseDown(node, e)}
                    className="cursor-move group select-none"
                  >
                    {/* Selection Aura */}
                    {(isSelected || isCableStart) && (
                      <circle
                        r={20}
                        fill={isCableStart ? "rgba(239, 68, 68, 0.25)" : ASSET_COLORS.SELECTED.halo}
                        stroke={isCableStart ? "#EF4444" : ASSET_COLORS.SELECTED.stroke}
                        strokeWidth={2}
                        strokeDasharray="4,2"
                      />
                    )}

                    {/* 1. Tiang TM: Titik hitam dengan core kuning (PERSIS FieldMap.tsx) */}
                    {isTM && (
                      <g>
                        <circle
                          r={9}
                          fill={ASSET_COLORS.TIANG_TM.core}
                          stroke={ASSET_COLORS.TIANG_TM.color}
                          strokeWidth={3}
                        />
                        <circle r={2.5} fill={ASSET_COLORS.TIANG_TM.color} />
                      </g>
                    )}

                    {/* 2. Tiang TR: Titik putih dengan border biru (PERSIS FieldMap.tsx) */}
                    {isTR && (
                      <g>
                        <circle
                          r={8.5}
                          fill={ASSET_COLORS.TIANG_TR.core}
                          stroke={ASSET_COLORS.TIANG_TR.color}
                          strokeWidth={3}
                        />
                      </g>
                    )}

                    {/* 3. Tiang Existing: Titik solid gelap */}
                    {node.type === "tiang-existing" && (
                      <circle
                        r={8.5}
                        fill={ASSET_COLORS.TIANG_EXISTING.color}
                        stroke="#475569"
                        strokeWidth={2}
                      />
                    )}

                    {/* 4. Gardu: Kotak/Segitiga Ungu (PERSIS FieldMap.tsx) */}
                    {node.type === "gardu" && (
                      <g>
                        {/* Kotak latar ungu muda */}
                        <rect
                          x={-14}
                          y={-14}
                          width={28}
                          height={28}
                          fill={ASSET_COLORS.GARDU.bg}
                          stroke={ASSET_COLORS.GARDU.border}
                          strokeWidth={2.5}
                          rx={4}
                        />
                        {/* Segitiga simbol trafo */}
                        <polygon
                          points="0,-7 -8,6 8,6"
                          fill={ASSET_COLORS.GARDU.fill}
                          stroke={ASSET_COLORS.GARDU.border}
                          strokeWidth={2}
                          strokeLinejoin="round"
                        />
                        <text
                          x={0}
                          y={11.5}
                          textAnchor="middle"
                          className="text-[6.5px] font-black"
                          fill={ASSET_COLORS.GARDU.text}
                        >
                          {node.trafoKva || 100}kVA
                        </text>
                      </g>
                    )}

                    {/* 5. Box APP (kWh Meter): Kotak oranye */}
                    {node.type === "box-app" && (
                      <g>
                        <rect
                          x={-13}
                          y={-13}
                          width={26}
                          height={26}
                          fill={ASSET_COLORS.BOX_APP.bg}
                          stroke={ASSET_COLORS.BOX_APP.border}
                          strokeWidth={2.5}
                          rx={3}
                        />
                        <rect x={-8} y={-8} width={16} height={6} fill={ASSET_COLORS.BOX_APP.border} />
                        <text
                          x={0}
                          y={8}
                          textAnchor="middle"
                          className="text-[7.5px] font-black"
                          fill={ASSET_COLORS.BOX_APP.text}
                        >
                          APP
                        </text>
                      </g>
                    )}

                    {/* 6. Kontramast / Schoor */}
                    {node.type === "kontramast" && (
                      <g>
                        <line
                          x1={-12}
                          y1={12}
                          x2={12}
                          y2={-12}
                          stroke={ASSET_COLORS.KONTRAMAST.stroke}
                          strokeWidth={3}
                          markerEnd="url(#arrow-kontramast)"
                        />
                        <circle cx={-12} cy={12} r={3} fill={ASSET_COLORS.KONTRAMAST.stroke} />
                      </g>
                    )}

                    {/* Label Text di bawah simbol */}
                    <text
                      y={20}
                      textAnchor="middle"
                      className="text-[10px] font-bold fill-slate-900 select-none drop-shadow-xs"
                    >
                      {node.label || ""}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* ─── Bottom Property Inspector Panel ─── */}
        {!isPrinting && (selectedNode || selectedEdge) && (
          <div className="bg-white border-t-2 border-slate-300 p-2.5 px-4 flex items-center justify-between gap-4 z-10 shadow-lg animate-in slide-in-from-bottom-2">
            {/* INSPECTOR UNTUK SIMBOL (NODE) */}
            {selectedNode && (
              <div className="flex items-center gap-4 flex-wrap flex-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-800 uppercase tracking-tight">
                    {selectedNode.type.replace("-", " ").toUpperCase()}:
                  </span>
                  <input
                    type="text"
                    value={selectedNode.label || ""}
                    onChange={(e) => updateSelectedNode({ label: e.target.value })}
                    placeholder="Label Tiang"
                    className="px-2 py-1 border border-slate-300 rounded font-bold text-xs w-24 outline-none focus:border-blue-500"
                  />
                </div>

                {/* Atribut Tiang (TM / TR / Existing) */}
                {(selectedNode.type.startsWith("tiang")) && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">Kategori:</span>
                      <select
                        value={selectedNode.type === "tiang-tr" ? "TR" : "TM"}
                        onChange={(e) => {
                          const kat = e.target.value as "TM" | "TR";
                          updateSelectedNode({
                            type: kat === "TR" ? "tiang-tr" : "tiang-tm",
                            kategori: kat,
                            tinggiTiang: kat === "TR" ? 9 : 12,
                          });
                        }}
                        className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                      >
                        <option value="TM">Tegangan Menengah (20 kV)</option>
                        <option value="TR">Tegangan Rendah (380 V)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">Material:</span>
                      <select
                        value={selectedNode.materialTiang || "Beton"}
                        onChange={(e) => updateSelectedNode({ materialTiang: e.target.value as any })}
                        className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                      >
                        <option value="Beton">Beton</option>
                        <option value="Baja">Baja</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">Tinggi:</span>
                      <select
                        value={selectedNode.tinggiTiang || 12}
                        onChange={(e) => updateSelectedNode({ tinggiTiang: parseInt(e.target.value) })}
                        className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                      >
                        <option value={9}>9 Meter (JTR Standar)</option>
                        <option value={11}>11 Meter</option>
                        <option value={12}>12 Meter (JTM Standar)</option>
                        <option value={13}>13 Meter</option>
                        <option value={14}>14 Meter (JTM Trafo)</option>
                        <option value={7}>7 Meter</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">Kekuatan:</span>
                      <select
                        value={selectedNode.kekuatanTiang || 200}
                        onChange={(e) => updateSelectedNode({ kekuatanTiang: parseInt(e.target.value) })}
                        className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                      >
                        <option value={200}>200 daN (Tumpu)</option>
                        <option value={350}>350 daN (Sudut/Trafo)</option>
                        <option value={100}>100 daN</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">Posisi:</span>
                      <select
                        value={selectedNode.posisiTiang || "Tumpu"}
                        onChange={(e) => updateSelectedNode({ posisiTiang: e.target.value as any })}
                        className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                      >
                        <option value="Tumpu">Tumpu (Lurus)</option>
                        <option value="Topang-Sudut">Topang-Sudut (Belokan)</option>
                        <option value="Ujung">Ujung (Dead End)</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Atribut Gardu */}
                {selectedNode.type === "gardu" && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">Jenis:</span>
                      <select
                        value={selectedNode.garduJenis || "Portal"}
                        onChange={(e) => updateSelectedNode({ garduJenis: e.target.value as any })}
                        className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                      >
                        <option value="Portal">Portal (2 Tiang)</option>
                        <option value="Cantol">Cantol (1 Tiang)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">Kapasitas Trafo:</span>
                      <select
                        value={selectedNode.trafoKva || 100}
                        onChange={(e) => updateSelectedNode({ trafoKva: parseInt(e.target.value) })}
                        className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                      >
                        <option value={25}>25 kVA</option>
                        <option value={50}>50 kVA</option>
                        <option value={100}>100 kVA (Standar)</option>
                        <option value={160}>160 kVA</option>
                        <option value={200}>200 kVA</option>
                        <option value={250}>250 kVA</option>
                        <option value={400}>400 kVA</option>
                        <option value={630}>630 kVA</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Atribut Box APP */}
                {selectedNode.type === "box-app" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold">Daya APP:</span>
                    <select
                      value={selectedNode.boxKva || 197}
                      onChange={(e) => updateSelectedNode({ boxKva: parseFloat(e.target.value) })}
                      className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                    >
                      <option value={197}>53 s/d 197 kVA (Pengukuran Tidak Langsung)</option>
                      <option value={41.5}>23 s/d 41.5 kVA (Pengukuran Langsung)</option>
                      <option value={250}>Pengukuran TM</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* INSPECTOR UNTUK KABEL (EDGE) */}
            {selectedEdge && (
              <div className="flex items-center gap-4 flex-wrap flex-1 text-xs">
                <span className="font-black text-slate-800 uppercase tracking-tight">
                  {selectedEdge.type === "kabel-tr" ? "Kabel TR" : selectedEdge.type === "kabel-existing" ? "Kabel Exist" : "Kabel TM"}:
                </span>

                <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                  <span className="text-emerald-800 font-bold">Panjang (Meter):</span>
                  <input
                    type="number"
                    min={1}
                    value={selectedEdge.lengthM || 0}
                    onChange={(e) => updateSelectedEdge({ lengthM: parseFloat(e.target.value) || 0 })}
                    className="px-2 py-0.5 border border-emerald-300 rounded font-mono font-bold text-xs w-20 outline-none"
                  />
                  <span className="font-bold text-emerald-800">m</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">Jaringan:</span>
                  <select
                    value={selectedEdge.type === "kabel-tr" ? "TR" : "TM"}
                    onChange={(e) => {
                      const isTR = e.target.value === "TR";
                      updateSelectedEdge({
                        type: isTR ? "kabel-tr" : "kabel-tm",
                        jenisJaringan: isTR ? "SKUTR" : "SUTM",
                      });
                    }}
                    className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                  >
                    <option value="TM">TM (Merah - SUTM)</option>
                    <option value="TR">TR (Hijau - SKUTR)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">Konduktor:</span>
                  <select
                    value={selectedEdge.konduktorJenis || "AAAC/S"}
                    onChange={(e) => updateSelectedEdge({ konduktorJenis: e.target.value as any })}
                    className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                  >
                    <option value="AAAC/S">AAAC/S (Semi Isolasi)</option>
                    <option value="AAAC">AAAC (Telanjang)</option>
                    <option value="MVTIC">MVTIC (SKUTM Udara)</option>
                    <option value="NA2XSEYBY">NA2XSEYBY (Kabel Tanah)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-bold">Ukuran:</span>
                  <select
                    value={selectedEdge.kondukturUkuran || 70}
                    onChange={(e) => updateSelectedEdge({ kondukturUkuran: parseInt(e.target.value) })}
                    className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                  >
                    <option value={70}>70 mm² (Standar KHS)</option>
                    <option value={150}>150 mm²</option>
                    <option value={240}>240 mm²</option>
                    <option value={50}>50 mm²</option>
                    <option value={95}>95 mm²</option>
                    <option value={120}>120 mm²</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition cursor-pointer"
              >
                Hapus
              </button>
              <button
                onClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-300 transition cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
