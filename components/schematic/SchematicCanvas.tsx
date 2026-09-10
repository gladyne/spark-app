"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { SchematicData, SchematicNode, SchematicEdge, SchematicNodeType, SchematicEdgeType } from "../../types/schematic";
import {
  SPARK_ASSET_COLORS,
  renderPoleSvg,
  renderGarduSvg,
  renderSchoorSvg,
  renderBoxAppSvg,
  getCableStyle,
  getNodeLabelConfig,
} from "../../lib/assetStyles";

/**
 * Collision Detection & Dynamic Stagger Layout untuk Label Node
 * Mencegah label saling bertumpuk ketika jarak komponen berdekatan (< 75px)
 */
function computeNodeLabelOffsets(nodes: SchematicNode[]): Record<string, { dx: number; dy: number }> {
  const result: Record<string, { dx: number; dy: number }> = {};

  // Posisi dasar label tepat di bawah simbol
  for (const n of nodes) {
    const isPortal = n.type === "gardu" && (n.garduJenis === "Portal" || !n.garduJenis);
    result[n.id] = {
      dx: isPortal ? -10 : 0,
      dy: 16,
    };
  }

  // Sort nodes kiri ke kanan untuk urutan stagger teratur
  const sorted = [...nodes].sort((a, b) => a.x - b.x);

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];

    for (let j = 0; j < i; j++) {
      const prev = sorted[j];
      const distX = Math.abs(curr.x - prev.x);
      const distY = Math.abs(curr.y - prev.y);

      // Jika jarak X < 75px dan Y < 45px (berdekatan pada rantai horizontal yang sama)
      if (distX < 75 && distY < 45) {
        // Stagger vertikal bergantian: jika prev di 16, curr turun ke 36
        if (result[prev.id].dy <= 18) {
          result[curr.id].dy = 36;
        } else if (result[prev.id].dy >= 34) {
          result[curr.id].dy = 16;
        }

        // Jika jarak horizontal sangat sempit (< 50px), beri dorongan ke kiri/kanan
        if (distX < 50) {
          result[prev.id].dx -= 8;
          result[curr.id].dx += 8;
        }
      }
    }
  }

  return result;
}

interface Props {
  schematic: SchematicData;
  onChange: (updated: SchematicData) => void;
  isPrinting?: boolean;
}

type ActiveTool =
  | "select"
  | "tiang-tm"
  | "tiang-baja"
  | "tiang-existing"
  | "gardu-portal"
  | "gardu-cantol"
  | "treck-schoor"
  | "druck-schoor"
  | "kontramast"
  | "box-app"
  | "kabel-sutm"
  | "kabel-skutr"
  | "kabel-existing"
  // Legacy aliases
  | "tiang-rencana"
  | "tiang-tr"
  | "gardu"
  | "kabel-rencana"
  | "kabel-tm"
  | "kabel-tr";

export default function SchematicCanvas({ schematic, onChange, isPrinting = false }: Props) {
  const { nodes, edges } = schematic;
  const labelOffsets = useMemo(() => computeNodeLabelOffsets(nodes), [nodes]);

  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [cableStartNodeId, setCableStartNodeId] = useState<string | null>(null);

  // Dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStartSnapshot, setDragStartSnapshot] = useState<{ id: string; x: number; y: number } | null>(null);

  // In-memory Undo / Redo History Stack (maks 50 langkah)
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
    const isCableTool =
      activeTool === "kabel-sutm" ||
      activeTool === "kabel-skutr" ||
      activeTool === "kabel-existing" ||
      activeTool === "kabel-tm" ||
      activeTool === "kabel-tr" ||
      activeTool === "kabel-rencana";

    if (isCableTool) {
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
    } else if (activeTool === "tiang-baja") {
      const idx = nodes.filter(n => n.materialTiang === "Baja").length + 1;
      newNode = {
        id: newNodeId,
        type: "tiang-tm",
        kategori: "TM",
        x: snappedX,
        y: snappedY,
        label: `TB.${idx}`,
        materialTiang: "Baja",
        tinggiTiang: 12,
        kekuatanTiang: 200,
        posisiTiang: "Tumpu",
        konstruksi: "C1",
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
    } else if (activeTool === "gardu-portal" || activeTool === "gardu") {
      newNode = {
        id: newNodeId,
        type: "gardu",
        x: snappedX,
        y: snappedY,
        label: "Gardu Portal 100kVA",
        garduJenis: "Portal",
        trafoKva: 100,
        fasa: "3 phs",
      };
    } else if (activeTool === "gardu-cantol") {
      newNode = {
        id: newNodeId,
        type: "gardu",
        x: snappedX,
        y: snappedY,
        label: "Gardu Cantol 50kVA",
        garduJenis: "Cantol",
        trafoKva: 50,
        fasa: "3 phs",
      };
    } else if (activeTool === "treck-schoor") {
      newNode = {
        id: newNodeId,
        type: "treck-schoor",
        x: snappedX,
        y: snappedY,
        label: "Treck Schoor",
        schoor: { jenis: "Treck", tipe: "Standar", rotation: 0 },
      };
    } else if (activeTool === "druck-schoor") {
      newNode = {
        id: newNodeId,
        type: "druck-schoor",
        x: snappedX,
        y: snappedY,
        label: "Druck Schoor",
        schoor: { jenis: "Druck", rotation: 0 },
      };
    } else if (activeTool === "kontramast") {
      newNode = {
        id: newNodeId,
        type: "kontramast",
        x: snappedX,
        y: snappedY,
        label: "KM-01",
        kontramastTipe: "Standar",
        schoor: { jenis: "Kontramast", rotation: 0 },
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
      activeTool === "kabel-sutm" ||
      activeTool === "kabel-skutr" ||
      activeTool === "kabel-existing" ||
      activeTool === "kabel-tm" ||
      activeTool === "kabel-tr" ||
      activeTool === "kabel-rencana";

    if (isCableTool) {
      if (!cableStartNodeId) {
        // Klik node asal
        setCableStartNodeId(node.id);
      } else {
        // Klik node tujuan
        if (cableStartNodeId === node.id) {
          setCableStartNodeId(null);
          return;
        }

        const startNode = nodes.find(n => n.id === cableStartNodeId);
        const distPx = startNode ? Math.hypot(node.x - startNode.x, node.y - startNode.y) : 100;
        const recommendedM = Math.max(10, Math.round(distPx * 0.5));

        const isTR = activeTool === "kabel-skutr" || activeTool === "kabel-tr";
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

            {/* Simbol Tiang Beton (Kuning Lingkaran Hitam - Persis SparkMap.tsx) */}
            <button
              onClick={() => setActiveTool("tiang-tm")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "tiang-tm"
                  ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Tiang Beton (Lingkaran Kuning Border Hitam)"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-[#ffeb3b] border-2 border-black" />
              <span>Tiang Beton</span>
            </button>

            {/* Simbol Tiang Baja (Double-ring) */}
            <button
              onClick={() => setActiveTool("tiang-baja")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "tiang-baja"
                  ? "bg-amber-700 text-white shadow-sm ring-2 ring-amber-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Tiang Baja (Double-ring Konsentris)"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-[#ffeb3b] border-2 border-black flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full border border-black" />
              </div>
              <span>Tiang Baja</span>
            </button>

            {/* Simbol Tiang Exist (Hitam solid border putih) */}
            <button
              onClick={() => setActiveTool("tiang-existing")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "tiang-existing"
                  ? "bg-slate-700 text-white border border-slate-500 shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Tiang Existing (Hitam Border Putih)"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-black border border-white" />
              <span>Tiang Exist</span>
            </button>

            <div className="h-5 w-px bg-slate-700 mx-1" />

            {/* Gardu Portal (2 Tiang + Trafo Segitiga Ungu) */}
            <button
              onClick={() => setActiveTool("gardu-portal")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "gardu-portal"
                  ? "bg-purple-700 text-white shadow-sm ring-2 ring-purple-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Gardu Portal (2 Tiang Trafo Ungu - Persis SparkMap.tsx)"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <svg width="14" height="14" viewBox="-14 -20 28 28">
                  <circle cx="-6" cy="0" r="4" fill="white" stroke="#000" strokeWidth="1.5" />
                  <circle cx="6" cy="0" r="4" fill="white" stroke="#000" strokeWidth="1.5" />
                  <polygon points="0,-16 10,-4 -10,-4" fill={SPARK_ASSET_COLORS.GARDU.fill} stroke={SPARK_ASSET_COLORS.GARDU.stroke} strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <span>Gardu Portal</span>
            </button>

            {/* Gardu Cantol (1 Tiang + Trafo Segitiga Ungu) */}
            <button
              onClick={() => setActiveTool("gardu-cantol")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "gardu-cantol"
                  ? "bg-purple-700 text-white shadow-sm ring-2 ring-purple-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Gardu Cantol (1 Tiang Trafo Ungu)"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <svg width="12" height="14" viewBox="-10 -20 20 28">
                  <circle cx="0" cy="0" r="4" fill="white" stroke="#000" strokeWidth="1.5" />
                  <polygon points="0,-16 7,-4 -7,-4" fill={SPARK_ASSET_COLORS.GARDU.fill} stroke={SPARK_ASSET_COLORS.GARDU.stroke} strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <span>Gardu Cantol</span>
            </button>

            <div className="h-5 w-px bg-slate-700 mx-1" />

            {/* Treckschoor Standar */}
            <button
              onClick={() => setActiveTool("treck-schoor")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "treck-schoor"
                  ? "bg-red-700 text-white shadow-sm ring-2 ring-red-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Treckschoor (Panah Merah Tarik Keluar - svgUtils.ts)"
            >
              <div className="w-3.5 h-3.5 flex items-center justify-center">
                <svg width="12" height="12" viewBox="-25 -25 50 50">
                  <line x1="0" y1="6" x2="0" y2="-20" stroke={SPARK_ASSET_COLORS.SCHOOR.treck} strokeWidth="3.5" strokeLinecap="round" />
                  <polygon points="-5,-12 0,-20 5,-12" fill={SPARK_ASSET_COLORS.SCHOOR.treck} />
                </svg>
              </div>
              <span>Treck</span>
            </button>

            {/* Drukschoor */}
            <button
              onClick={() => setActiveTool("druck-schoor")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "druck-schoor"
                  ? "bg-blue-700 text-white shadow-sm ring-2 ring-blue-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Drukschoor (Panah Biru Dorong ke Dalam - svgUtils.ts)"
            >
              <div className="w-3.5 h-3.5 flex items-center justify-center">
                <svg width="12" height="12" viewBox="-25 -25 50 50">
                  <line x1="0" y1="-20" x2="0" y2="-4" stroke={SPARK_ASSET_COLORS.SCHOOR.druck} strokeWidth="3.5" strokeLinecap="round" />
                  <polygon points="-5,-12 0,-4 5,-12" fill={SPARK_ASSET_COLORS.SCHOOR.druck} />
                </svg>
              </div>
              <span>Druck</span>
            </button>

            {/* Kontramast */}
            <button
              onClick={() => setActiveTool("kontramast")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "kontramast"
                  ? "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Kontramast (Tiang Jangkar Seberang - svgUtils.ts)"
            >
              <div className="w-3.5 h-3.5 flex items-center justify-center">
                <svg width="12" height="12" viewBox="-15 -35 30 50">
                  <line x1="0" y1="-4" x2="0" y2="-18" stroke={SPARK_ASSET_COLORS.SCHOOR.kontramast} strokeWidth="2" strokeDasharray="3 2" />
                  <circle cx="0" cy="-21" r="4" fill="white" stroke={SPARK_ASSET_COLORS.SCHOOR.kontramast} strokeWidth="2.5" />
                  <line x1="0" y1="-25" x2="0" y2="-34" stroke={SPARK_ASSET_COLORS.SCHOOR.kontramast} strokeWidth="2.5" />
                  <polygon points="-4,-28 0,-34 4,-28" fill={SPARK_ASSET_COLORS.SCHOOR.kontramast} />
                </svg>
              </div>
              <span>Kontramast</span>
            </button>

            {/* Box APP */}
            <button
              onClick={() => setActiveTool("box-app")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "box-app"
                  ? "bg-indigo-700 text-white shadow-sm ring-2 ring-indigo-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Box APP kWh Meter PLN"
            >
              <div className="w-3.5 h-3.5 bg-blue-100 border border-blue-600 rounded-xs flex items-center justify-center text-[7px] font-black text-blue-900">
                A
              </div>
              <span>Box APP</span>
            </button>

            <div className="h-5 w-px bg-slate-700 mx-1" />

            {/* Kabel SUTM */}
            <button
              onClick={() => { setActiveTool("kabel-sutm"); setCableStartNodeId(null); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "kabel-sutm"
                  ? "bg-blue-700 text-white shadow-sm ring-2 ring-blue-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Kabel SUTM (Biru Solid)"
            >
              <div className="w-4 h-1 bg-blue-500 rounded-full" />
              <span>SUTM</span>
            </button>

            {/* Kabel SKUTR */}
            <button
              onClick={() => { setActiveTool("kabel-skutr"); setCableStartNodeId(null); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "kabel-skutr"
                  ? "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-400/50"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Kabel SKUTR (Hijau Dashed)"
            >
              <div className="w-4 border-b-2 border-dashed border-green-400" />
              <span>SKUTR</span>
            </button>

            {/* Kabel Exist */}
            <button
              onClick={() => { setActiveTool("kabel-existing"); setCableStartNodeId(null); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === "kabel-existing"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Kabel Existing (Hitam Dashed)"
            >
              <div className="w-4 h-0.5 bg-slate-300 rounded-full" />
              <span>Exist</span>
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
                const isExist = edge.type === "kabel-existing";
                const cableStyle = getCableStyle(edge.jenisJaringan || "SUTM", isExist);

                const strokeColor = isSelected ? SPARK_ASSET_COLORS.POLE.selectedHalo : cableStyle.stroke;
                const strokeWidth = isSelected ? 4.5 : cableStyle.strokeWidth;
                const strokeDasharray = cableStyle.strokeDasharray;

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
                    {/* Invisible line for easier tap target */}
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
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeLinecap="round"
                    />

                    {/* Cable Length Tag (Meter) */}
                    <g transform={`translate(${midX}, ${midY - 8})`}>
                      <rect
                        x={-22}
                        y={-7.5}
                        width={44}
                        height={15}
                        rx={4}
                        fill="white"
                        stroke={isSelected ? SPARK_ASSET_COLORS.POLE.selectedHalo : "#CBD5E1"}
                        strokeWidth={1}
                        className="shadow-xs"
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="900"
                        fill="#1D4ED8"
                        fontFamily="system-ui, -apple-system, sans-serif"
                        className="select-none"
                      >
                        {edge.lengthM} m
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* ─── Render Nodes ─── */}
              {nodes.map(node => {
                const isSelected = selectedNodeId === node.id;
                const isCableStart = cableStartNodeId === node.id;

                const isPole =
                  node.type === "tiang-tm" ||
                  node.type === "tiang-tr" ||
                  node.type === "tiang-rencana" ||
                  node.type === "tiang-existing";

                const lblConfig = getNodeLabelConfig(node);
                const offset = labelOffsets[node.id] || { dx: 0, dy: 16 };

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
                        r={13}
                        fill={isCableStart ? "rgba(239, 68, 68, 0.2)" : "rgba(249, 115, 22, 0.2)"}
                        stroke={isCableStart ? "#EF4444" : SPARK_ASSET_COLORS.POLE.selectedHalo}
                        strokeWidth={1.8}
                        strokeDasharray="3,2"
                      />
                    )}

                    {/* Render Schoor jika terpasang pada tiang ini */}
                    {node.schoor && (
                      renderSchoorSvg({
                        jenis: node.schoor.jenis,
                        tipe: node.schoor.tipe,
                        rot: node.schoor.rotation || 0,
                        poleSize: 17,
                      })
                    )}

                    {/* 1. Tiang (Beton vs Baja / Existing) */}
                    {isPole && (
                      renderPoleSvg({
                        material: node.materialTiang || "Beton",
                        isExisting: node.type === "tiang-existing",
                        isSelected,
                        size: 17,
                      })
                    )}

                    {/* 2. Gardu Distribusi (Cantol / Portal) */}
                    {node.type === "gardu" && (
                      renderGarduSvg({
                        jenis: node.garduJenis || "Portal",
                        trafoKva: node.trafoKva || 100,
                        poleSize: 17,
                        renderMainPole: true,
                      })
                    )}

                    {/* 3. Schoor Mandiri di Kanvas */}
                    {node.type === "treck-schoor" && (
                      renderSchoorSvg({
                        jenis: "Treck",
                        tipe: node.kontramastTipe || "Standar",
                        rot: node.schoor?.rotation || 0,
                        poleSize: 17,
                      })
                    )}

                    {node.type === "druck-schoor" && (
                      renderSchoorSvg({
                        jenis: "Druck",
                        rot: node.schoor?.rotation || 0,
                        poleSize: 17,
                      })
                    )}

                    {node.type === "kontramast" && (
                      renderSchoorSvg({
                        jenis: "Kontramast",
                        rot: node.schoor?.rotation || 0,
                        poleSize: 17,
                      })
                    )}

                    {/* 4. Box APP (kWh Meter) */}
                    {node.type === "box-app" && (
                      renderBoxAppSvg({
                        boxKva: node.boxKva || 197,
                        size: 18,
                      })
                    )}

                    {/* ── Label Multi-baris ── */}
                    <g
                      transform={`translate(${offset.dx}, ${offset.dy})`}
                      pointerEvents="none"
                      className="select-none"
                    >
                      {/* Line 1: Konstruksi / Kode Utama */}
                      <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="900"
                        fill={lblConfig.primaryColor}
                        stroke="#ffffff"
                        strokeWidth={3}
                        strokeLinejoin="round"
                        paintOrder="stroke fill"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        {lblConfig.primaryText}
                      </text>

                      {/* Line 2 (Gardu Jenis) */}
                      {lblConfig.garduText && (
                        <text
                          x={0}
                          y={12}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="800"
                          fill="#7e22ce"
                          stroke="#ffffff"
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                          paintOrder="stroke fill"
                          fontFamily="system-ui, -apple-system, sans-serif"
                        >
                          {lblConfig.garduText}
                        </text>
                      )}

                      {/* Line 3 (Trafo kVA) */}
                      {lblConfig.trafoText && (
                        <text
                          x={0}
                          y={lblConfig.garduText ? 23 : 12}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="900"
                          fill={lblConfig.garduText ? "#7e22ce" : "#1e3a8a"}
                          stroke="#ffffff"
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                          paintOrder="stroke fill"
                          fontFamily="system-ui, -apple-system, sans-serif"
                        >
                          {lblConfig.trafoText}
                        </text>
                      )}

                      {/* Line 2 (Secondary Tiang) */}
                      {lblConfig.secondaryText && !lblConfig.garduText && (
                        <text
                          x={0}
                          y={11}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="700"
                          fill="#334155"
                          stroke="#ffffff"
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                          paintOrder="stroke fill"
                          fontFamily="system-ui, -apple-system, sans-serif"
                        >
                          {lblConfig.secondaryText}
                        </text>
                      )}
                    </g>
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

                {/* Atribut Tiang (Beton / Baja / Material / Tinggi / Posisi) */}
                {(selectedNode.type.startsWith("tiang")) && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-bold">Material:</span>
                      <select
                        value={selectedNode.materialTiang || "Beton"}
                        onChange={(e) => updateSelectedNode({ materialTiang: e.target.value as any })}
                        className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                      >
                        <option value="Beton">Tiang Beton (Solid Kuning)</option>
                        <option value="Baja">Tiang Baja (Double Ring)</option>
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

                    {/* Pasang Penopang Schoor langsung pada tiang */}
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded border border-slate-200">
                      <span className="text-slate-700 font-bold">Schoor:</span>
                      <select
                        value={selectedNode.schoor ? selectedNode.schoor.jenis : "None"}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "None") {
                            updateSelectedNode({ schoor: undefined });
                          } else {
                            updateSelectedNode({
                              schoor: {
                                jenis: val as any,
                                tipe: selectedNode.schoor?.tipe || "Standar",
                                rotation: selectedNode.schoor?.rotation || 0,
                              },
                            });
                          }
                        }}
                        className="px-1.5 py-0.5 border border-slate-300 rounded font-semibold text-xs outline-none"
                      >
                        <option value="None">Tanpa Schoor</option>
                        <option value="Treck">Treckschoor (Tarik)</option>
                        <option value="Druck">Drukschoor (Dorong)</option>
                        <option value="Kontramast">Kontramast</option>
                      </select>

                      {selectedNode.schoor && (
                        <>
                          {selectedNode.schoor.jenis === "Treck" && (
                            <select
                              value={selectedNode.schoor.tipe || "Standar"}
                              onChange={(e) => updateSelectedNode({
                                schoor: { ...selectedNode.schoor!, tipe: e.target.value as any }
                              })}
                              className="px-1 py-0.5 border border-slate-300 rounded font-semibold text-xs outline-none"
                            >
                              <option value="Standar">Standar</option>
                              <option value="Tolak Pinggang">Tolak Pinggang</option>
                            </select>
                          )}
                          <span className="text-slate-500 font-bold ml-1">Rot:</span>
                          <input
                            type="number"
                            min={0}
                            max={360}
                            step={15}
                            value={selectedNode.schoor.rotation || 0}
                            onChange={(e) => updateSelectedNode({
                              schoor: { ...selectedNode.schoor!, rotation: parseInt(e.target.value) || 0 }
                            })}
                            className="w-14 px-1 py-0.5 border border-slate-300 rounded font-mono font-bold text-xs"
                          />
                          <span>°</span>
                        </>
                      )}
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
                  Atribut {selectedEdge.type === "kabel-existing" ? "Kabel Exist" : selectedEdge.jenisJaringan || "SUTM"}:
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
                    value={selectedEdge.jenisJaringan || "SUTM"}
                    onChange={(e) => updateSelectedEdge({ jenisJaringan: e.target.value })}
                    className="px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none"
                  >
                    <option value="SUTM">SUTM (Saluran Udara TM)</option>
                    <option value="SKUTR">SKUTR (Saluran Kabel Udara TR)</option>
                    <option value="SKUTM">SKUTM (Kabel Udara TM / MVTIC)</option>
                    <option value="SKTM">SKTM (Kabel Tanah TM)</option>
                    <option value="SKTR">SKTR (Kabel Tanah TR)</option>
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
