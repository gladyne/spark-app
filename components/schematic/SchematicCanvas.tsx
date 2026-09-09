"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { SchematicData, SchematicNode, SchematicEdge, SchematicNodeType, SchematicEdgeType } from "../../types/schematic";
import KopGambar from "./KopGambar";
import TabelLegenda from "./TabelLegenda";

interface Props {
  schematic: SchematicData;
  onChange: (updated: SchematicData) => void;
  isPrinting?: boolean;
}

type ActiveTool =
  | "select"
  | "tiang-existing"
  | "tiang-rencana"
  | "gardu"
  | "box-app"
  | "kontramast"
  | "kabel-rencana"
  | "kabel-existing";

export default function SchematicCanvas({ schematic, onChange, isPrinting = false }: Props) {
  const { nodes, edges, kop } = schematic;

  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [cableStartNodeId, setCableStartNodeId] = useState<string | null>(null);

  // Dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Snap to grid
  const [snapGrid, setSnapGrid] = useState(true);
  const GRID_SIZE = 20;

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

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

  // Handler update Kop
  const handleKopChange = (updatedKop: Partial<typeof kop>) => {
    onChange({
      ...schematic,
      kop: { ...kop, ...updatedKop },
    });
  };

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
    if (activeTool === "kabel-rencana" || activeTool === "kabel-existing") {
      setCableStartNodeId(null);
      return;
    }

    // Tambah node baru
    const { x, y } = getCanvasCoords(e);
    const snappedX = snap(x);
    const snappedY = snap(y);

    const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let newNode: SchematicNode;

    if (activeTool === "tiang-rencana") {
      const idx = nodes.filter(n => n.type === "tiang-rencana").length + 1;
      newNode = {
        id: newNodeId,
        type: "tiang-rencana",
        x: snappedX,
        y: snappedY,
        label: `T.${idx}`,
        materialTiang: "Beton",
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
        label: `TE.${idx}`,
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
        label: "Kontramast",
        kontramastTipe: "Standar",
      };
    } else {
      return;
    }

    onChange({
      ...schematic,
      nodes: [...nodes, newNode],
    });
    setSelectedNodeId(newNodeId);
  };

  // Handler klik pada node (select node atau sambung kabel)
  const handleNodeClick = (node: SchematicNode, e: React.MouseEvent) => {
    e.stopPropagation();

    if (activeTool === "kabel-rencana" || activeTool === "kabel-existing") {
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
        const suggestedLen = Math.max(10, Math.round(distPx / 2));

        const promptVal = window.prompt(
          `Panjang kabel (meter) untuk segmen ${startNode?.label || "Awal"} ke ${node.label || "Tujuan"}:`,
          String(suggestedLen)
        );
        const lengthM = promptVal ? parseFloat(promptVal) || suggestedLen : suggestedLen;

        const newEdge: SchematicEdge = {
          id: `edge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: activeTool,
          fromNodeId: cableStartNodeId,
          toNodeId: node.id,
          jenisJaringan: "SUTM",
          konduktorJenis: "AAAC/S",
          kondukturUkuran: 70,
          lengthM,
          label: `${lengthM} m`,
        };

        onChange({
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

  const handleMouseUp = () => {
    setDraggingNodeId(null);
    setIsPanning(false);
  };

  // Hapus elemen terpilih
  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeId) {
      onChange({
        ...schematic,
        nodes: nodes.filter(n => n.id !== selectedNodeId),
        edges: edges.filter(e => e.fromNodeId !== selectedNodeId && e.toNodeId !== selectedNodeId),
      });
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      onChange({
        ...schematic,
        edges: edges.filter(e => e.id !== selectedEdgeId),
      });
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId, nodes, edges, schematic, onChange]);

  // Shortcut keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        handleDeleteSelected();
      }
      if (e.key === "Escape") {
        setActiveTool("select");
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setCableStartNodeId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDeleteSelected]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedEdge = edges.find(e => e.id === selectedEdgeId);

  // Update node attribute
  const updateSelectedNode = (attrs: Partial<SchematicNode>) => {
    if (!selectedNodeId) return;
    onChange({
      ...schematic,
      nodes: nodes.map(n => n.id === selectedNodeId ? { ...n, ...attrs } : n),
    });
  };

  // Update edge attribute
  const updateSelectedEdge = (attrs: Partial<SchematicEdge>) => {
    if (!selectedEdgeId) return;
    onChange({
      ...schematic,
      edges: edges.map(e => e.id === selectedEdgeId ? { ...e, ...attrs } : e),
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-200 overflow-hidden select-none">
      {/* ─── Top Toolbar Palette ─── */}
      {!isPrinting && (
        <div className="bg-slate-900 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between gap-3 text-white flex-shrink-0 shadow-md">
          {/* Tool Palettes */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => { setActiveTool("select"); setCableStartNodeId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTool === "select"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Pilih dan pindahkan simbol (V)"
            >
              <span>↖</span> Pilih
            </button>

            <div className="h-5 w-px bg-slate-700 mx-1" />

            {/* Simbol Titik */}
            <button
              onClick={() => setActiveTool("tiang-rencana")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTool === "tiang-rencana"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Rencana Tiang JTM (Lingkaran Putih)"
            >
              <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white bg-transparent" />
              <span>Rencana Tiang</span>
            </button>

            <button
              onClick={() => setActiveTool("tiang-existing")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTool === "tiang-existing"
                  ? "bg-slate-700 text-white border border-slate-500 shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Tiang Existing JTM (Lingkaran Hitam Solid)"
            >
              <span className="inline-block w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-400" />
              <span>Tiang Exist</span>
            </button>

            <button
              onClick={() => setActiveTool("gardu")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTool === "gardu"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Gardu Trafo Distribusi Portal/Cantol"
            >
              <span>⚡</span>
              <span>Gardu Trafo</span>
            </button>

            <button
              onClick={() => setActiveTool("box-app")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTool === "box-app"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Box APP kWh Meter"
            >
              <span>🔲</span>
              <span>Box APP</span>
            </button>

            <button
              onClick={() => setActiveTool("kontramast")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTool === "kontramast"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Kontramast / Schoor"
            >
              <span>⇗</span>
              <span>Kontramast</span>
            </button>

            <div className="h-5 w-px bg-slate-700 mx-1" />

            {/* Simbol Garis Kabel */}
            <button
              onClick={() => { setActiveTool("kabel-rencana"); setCableStartNodeId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTool === "kabel-rencana"
                  ? "bg-red-600 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Rencana Kabel (Garis Putus-putus - klik tiang asal lalu tiang tujuan)"
            >
              <span className="w-4 border-b-2 border-dashed border-red-300" />
              <span>Rencana Kabel</span>
            </button>

            <button
              onClick={() => { setActiveTool("kabel-existing"); setCableStartNodeId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                activeTool === "kabel-existing"
                  ? "bg-slate-600 text-white shadow-sm"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
              title="Kabel Existing (Garis Solid - klik tiang asal lalu tiang tujuan)"
            >
              <span className="w-4 h-0.5 bg-slate-300 rounded" />
              <span>Kabel Exist</span>
            </button>
          </div>

          {/* View Controls & Action */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSnapGrid(v => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                snapGrid
                  ? "bg-slate-800 text-emerald-400 border-emerald-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
              title="Toggle Snap ke Grid 20px"
            >
              Grid {snapGrid ? "ON" : "OFF"}
            </button>

            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setZoom(z => Math.max(0.4, Number((z - 0.1).toFixed(1))))}
                className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white font-bold text-sm"
                title="Zoom Out"
              >
                -
              </button>
              <span className="text-[11px] font-mono font-bold px-1 text-slate-200">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(2.5, Number((z + 0.1).toFixed(1))))}
                className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white font-bold text-sm"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                className="px-2 text-[10px] text-slate-400 hover:text-white border-l border-slate-700"
                title="Reset View"
              >
                100%
              </button>
            </div>

            {(selectedNodeId || selectedEdgeId) && (
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/40 rounded-lg text-xs font-bold transition flex items-center gap-1"
                title="Hapus elemen terpilih (Delete)"
              >
                <span>🗑️</span>
                <span>Hapus</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Helper Notification Banner saat menarik kabel */}
      {cableStartNodeId && (
        <div className="bg-red-500 text-white text-xs px-4 py-1.5 flex items-center justify-between font-bold shadow-md z-30 animate-pulse">
          <span>
            📍 Titik awal kabel terpilih: {nodes.find(n => n.id === cableStartNodeId)?.label || "Node"}. Klik tiang tujuan untuk menyambung...
          </span>
          <button
            onClick={() => setCableStartNodeId(null)}
            className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded"
          >
            Batal
          </button>
        </div>
      )}

      {/* ─── Main Drawing Area (A4 Landscape Blueprint Container) ─── */}
      <div 
        ref={canvasContainerRef}
        className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center relative cursor-crosshair"
      >
        {/* A4 Landscape Paper Boundary (1122px x 793px approx ratio 297mm x 210mm) */}
        <div 
          id="schematic-printable-area"
          className="bg-white shadow-2xl border-4 border-slate-900 rounded-sm w-[1150px] min-h-[800px] flex flex-col relative overflow-hidden flex-shrink-0"
        >
          {/* Header Kop Gambar PLN Resmi */}
          <KopGambar kop={kop} onChange={handleKopChange} isPrinting={isPrinting} />

          {/* Canvas SVG Area */}
          <div className="flex-1 relative min-h-[660px] bg-slate-50">
            {/* Tabel Legenda di Kanan Atas Kanvas */}
            <div className="absolute top-3 right-3 z-20 pointer-events-auto">
              <TabelLegenda schematic={schematic} />
            </div>

            {/* SVG Interactive Drawing Plane */}
            <svg
              ref={svgRef}
              className="w-full h-full absolute inset-0 cursor-crosshair"
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <defs>
                {/* Grid Pattern */}
                <pattern id="schematic-grid" width={GRID_SIZE * zoom} height={GRID_SIZE * zoom} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID_SIZE * zoom} 0 L 0 0 0 ${GRID_SIZE * zoom}`} fill="none" stroke="#E2E8F0" strokeWidth="1" />
                </pattern>
                {/* Arrow Marker for Kontramast */}
                <marker id="arrow-kontramast" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#1E293B" />
                </marker>
              </defs>

              {/* Grid Background */}
              <rect width="100%" height="100%" fill="url(#schematic-grid)" />

              {/* ─── Render Edges (Garis Kabel) ─── */}
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {edges.map(edge => {
                  const fromNode = nodes.find(n => n.id === edge.fromNodeId);
                  const toNode = nodes.find(n => n.id === edge.toNodeId);
                  if (!fromNode || !toNode) return null;

                  const isSelected = selectedEdgeId === edge.id;
                  const isRencana = edge.type === "kabel-rencana";
                  const strokeColor = isSelected ? "#2563EB" : isRencana ? "#DC2626" : "#0F172A";
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
                      {/* Invisible wider hit area */}
                      <line
                        x1={fromNode.x}
                        y1={fromNode.y}
                        x2={toNode.x}
                        y2={toNode.y}
                        stroke="transparent"
                        strokeWidth={16}
                      />

                      {/* Visible Cable Line */}
                      <line
                        x1={fromNode.x}
                        y1={fromNode.y}
                        x2={toNode.x}
                        y2={toNode.y}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 4 : isRencana ? 3 : 2.5}
                        strokeDasharray={isRencana ? "6,4" : undefined}
                        strokeLinecap="round"
                      />

                      {/* Cable Label & Length (Meter) */}
                      <g transform={`translate(${midX}, ${midY - 8})`}>
                        <rect
                          x={-30}
                          y={-9}
                          width={60}
                          height={16}
                          rx={4}
                          fill="white"
                          stroke={isSelected ? "#2563EB" : "#94A3B8"}
                          strokeWidth={1}
                        />
                        <text
                          x={0}
                          y={3}
                          textAnchor="middle"
                          className="font-mono font-bold text-[9px] fill-slate-800 select-none"
                        >
                          {edge.lengthM} m
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* ─── Render Nodes (Simbol) ─── */}
                {nodes.map(node => {
                  const isSelected = selectedNodeId === node.id;
                  const isCableStart = cableStartNodeId === node.id;

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
                          r={18}
                          fill={isCableStart ? "rgba(239, 68, 68, 0.25)" : "rgba(37, 99, 235, 0.2)"}
                          stroke={isCableStart ? "#EF4444" : "#2563EB"}
                          strokeWidth={1.5}
                          strokeDasharray="3,2"
                        />
                      )}

                      {/* 1. Tiang Rencana (○ Lingkaran Putih Outline Tebal) */}
                      {node.type === "tiang-rencana" && (
                        <g>
                          <circle r={9} fill="#FFFFFF" stroke="#0F172A" strokeWidth={3} />
                          <circle r={2} fill="#0F172A" />
                        </g>
                      )}

                      {/* 2. Tiang Existing (● Lingkaran Hitam Solid) */}
                      {node.type === "tiang-existing" && (
                        <circle r={9} fill="#0F172A" stroke="#475569" strokeWidth={1.5} />
                      )}

                      {/* 3. Gardu Distribusi (Trafo Symbol) */}
                      {node.type === "gardu" && (
                        <g>
                          <rect x={-14} y={-14} width={28} height={28} fill="#FEF3C7" stroke="#D97706" strokeWidth={2.5} rx={3} />
                          <circle cx={-3} cy={0} r={6} fill="none" stroke="#D97706" strokeWidth={2} />
                          <circle cx={3} cy={0} r={6} fill="none" stroke="#D97706" strokeWidth={2} />
                          <text x={0} y={11} textAnchor="middle" className="text-[7px] font-black fill-amber-900">
                            {node.trafoKva}kVA
                          </text>
                        </g>
                      )}

                      {/* 4. Box APP (kWh Meter Symbol) */}
                      {node.type === "box-app" && (
                        <g>
                          <rect x={-12} y={-12} width={24} height={24} fill="#DBEAFE" stroke="#2563EB" strokeWidth={2.5} rx={2} />
                          <rect x={-8} y={-8} width={16} height={6} fill="#93C5FD" />
                          <text x={0} y={7} textAnchor="middle" className="text-[7px] font-black fill-blue-900">
                            APP
                          </text>
                        </g>
                      )}

                      {/* 5. Kontramast Symbol */}
                      {node.type === "kontramast" && (
                        <g>
                          <line x1={-12} y1={12} x2={12} y2={-12} stroke="#0F172A" strokeWidth={3} markerEnd="url(#arrow-kontramast)" />
                          <circle cx={-12} cy={12} r={3} fill="#0F172A" />
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
        </div>
      </div>

      {/* ─── Floating / Bottom Property Inspector Panel ─── */}
      {!isPrinting && (selectedNode || selectedEdge) && (
        <div className="bg-white border-t-2 border-slate-300 p-3 shadow-2xl flex items-center justify-between gap-4 z-40 animate-in slide-in-from-bottom-2 duration-150">
          {/* INSPECTOR UNTUK NODE */}
          {selectedNode && (
            <div className="flex items-center gap-4 flex-wrap flex-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-800 uppercase tracking-tight">
                  Atribut {selectedNode.type.replace("-", " ")}:
                </span>
                <input
                  type="text"
                  value={selectedNode.label || ""}
                  onChange={(e) => updateSelectedNode({ label: e.target.value })}
                  placeholder="Label Tiang"
                  className="px-2 py-1 border border-slate-300 rounded font-bold text-xs w-24 outline-none focus:border-blue-500"
                />
              </div>

              {/* Atribut Tiang */}
              {(selectedNode.type === "tiang-rencana" || selectedNode.type === "tiang-existing") && (
                <>
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
                      <option value={9}>9 Meter (JTR)</option>
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
                Atribut {selectedEdge.type === "kabel-rencana" ? "Rencana Kabel" : "Kabel Existing"}:
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
                <span className="text-slate-500 font-bold">Jenis:</span>
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
  );
}
