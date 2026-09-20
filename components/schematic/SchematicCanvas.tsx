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
  getValidTrafoOptions,
  CANTOL_MAX_KVA,
  parseKva,
} from "../../lib/assetStyles";
import { convertSchematicToRabLayers } from "../../lib/rab/schematicAdapter";
import { calculateRabVolumes } from "../../lib/rab/rabMapper";
import { formatRupiah } from "../sidebar/RabSummaryPanel";

/**
 * Geometry Helpers untuk Mode Seleksi Multi (Rectangle, Polygon, Lasso, Circle)
 */
function pointInPolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInRect(pt: { x: number; y: number }, minX: number, maxX: number, minY: number, maxY: number): boolean {
  return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
}

function isPointInCircle(pt: { x: number; y: number }, cx: number, cy: number, r: number): boolean {
  return Math.hypot(pt.x - cx, pt.y - cy) <= r;
}

function isLineInRect(p1: { x: number; y: number }, p2: { x: number; y: number }, minX: number, maxX: number, minY: number, maxY: number): boolean {
  if (isPointInRect(p1, minX, maxX, minY, maxY) || isPointInRect(p2, minX, maxX, minY, maxY)) return true;
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  return isPointInRect(mid, minX, maxX, minY, maxY);
}

function isLineInCircle(p1: { x: number; y: number }, p2: { x: number; y: number }, cx: number, cy: number, r: number): boolean {
  if (isPointInCircle(p1, cx, cy, r) || isPointInCircle(p2, cx, cy, r)) return true;
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  return isPointInCircle(mid, cx, cy, r);
}

function isLineInPolygon(p1: { x: number; y: number }, p2: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  if (pointInPolygon(p1, poly) || pointInPolygon(p2, poly)) return true;
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  return pointInPolygon(mid, poly);
}

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

export type ActiveTool =
  | "select"
  | "select-rect"
  | "select-polygon"
  | "select-lasso"
  | "select-circle"
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
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());
  const [cableStartNodeId, setCableStartNodeId] = useState<string | null>(null);

  // Selection Shape State
  type SelectionShape =
    | { type: "rect"; startX: number; startY: number; currentX: number; currentY: number }
    | { type: "circle"; cx: number; cy: number; currentX: number; currentY: number }
    | { type: "lasso"; points: { x: number; y: number }[] }
    | { type: "polygon"; points: { x: number; y: number }[]; currentPoint?: { x: number; y: number } }
    | null;

  const [selectionShape, setSelectionShape] = useState<SelectionShape>(null);

  // Multi-node dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartSnapshot, setDragStartSnapshot] = useState<{ id: string; x: number; y: number }[] | null>(null);
  const [dragStartCoords, setDragStartCoords] = useState<{ x: number; y: number } | null>(null);

  // Gardu interactive on-canvas handles (rotasi bebas & offset posisi)
  const [rotatingGarduNodeId, setRotatingGarduNodeId] = useState<string | null>(null);
  const [garduRotateCenter, setGarduRotateCenter] = useState<{ x: number; y: number } | null>(null);
  const [offsettingGarduNodeId, setOffsettingGarduNodeId] = useState<string | null>(null);
  const [offsetDragStart, setOffsetDragStart] = useState<{ x: number; y: number; initX: number; initY: number } | null>(null);

  // Modals state
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    materialTiang: "",
    tinggiTiang: "",
    kekuatanTiang: "",
    posisiTiang: "",
    garduJenis: "",
    trafoKva: "",
    jenisJaringan: "",
    konduktorJenis: "",
    kondukturUkuran: "",
  });

  // In-memory Undo / Redo History Stack (maks 50 langkah)
  const [past, setPast] = useState<SchematicData[]>([]);
  const [future, setFuture] = useState<SchematicData[]>([]);

  // Internal Clipboard untuk Copy, Paste & Duplicate
  const [clipboard, setClipboard] = useState<{ nodes: SchematicNode[]; edges: SchematicEdge[] } | null>(null);
  const clipboardRef = useRef<{ nodes: SchematicNode[]; edges: SchematicEdge[] } | null>(null);
  const pasteCountRef = useRef(1);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);

  // Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Snap to grid
  const [snapGrid, setSnapGrid] = useState(true);
  const GRID_SIZE = 20;

  const svgRef = useRef<SVGSVGElement>(null);
  // Guard flag untuk mencegah handleCanvasClick menghapus seleksi setelah drag seleksi selesai
  const hasSelectedJustFinishedRef = useRef(false);

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

  // Helper push ke history sebelum commit perubahan (1-step undo)
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
    setSelectedNodeIds(prev => new Set(Array.from(prev).filter(id => previous.nodes.some(n => n.id === id))));
    setSelectedEdgeIds(prev => new Set(Array.from(prev).filter(id => previous.edges.some(e => e.id === id))));
    onChange(previous);
  }, [past, schematic, onChange]);

  // Handler Redo
  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast(p => [...p.slice(-49), schematic]);
    setFuture(newFuture);
    setSelectedNodeIds(prev => new Set(Array.from(prev).filter(id => next.nodes.some(n => n.id === id))));
    setSelectedEdgeIds(prev => new Set(Array.from(prev).filter(id => next.edges.some(e => e.id === id))));
    onChange(next);
  }, [future, schematic, onChange]);

  // Selection Sets & Breakdown
  const selectedNodes = useMemo(() => nodes.filter(n => selectedNodeIds.has(n.id)), [nodes, selectedNodeIds]);
  const selectedEdges = useMemo(() => edges.filter(e => selectedEdgeIds.has(e.id)), [edges, selectedEdgeIds]);
  const totalSelectedCount = selectedNodes.length + selectedEdges.length;

  const breakdown = useMemo(() => {
    let tiangCount = 0;
    let garduCount = 0;
    let schoorCount = 0;
    let boxCount = 0;
    let cableCount = selectedEdges.length;
    let cableTotalM = 0;

    for (const n of selectedNodes) {
      if (n.type.startsWith("tiang")) tiangCount++;
      else if (n.type === "gardu") garduCount++;
      else if (n.type === "box-app") boxCount++;
      else if (n.type.includes("schoor") || n.type === "kontramast") schoorCount++;
    }

    for (const e of selectedEdges) {
      cableTotalM += (e.lengthM || 0);
    }

    return { tiangCount, garduCount, schoorCount, boxCount, cableCount, cableTotalM };
  }, [selectedNodes, selectedEdges]);

  // Subset RAB Estimation: Filter subset data terselect dan panggil rabMapper.ts
  const selectedRabTotal = useMemo(() => {
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return 0;
    try {
      const subsetSchematic: SchematicData = {
        ...schematic,
        nodes: selectedNodes,
        edges: selectedEdges,
      };
      const layers = convertSchematicToRabLayers(subsetSchematic);
      const rab = calculateRabVolumes(layers);
      return rab.grandTotal;
    } catch {
      return 0;
    }
  }, [schematic, selectedNodes, selectedEdges]);

  // Select All
  const handleSelectAll = useCallback(() => {
    setSelectedNodeIds(new Set(nodes.map(n => n.id)));
    setSelectedEdgeIds(new Set(edges.map(e => e.id)));
  }, [nodes, edges]);

  // Clear Selection
  const handleClearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    setSelectionShape(null);
    setCableStartNodeId(null);
  }, []);

  // Selesaikan seleksi Poligon
  const completePolygonSelection = useCallback((points: { x: number; y: number }[]) => {
    if (points.length >= 3) {
      const hitNodes = nodes.filter(n => pointInPolygon(n, points)).map(n => n.id);
      const hitEdges = edges.filter(e => {
        const fn = nodes.find(n => n.id === e.fromNodeId);
        const tn = nodes.find(n => n.id === e.toNodeId);
        return fn && tn && isLineInPolygon(fn, tn, points);
      }).map(e => e.id);
      setSelectedNodeIds(new Set(hitNodes));
      setSelectedEdgeIds(new Set(hitEdges));
    }
    setSelectionShape(null);
  }, [nodes, edges]);

  // Bulk Delete Execution (1-step undo)
  const handleExecuteBulkDelete = useCallback(() => {
    const newNodes = nodes.filter(n => !selectedNodeIds.has(n.id));
    const newEdges = edges.filter(
      e => !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.fromNodeId) && !selectedNodeIds.has(e.toNodeId)
    );

    pushState({
      ...schematic,
      nodes: newNodes,
      edges: newEdges,
    });

    setSelectedNodeIds(new Set());
    setSelectedEdgeIds(new Set());
    setIsConfirmDeleteOpen(false);
  }, [nodes, edges, selectedNodeIds, selectedEdgeIds, schematic, pushState]);

  // Bulk Edit Execution (1-step undo)
  const handleExecuteBulkEdit = useCallback(() => {
    const newNodes = nodes.map(n => {
      if (!selectedNodeIds.has(n.id)) return n;
      const updated = { ...n };
      if (bulkForm.materialTiang) updated.materialTiang = bulkForm.materialTiang as any;
      if (bulkForm.tinggiTiang) updated.tinggiTiang = parseInt(bulkForm.tinggiTiang);
      if (bulkForm.kekuatanTiang) updated.kekuatanTiang = parseInt(bulkForm.kekuatanTiang);
      if (bulkForm.posisiTiang) updated.posisiTiang = bulkForm.posisiTiang as any;
      if (bulkForm.garduJenis) updated.garduJenis = bulkForm.garduJenis as any;
      if (bulkForm.trafoKva) updated.trafoKva = parseInt(bulkForm.trafoKva);
      return updated;
    });

    const newEdges = edges.map(e => {
      if (!selectedEdgeIds.has(e.id)) return e;
      const updated = { ...e };
      if (bulkForm.jenisJaringan) updated.jenisJaringan = bulkForm.jenisJaringan;
      if (bulkForm.konduktorJenis) updated.konduktorJenis = bulkForm.konduktorJenis as any;
      if (bulkForm.kondukturUkuran) updated.kondukturUkuran = parseInt(bulkForm.kondukturUkuran);
      return updated;
    });

    pushState({
      ...schematic,
      nodes: newNodes,
      edges: newEdges,
    });

    setIsBulkEditOpen(false);
    setBulkForm({
      materialTiang: "",
      tinggiTiang: "",
      kekuatanTiang: "",
      posisiTiang: "",
      garduJenis: "",
      trafoKva: "",
      jenisJaringan: "",
      konduktorJenis: "",
      kondukturUkuran: "",
    });
  }, [nodes, edges, selectedNodeIds, selectedEdgeIds, bulkForm, schematic, pushState]);

  // ─── Copy Selection (Ctrl+C) ───
  const handleCopy = useCallback(() => {
    if (selectedNodeIds.size === 0) return;

    // Ambil node yang terselect dengan semua atribut lengkap
    const nodesToCopy = nodes
      .filter(n => selectedNodeIds.has(n.id))
      .map(n => ({ ...n }));

    const copiedNodeIdSet = new Set(nodesToCopy.map(n => n.id));

    // Untuk kabel/edge: HANYA include yang KEDUA ujungnya sama-sama terselect
    const edgesToCopy = edges
      .filter(e => copiedNodeIdSet.has(e.fromNodeId) && copiedNodeIdSet.has(e.toNodeId))
      .map(e => ({ ...e }));

    if (nodesToCopy.length === 0) return;

    const data = { nodes: nodesToCopy, edges: edgesToCopy };
    clipboardRef.current = data;
    setClipboard(data);
    pasteCountRef.current = 1;

    setClipboardNotice(`${nodesToCopy.length} item disalin`);
    setTimeout(() => setClipboardNotice(null), 1800);
  }, [nodes, edges, selectedNodeIds]);

  // ─── Paste Selection (Ctrl+V) ───
  const handlePaste = useCallback((customData?: { nodes: SchematicNode[]; edges: SchematicEdge[] }) => {
    const source = customData || clipboardRef.current;
    if (!source || source.nodes.length === 0) return;

    const baseOffset = snapGrid ? 40 : 30;
    const offsetDistance = baseOffset * pasteCountRef.current;
    pasteCountRef.current += 1;

    // Mapping ID lama -> baru
    const oldToNewNodeIdMap = new Map<string, string>();

    const newNodes: SchematicNode[] = source.nodes.map(node => {
      const newId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${Math.random().toString(36).substring(2, 4)}`;
      oldToNewNodeIdMap.set(node.id, newId);

      const newX = snap(node.x + offsetDistance);
      const newY = snap(node.y + offsetDistance);

      return {
        ...node,
        id: newId,
        x: newX,
        y: newY,
      };
    });

    const newEdges: SchematicEdge[] = source.edges
      .filter(edge => oldToNewNodeIdMap.has(edge.fromNodeId) && oldToNewNodeIdMap.has(edge.toNodeId))
      .map(edge => {
        const newEdgeId = `edge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${Math.random().toString(36).substring(2, 4)}`;
        return {
          ...edge,
          id: newEdgeId,
          fromNodeId: oldToNewNodeIdMap.get(edge.fromNodeId)!,
          toNodeId: oldToNewNodeIdMap.get(edge.toNodeId)!,
        };
      });

    // 1 langkah history undo untuk seluruh item hasil paste
    pushState({
      ...schematic,
      nodes: [...nodes, ...newNodes],
      edges: [...edges, ...newEdges],
    });

    // Otomatis pilih item-item hasil paste
    setSelectedNodeIds(new Set(newNodes.map(n => n.id)));
    setSelectedEdgeIds(new Set(newEdges.map(e => e.id)));

    setClipboardNotice(`${newNodes.length} item ditempel`);
    setTimeout(() => setClipboardNotice(null), 1800);
  }, [schematic, nodes, edges, pushState, snap, snapGrid]);

  // ─── Duplicate (Ctrl+D: Copy + Paste dalam 1 langkah) ───
  const handleDuplicate = useCallback(() => {
    if (selectedNodeIds.size === 0) return;

    const nodesToCopy = nodes
      .filter(n => selectedNodeIds.has(n.id))
      .map(n => ({ ...n }));

    const copiedNodeIdSet = new Set(nodesToCopy.map(n => n.id));

    const edgesToCopy = edges
      .filter(e => copiedNodeIdSet.has(e.fromNodeId) && copiedNodeIdSet.has(e.toNodeId))
      .map(e => ({ ...e }));

    if (nodesToCopy.length === 0) return;

    const data = { nodes: nodesToCopy, edges: edgesToCopy };
    clipboardRef.current = data;
    setClipboard(data);
    pasteCountRef.current = 1;
    handlePaste(data);
  }, [nodes, edges, selectedNodeIds, handlePaste]);

  // Global Keyboard Shortcuts (Undo/Redo, Copy/Paste/Duplicate, Delete, Escape, Ctrl+A, Enter)
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

      // Copy: Ctrl+C / Cmd+C
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "c") {
        if (selectedNodeIds.size > 0) {
          e.preventDefault();
          handleCopy();
          return;
        }
      }

      // Paste: Ctrl+V / Cmd+V
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "v") {
        if (clipboardRef.current && clipboardRef.current.nodes.length > 0) {
          e.preventDefault();
          handlePaste();
          return;
        }
      }

      // Duplicate: Ctrl+D / Cmd+D
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "d") {
        if (selectedNodeIds.size > 0) {
          e.preventDefault();
          handleDuplicate();
          return;
        }
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

      // Select All: Ctrl+A / Cmd+A
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Enter: Selesaikan poligon aktif
      if (e.key === "Enter") {
        if (selectionShape && selectionShape.type === "polygon" && selectionShape.points.length >= 3) {
          e.preventDefault();
          completePolygonSelection(selectionShape.points);
          return;
        }
      }

      // Delete / Backspace: Konfirmasi hapus
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeIds.size > 0 || selectedEdgeIds.size > 0) {
          e.preventDefault();
          setIsConfirmDeleteOpen(true);
        }
        return;
      }

      // Escape: batalkan mode seleksi / bersihkan pilihan
      if (e.key === "Escape") {
        if (selectionShape) {
          setSelectionShape(null);
        } else if (selectedNodeIds.size > 0 || selectedEdgeIds.size > 0) {
          handleClearSelection();
        }
        setActiveTool("select");
        setCableStartNodeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleSelectAll, handleClearSelection, completePolygonSelection, handleCopy, handlePaste, handleDuplicate, selectionShape, selectedNodeIds, selectedEdgeIds]);

  // Single Item Selection Compatibility untuk Property Inspector di bawah
  const singleSelectedNodeId = selectedNodeIds.size === 1 && selectedEdgeIds.size === 0 ? Array.from(selectedNodeIds)[0] : null;
  const selectedNode = singleSelectedNodeId ? nodes.find(n => n.id === singleSelectedNodeId) : null;

  const singleSelectedEdgeId = selectedEdgeIds.size === 1 && selectedNodeIds.size === 0 ? Array.from(selectedEdgeIds)[0] : null;
  const selectedEdge = singleSelectedEdgeId ? edges.find(e => e.id === singleSelectedEdgeId) : null;

  // Update atribut single node terpilih
  const updateSelectedNode = (attrs: Partial<SchematicNode>) => {
    if (!singleSelectedNodeId) return;
    pushState({
      ...schematic,
      nodes: nodes.map(n => n.id === singleSelectedNodeId ? { ...n, ...attrs } : n),
    });
  };

  // Update atribut single edge terpilih
  const updateSelectedEdge = (attrs: Partial<SchematicEdge>) => {
    if (!singleSelectedEdgeId) return;
    pushState({
      ...schematic,
      edges: edges.map(e => e.id === singleSelectedEdgeId ? { ...e, ...attrs } : e),
    });
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
        setCableStartNodeId(node.id);
      } else {
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
        setSelectedEdgeIds(new Set([newEdge.id]));
        setSelectedNodeIds(new Set());
      }
      return;
    }

    // Toggle jika shift key ditekan, sebaliknya ganti seleksi
    if (e.shiftKey) {
      const next = new Set(selectedNodeIds);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      setSelectedNodeIds(next);
    } else {
      setSelectedNodeIds(new Set([node.id]));
      setSelectedEdgeIds(new Set());
    }
  };

  // Drag node start (mendukung multi-node dragging sekaligus)
  const handleNodeMouseDown = (node: SchematicNode, e: React.MouseEvent) => {
    if (activeTool !== "select") return;
    e.stopPropagation();

    let nextNodes = selectedNodeIds;
    if (!selectedNodeIds.has(node.id)) {
      if (e.shiftKey) {
        nextNodes = new Set([...selectedNodeIds, node.id]);
      } else {
        nextNodes = new Set([node.id]);
        setSelectedEdgeIds(new Set());
      }
      setSelectedNodeIds(nextNodes);
    }

    setDraggingNodeId(node.id);
    const snapshot = nodes
      .filter(n => nextNodes.has(n.id))
      .map(n => ({ id: n.id, x: n.x, y: n.y }));
    setDragStartSnapshot(snapshot);
    const coords = getCanvasCoords(e);
    setDragStartCoords(coords);
  };

  const handleGarduRotateMouseDown = (node: SchematicNode, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setRotatingGarduNodeId(node.id);
    setGarduRotateCenter({
      x: node.x + (node.offsetX || 0),
      y: node.y + (node.offsetY || 0),
    });
  };

  const handleGarduOffsetMouseDown = (node: SchematicNode, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOffsettingGarduNodeId(node.id);
    const coords = getCanvasCoords(e);
    setOffsetDragStart({
      x: coords.x,
      y: coords.y,
      initX: node.offsetX || 0,
      initY: node.offsetY || 0,
    });
  };

  // Mouse move on canvas (drag nodes, panning, atau rubberband selection)
  const handleMouseMove = (e: React.MouseEvent) => {
    // Gardu on-canvas rotation dragging
    if (rotatingGarduNodeId && garduRotateCenter) {
      const coords = getCanvasCoords(e);
      const dx = coords.x - garduRotateCenter.x;
      const dy = coords.y - garduRotateCenter.y;
      const rawAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      const step = e.shiftKey ? 1 : 5;
      const snapped = Math.round(((rawAngle % 360) + 360) % 360 / step) * step % 360;
      onChange({
        ...schematic,
        nodes: nodes.map(n => n.id === rotatingGarduNodeId ? { ...n, rotationDeg: snapped } : n),
      });
      return;
    }

    // Gardu on-canvas offset dragging
    if (offsettingGarduNodeId && offsetDragStart) {
      const coords = getCanvasCoords(e);
      const dx = snap(coords.x - offsetDragStart.x);
      const dy = snap(coords.y - offsetDragStart.y);
      onChange({
        ...schematic,
        nodes: nodes.map(n => n.id === offsettingGarduNodeId ? {
          ...n,
          offsetX: Math.round(offsetDragStart.initX + dx),
          offsetY: Math.round(offsetDragStart.initY + dy),
        } : n),
      });
      return;
    }

    // Multi-node dragging
    if (draggingNodeId && dragStartSnapshot && dragStartCoords) {
      const coords = getCanvasCoords(e);
      const rawDx = coords.x - dragStartCoords.x;
      const rawDy = coords.y - dragStartCoords.y;
      const dx = snap(rawDx);
      const dy = snap(rawDy);

      onChange({
        ...schematic,
        nodes: nodes.map(n => {
          const orig = dragStartSnapshot.find(s => s.id === n.id);
          return orig ? { ...n, x: orig.x + dx, y: orig.y + dy } : n;
        }),
      });
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    // Active Selection drawing preview
    if (selectionShape) {
      const coords = getCanvasCoords(e);
      if (selectionShape.type === "rect") {
        setSelectionShape({ ...selectionShape, currentX: coords.x, currentY: coords.y });
      } else if (selectionShape.type === "circle") {
        setSelectionShape({ ...selectionShape, currentX: coords.x, currentY: coords.y });
      } else if (selectionShape.type === "lasso") {
        const last = selectionShape.points[selectionShape.points.length - 1];
        if (Math.hypot(coords.x - last.x, coords.y - last.y) > 4) {
          setSelectionShape({ ...selectionShape, points: [...selectionShape.points, coords] });
        }
      } else if (selectionShape.type === "polygon") {
        setSelectionShape({ ...selectionShape, currentPoint: coords });
      }
    }
  };

  // Drag end: commit history jika node berpindah atau seleksi selesai
  const handleMouseUp = () => {
    if (rotatingGarduNodeId) {
      pushState(schematic);
      setRotatingGarduNodeId(null);
      setGarduRotateCenter(null);
    }
    if (offsettingGarduNodeId) {
      pushState(schematic);
      setOffsettingGarduNodeId(null);
      setOffsetDragStart(null);
    }

    // Multi-node drag commit
    if (draggingNodeId && dragStartSnapshot) {
      let hasMoved = false;
      for (const snapNode of dragStartSnapshot) {
        const current = nodes.find(n => n.id === snapNode.id);
        if (current && (current.x !== snapNode.x || current.y !== snapNode.y)) {
          hasMoved = true;
          break;
        }
      }

      if (hasMoved) {
        const prevNodes = nodes.map(n => {
          const snapNode = dragStartSnapshot.find(s => s.id === n.id);
          return snapNode ? { ...n, x: snapNode.x, y: snapNode.y } : n;
        });
        setPast(prev => [...prev.slice(-49), { ...schematic, nodes: prevNodes }]);
        setFuture([]);
      }
    }

    setDraggingNodeId(null);
    setDragStartSnapshot(null);
    setDragStartCoords(null);
    setIsPanning(false);

    // Evaluasi seleksi Rectangle, Circle, atau Lasso saat mouse up
    if (selectionShape) {
      if (selectionShape.type === "rect") {
        const minX = Math.min(selectionShape.startX, selectionShape.currentX);
        const maxX = Math.max(selectionShape.startX, selectionShape.currentX);
        const minY = Math.min(selectionShape.startY, selectionShape.currentY);
        const maxY = Math.max(selectionShape.startY, selectionShape.currentY);

        if (Math.abs(maxX - minX) > 4 || Math.abs(maxY - minY) > 4) {
          const hitNodes = nodes.filter(n => isPointInRect(n, minX, maxX, minY, maxY)).map(n => n.id);
          const hitEdges = edges.filter(e => {
            const fn = nodes.find(n => n.id === e.fromNodeId);
            const tn = nodes.find(n => n.id === e.toNodeId);
            return fn && tn && isLineInRect(fn, tn, minX, maxX, minY, maxY);
          }).map(e => e.id);

          setSelectedNodeIds(new Set(hitNodes));
          setSelectedEdgeIds(new Set(hitEdges));
          hasSelectedJustFinishedRef.current = true;
        }
        setSelectionShape(null);
      } else if (selectionShape.type === "circle") {
        const r = Math.hypot(selectionShape.currentX - selectionShape.cx, selectionShape.currentY - selectionShape.cy);
        if (r > 4) {
          const hitNodes = nodes.filter(n => isPointInCircle(n, selectionShape.cx, selectionShape.cy, r)).map(n => n.id);
          const hitEdges = edges.filter(e => {
            const fn = nodes.find(n => n.id === e.fromNodeId);
            const tn = nodes.find(n => n.id === e.toNodeId);
            return fn && tn && isLineInCircle(fn, tn, selectionShape.cx, selectionShape.cy, r);
          }).map(e => e.id);

          setSelectedNodeIds(new Set(hitNodes));
          setSelectedEdgeIds(new Set(hitEdges));
          hasSelectedJustFinishedRef.current = true;
        }
        setSelectionShape(null);
      } else if (selectionShape.type === "lasso") {
        if (selectionShape.points.length >= 3) {
          const hitNodes = nodes.filter(n => pointInPolygon(n, selectionShape.points)).map(n => n.id);
          const hitEdges = edges.filter(e => {
            const fn = nodes.find(n => n.id === e.fromNodeId);
            const tn = nodes.find(n => n.id === e.toNodeId);
            return fn && tn && isLineInPolygon(fn, tn, selectionShape.points);
          }).map(e => e.id);

          setSelectedNodeIds(new Set(hitNodes));
          setSelectedEdgeIds(new Set(hitEdges));
          hasSelectedJustFinishedRef.current = true;
        }
        setSelectionShape(null);
      }
    }
  };

  // Mouse down pada canvas untuk memulai shape seleksi
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const coords = getCanvasCoords(e);

    if (activeTool === "select-rect") {
      setSelectionShape({
        type: "rect",
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y,
      });
    } else if (activeTool === "select-circle") {
      setSelectionShape({
        type: "circle",
        cx: coords.x,
        cy: coords.y,
        currentX: coords.x,
        currentY: coords.y,
      });
    } else if (activeTool === "select-lasso") {
      setSelectionShape({
        type: "lasso",
        points: [coords],
      });
    }
  };

  // Handler klik pada kanvas (tambah node, clear selection, atau polygon vertex)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isPanning) return;

    // Abaikan klik jika baru saja menyelesaikan drag seleksi (lasso/rect/circle)
    if (hasSelectedJustFinishedRef.current) {
      hasSelectedJustFinishedRef.current = false;
      return;
    }

    const coords = getCanvasCoords(e);

    // Mode Polygon: klik tiap sudut, klik dekat titik awal untuk menutup
    if (activeTool === "select-polygon") {
      if (!selectionShape || selectionShape.type !== "polygon") {
        setSelectionShape({
          type: "polygon",
          points: [coords],
          currentPoint: coords,
        });
      } else {
        const first = selectionShape.points[0];
        const dist = Math.hypot(coords.x - first.x, coords.y - first.y);
        if (dist < 15 && selectionShape.points.length >= 3) {
          completePolygonSelection(selectionShape.points);
        } else {
          setSelectionShape({
            type: "polygon",
            points: [...selectionShape.points, coords],
            currentPoint: coords,
          });
        }
      }
      return;
    }

    // Jika mode select pointer / tool seleksi lainnya diklik tanpa drag, bersihkan seleksi
    if (activeTool === "select" || activeTool === "select-rect" || activeTool === "select-circle" || activeTool === "select-lasso") {
      setSelectedNodeIds(new Set());
      setSelectedEdgeIds(new Set());
      setCableStartNodeId(null);
      return;
    }

    // Jika tool kabel, klik kanvas kosong membatalkan penarikan kabel
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
    const snappedX = snap(coords.x);
    const snappedY = snap(coords.y);

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
        label: "Gardu Cantol 100kVA",
        garduJenis: "Cantol",
        trafoKva: 100,
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
    setSelectedNodeIds(new Set([newNodeId]));
    setSelectedEdgeIds(new Set());
  };

  // Handler klik ganda pada canvas untuk menyelesaikan polygon
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (activeTool === "select-polygon" && selectionShape?.type === "polygon") {
      e.stopPropagation();
      completePolygonSelection(selectionShape.points);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white select-none">
      {/* ─── Toolbar Atas Kanvas ─── */}
      {!isPrinting && (
        <div className="bg-slate-900 border-b border-slate-800 p-2 flex items-center justify-between gap-2 z-10 flex-wrap">
          {/* Tool Palette */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* ── Group Tool Seleksi Multi (ArcGIS style) ── */}
            <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => { setActiveTool("select"); setCableStartNodeId(null); setSelectionShape(null); }}
                className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                  activeTool === "select" ? "bg-blue-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                }`}
                title="Pilih & Pindah Simbol (Klik & Geser)"
              >
                <span>👆</span>
                <span className="hidden xl:inline">Pilih</span>
              </button>

              <button
                onClick={() => { setActiveTool("select-rect"); setCableStartNodeId(null); setSelectionShape(null); }}
                className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                  activeTool === "select-rect" ? "bg-cyan-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                }`}
                title="Rectangle Select: Klik & drag membentuk kotak seleksi"
              >
                <span>⬚</span>
                <span className="hidden xl:inline">Kotak</span>
              </button>

              <button
                onClick={() => { setActiveTool("select-polygon"); setCableStartNodeId(null); setSelectionShape(null); }}
                className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                  activeTool === "select-polygon" ? "bg-cyan-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                }`}
                title="Polygon Select: Klik beberapa titik, klik ganda atau Enter untuk menutup"
              >
                <span>⬡</span>
                <span className="hidden xl:inline">Poligon</span>
              </button>

              <button
                onClick={() => { setActiveTool("select-lasso"); setCableStartNodeId(null); setSelectionShape(null); }}
                className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                  activeTool === "select-lasso" ? "bg-cyan-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                }`}
                title="Lasso Select: Klik tahan dan gerakkan bebas (freehand)"
              >
                <span>➰</span>
                <span className="hidden xl:inline">Lasso</span>
              </button>

              <button
                onClick={() => { setActiveTool("select-circle"); setCableStartNodeId(null); setSelectionShape(null); }}
                className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                  activeTool === "select-circle" ? "bg-cyan-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                }`}
                title="Circle Select: Klik titik pusat dan drag untuk radius lingkaran"
              >
                <span>◯</span>
                <span className="hidden xl:inline">Lingkaran</span>
              </button>
            </div>

            {/* Tombol Select All & Clear */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleSelectAll}
                className="px-2 py-1 rounded text-xs font-bold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
                title="Pilih Semua Item (Ctrl+A)"
              >
                Semua
              </button>
              {totalSelectedCount > 0 && (
                <button
                  onClick={handleClearSelection}
                  className="px-2 py-1 rounded text-xs font-bold bg-slate-800 text-amber-400 hover:text-amber-300 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
                  title="Batal Seleksi (Esc)"
                >
                  Batal
                </button>
              )}
            </div>

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
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleCanvasClick}
          onDoubleClick={handleCanvasDoubleClick}
        >
          {/* Petunjuk aktif */}
          {!isPrinting && (
            <div className="absolute top-2 left-2 z-10 pointer-events-none bg-slate-900/85 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-lg shadow border border-slate-700/60 font-medium max-w-md">
              {cableStartNodeId ? (
                <span className="text-amber-300 font-bold animate-pulse">
                  ⚡ Klik tiang/gardu tujuan untuk menyambungkan kabel...
                </span>
              ) : activeTool === "select-rect" ? (
                <span className="text-cyan-300 font-semibold">
                  ⬚ Mode Kotak: Klik & seret untuk memilih area kotak persegi.
                </span>
              ) : activeTool === "select-polygon" ? (
                <span className="text-cyan-300 font-semibold">
                  ⬡ Mode Poligon: Klik titik-titik sudut. Klik titik awal, dobel-klik, atau tekan [Enter] untuk menutup area.
                </span>
              ) : activeTool === "select-lasso" ? (
                <span className="text-cyan-300 font-semibold">
                  ➰ Mode Lasso: Klik tahan & gerakkan bebas mengelilingi simbol dan kabel yang ingin dipilih.
                </span>
              ) : activeTool === "select-circle" ? (
                <span className="text-cyan-300 font-semibold">
                  ◯ Mode Lingkaran: Klik titik pusat dan seret keluar untuk menentukan radius seleksi.
                </span>
              ) : activeTool === "select" ? (
                <span>
                  Mode Pilih: Klik simbol/kabel untuk pilih. [Shift]: multi-pilih. [Ctrl+C]/[Ctrl+V]: Salin, [Ctrl+D]: Duplikat, [Del]: Hapus, [Ctrl+A]: Semua.
                </span>
              ) : (
                <span>Mode Tambah: Klik di area gambar untuk meletakkan simbol.</span>
              )}
            </div>
          )}

          {/* Toast Notifikasi Clipboard */}
          {clipboardNotice && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 text-cyan-300 border border-cyan-500/50 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>{clipboardNotice}</span>
            </div>
          )}

          {/* ─── Floating Selection Info & Action Panel ─── */}
          {!isPrinting && totalSelectedCount > 0 && (
            <div className="absolute top-3 right-3 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 shadow-2xl text-white max-w-sm w-80 animate-in fade-in slide-in-from-top-2">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="font-extrabold text-xs text-cyan-300 uppercase tracking-wide">
                    {totalSelectedCount} Item Terpilih
                  </span>
                </div>
                <button
                  onClick={handleClearSelection}
                  className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
                  title="Batal Seleksi (Esc)"
                >
                  ✕
                </button>
              </div>

              {/* Breakdown Badges */}
              <div className="flex items-center gap-1.5 flex-wrap py-2 border-b border-slate-800/80 text-[11px]">
                {breakdown.tiangCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                    {breakdown.tiangCount} Tiang
                  </span>
                )}
                {breakdown.garduCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40">
                    {breakdown.garduCount} Gardu
                  </span>
                )}
                {breakdown.schoorCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold border border-red-500/40">
                    {breakdown.schoorCount} Penopang
                  </span>
                )}
                {breakdown.boxCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/40">
                    {breakdown.boxCount} Box APP
                  </span>
                )}
                {breakdown.cableCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40">
                    {breakdown.cableCount} Kabel ({breakdown.cableTotalM} m)
                  </span>
                )}
              </div>

              {/* Subset RAB Estimation */}
              <div className="py-2.5 flex items-center justify-between bg-slate-950/70 rounded-lg px-2.5 my-2 border border-slate-800">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-medium">Estimasi RAB Terpilih:</span>
                  <span className="text-sm font-black text-emerald-400 font-mono tracking-tight">
                    {formatRupiah(selectedRabTotal)}
                  </span>
                </div>
                <span className="text-xl">📊</span>
              </div>

              {/* Bulk Actions Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => setIsBulkEditOpen(true)}
                  className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                >
                  <span>✏️</span>
                  <span>Edit Massal</span>
                </button>
                <button
                  onClick={handleDuplicate}
                  className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                  title="Duplikat Terpilih (Ctrl+D)"
                >
                  <span>📋</span>
                  <span>Duplikat</span>
                </button>
                <button
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="py-1.5 px-3 bg-red-600/90 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                  title="Hapus Terpilih (Del)"
                >
                  <span>🗑️</span>
                  <span>Hapus</span>
                </button>
              </div>
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

                const isSelected = selectedEdgeIds.has(edge.id);
                const isExist = edge.type === "kabel-existing";
                const cableStyle = getCableStyle(edge.jenisJaringan || "SUTM", isExist);

                const strokeColor = isSelected ? "#0284c7" : cableStyle.stroke;
                const strokeWidth = isSelected ? 4.5 : cableStyle.strokeWidth;
                const strokeDasharray = cableStyle.strokeDasharray;

                const midX = (fromNode.x + toNode.x) / 2;
                const midY = (fromNode.y + toNode.y) / 2;

                return (
                  <g
                    key={edge.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.shiftKey) {
                        const next = new Set(selectedEdgeIds);
                        if (next.has(edge.id)) {
                          next.delete(edge.id);
                        } else {
                          next.add(edge.id);
                        }
                        setSelectedEdgeIds(next);
                      } else {
                        setSelectedEdgeIds(new Set([edge.id]));
                        setSelectedNodeIds(new Set());
                      }
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

                    {/* Outer Glow Outline for Selected Cable */}
                    {isSelected && (
                      <line
                        x1={fromNode.x}
                        y1={fromNode.y}
                        x2={toNode.x}
                        y2={toNode.y}
                        stroke="#38bdf8"
                        strokeWidth={7}
                        opacity={0.6}
                        strokeLinecap="round"
                      />
                    )}

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
                        stroke={isSelected ? "#0284c7" : "#CBD5E1"}
                        strokeWidth={isSelected ? 1.8 : 1}
                        className="shadow-xs"
                      />
                      <text
                        x={0}
                        y={3.5}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="900"
                        fill={isSelected ? "#0284c7" : "#1D4ED8"}
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
                const isSelected = selectedNodeIds.has(node.id);
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
                    {/* Visual Highlight Outline / Glow */}
                    {(isSelected || isCableStart) && (
                      <>
                        <circle
                          r={16}
                          fill={isCableStart ? "rgba(239, 68, 68, 0.2)" : "rgba(14, 165, 233, 0.2)"}
                          stroke={isCableStart ? "#EF4444" : "#0284c7"}
                          strokeWidth={2}
                          strokeDasharray={isCableStart ? "3,2" : undefined}
                        />
                        {/* Checkmark Badge for Selected Item */}
                        {isSelected && (
                          <g transform="translate(10, -10)">
                            <circle r={6.5} fill="#0284c7" stroke="#ffffff" strokeWidth={1.5} />
                            <path
                              d="M-3.5 0 L-1 2.5 L3.5 -2"
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </g>
                        )}
                      </>
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
                        rotationDeg: node.rotationDeg || 0,
                        offsetX: node.offsetX || 0,
                        offsetY: node.offsetY || 0,
                        isSelected,
                        showHandles: isSelected,
                        onRotateMouseDown: (e) => handleGarduRotateMouseDown(node, e),
                        onOffsetMouseDown: (e) => handleGarduOffsetMouseDown(node, e),
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

              {/* ─── Render Area Seleksi Sementara (Preview Rubberband) ─── */}
              {selectionShape && (
                <g className="pointer-events-none select-none">
                  {selectionShape.type === "rect" && (
                    <rect
                      x={Math.min(selectionShape.startX, selectionShape.currentX)}
                      y={Math.min(selectionShape.startY, selectionShape.currentY)}
                      width={Math.abs(selectionShape.currentX - selectionShape.startX)}
                      height={Math.abs(selectionShape.currentY - selectionShape.startY)}
                      fill="rgba(2, 132, 199, 0.18)"
                      stroke="#0284c7"
                      strokeWidth={1.5 / zoom}
                      strokeDasharray="4,3"
                    />
                  )}

                  {selectionShape.type === "circle" && (
                    <circle
                      cx={selectionShape.cx}
                      cy={selectionShape.cy}
                      r={Math.hypot(selectionShape.currentX - selectionShape.cx, selectionShape.currentY - selectionShape.cy)}
                      fill="rgba(2, 132, 199, 0.18)"
                      stroke="#0284c7"
                      strokeWidth={1.5 / zoom}
                      strokeDasharray="4,3"
                    />
                  )}

                  {selectionShape.type === "lasso" && selectionShape.points.length >= 2 && (
                    <polygon
                      points={selectionShape.points.map(p => `${p.x},${p.y}`).join(" ")}
                      fill="rgba(2, 132, 199, 0.18)"
                      stroke="#0284c7"
                      strokeWidth={1.5 / zoom}
                      strokeDasharray="4,3"
                    />
                  )}

                  {selectionShape.type === "polygon" && selectionShape.points.length > 0 && (
                    <>
                      {/* Polygon fill preview jika sudah >= 3 titik */}
                      {selectionShape.points.length >= 3 && (
                        <polygon
                          points={selectionShape.points.map(p => `${p.x},${p.y}`).join(" ")}
                          fill="rgba(2, 132, 199, 0.14)"
                          stroke="#0284c7"
                          strokeWidth={1.2 / zoom}
                          strokeDasharray="4,3"
                        />
                      )}

                      {/* Garis segmen polygon yang sudah ditarik */}
                      <polyline
                        points={selectionShape.points.map(p => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth={1.8 / zoom}
                      />

                      {/* Garis rubberband ke posisi kursor saat ini */}
                      {selectionShape.currentPoint && (
                        <line
                          x1={selectionShape.points[selectionShape.points.length - 1].x}
                          y1={selectionShape.points[selectionShape.points.length - 1].y}
                          x2={selectionShape.currentPoint.x}
                          y2={selectionShape.currentPoint.y}
                          stroke="#0284c7"
                          strokeWidth={1.5 / zoom}
                          strokeDasharray="3,3"
                        />
                      )}

                      {/* Vertex Handles */}
                      {selectionShape.points.map((pt, idx) => (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          r={idx === 0 ? 5 / zoom : 3.5 / zoom}
                          fill={idx === 0 ? "#22c55e" : "#0284c7"}
                          stroke="#ffffff"
                          strokeWidth={1.5 / zoom}
                        />
                      ))}
                    </>
                  )}
                </g>
              )}
            </g>
          </svg>
        </div>

        {/* ─── Bottom Property Inspector Panel (Single Item Selected) ─── */}
        {!isPrinting && (selectedNode || selectedEdge) && totalSelectedCount === 1 && (
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
                        onChange={(e) => {
                          const newJenis = e.target.value as any;
                          const curKva = selectedNode.trafoKva || 100;
                          const newKva = newJenis === "Cantol" && curKva > CANTOL_MAX_KVA ? 100 : curKva;
                          updateSelectedNode({ garduJenis: newJenis, trafoKva: newKva });
                        }}
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
                        {getValidTrafoOptions(selectedNode.garduJenis || "Portal").map((opt) => {
                          const kvaNum = parseKva(opt);
                          return (
                            <option key={opt} value={kvaNum}>
                              {kvaNum} kVA {kvaNum === 100 ? "(Standar)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 font-bold ml-1">Rot:</span>
                      <input
                        type="number"
                        min={0}
                        max={360}
                        step={15}
                        value={Math.round(selectedNode.rotationDeg || 0)}
                        onChange={(e) => updateSelectedNode({ rotationDeg: parseInt(e.target.value) || 0 })}
                        className="w-14 px-1 py-0.5 border border-slate-300 rounded font-mono font-bold text-xs"
                      />
                      <span className="text-slate-500 font-bold">°</span>
                      <button
                        type="button"
                        onClick={() => updateSelectedNode({ rotationDeg: 0 })}
                        className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 rounded"
                        title="Set 0° (Horizontal)"
                      >
                        0°
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedNode({ rotationDeg: 90 })}
                        className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 rounded"
                        title="Set 90° (Vertikal)"
                      >
                        90°
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 font-bold ml-1">Offset:</span>
                      <span className="text-[10px] text-slate-400">X</span>
                      <input
                        type="number"
                        value={selectedNode.offsetX || 0}
                        onChange={(e) => updateSelectedNode({ offsetX: parseInt(e.target.value) || 0 })}
                        className="w-12 px-1 py-0.5 border border-slate-300 rounded font-mono font-bold text-xs"
                      />
                      <span className="text-[10px] text-slate-400">Y</span>
                      <input
                        type="number"
                        value={selectedNode.offsetY || 0}
                        onChange={(e) => updateSelectedNode({ offsetY: parseInt(e.target.value) || 0 })}
                        className="w-12 px-1 py-0.5 border border-slate-300 rounded font-mono font-bold text-xs"
                      />
                      {(selectedNode.offsetX || selectedNode.offsetY) ? (
                        <button
                          type="button"
                          onClick={() => updateSelectedNode({ offsetX: 0, offsetY: 0 })}
                          className="px-1.5 py-0.5 text-[10px] font-bold text-purple-700 hover:bg-purple-100 rounded"
                          title="Reset ke titik pusat tiang"
                        >
                          Reset
                        </button>
                      ) : null}
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
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition cursor-pointer"
              >
                Hapus
              </button>
              <button
                onClick={handleClearSelection}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-300 transition cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modal Konfirmasi Bulk Delete ─── */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl mx-auto mb-3 font-bold">
              ⚠️
            </div>
            <h3 className="text-base font-black text-slate-900 text-center mb-1">
              Hapus {totalSelectedCount} Item Terpilih?
            </h3>
            <p className="text-xs text-slate-600 text-center mb-4 leading-relaxed">
              {selectedNodes.length > 0 && <span>{selectedNodes.length} simbol</span>}
              {selectedNodes.length > 0 && selectedEdges.length > 0 && <span> dan </span>}
              {selectedEdges.length > 0 && <span>{selectedEdges.length} segmen kabel</span>}
              {" akan dihapus dari kanvas skematik. Aksi ini dapat di-Undo (Ctrl+Z) dalam 1 langkah."}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteBulkDelete}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition cursor-pointer shadow-md"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Bulk Edit Atribut ─── */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">✏️</span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Edit Atribut Massal</h3>
                  <p className="text-[11px] text-slate-500">{totalSelectedCount} item terpilih akan diperbarui sekaligus</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkEditOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Form Atribut Tiang (jika ada tiang terselect) */}
              {breakdown.tiangCount > 0 && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900 uppercase tracking-tight flex items-center gap-1.5">
                      <span>🏷️</span> Atribut Tiang ({breakdown.tiangCount} item)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Material Tiang:</label>
                      <select
                        value={bulkForm.materialTiang}
                        onChange={(e) => setBulkForm({ ...bulkForm, materialTiang: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium outline-none"
                      >
                        <option value="">(Biarkan Tidak Diubah)</option>
                        <option value="Beton">Tiang Beton</option>
                        <option value="Baja">Tiang Baja</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Tinggi Tiang:</label>
                      <select
                        value={bulkForm.tinggiTiang}
                        onChange={(e) => setBulkForm({ ...bulkForm, tinggiTiang: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium outline-none"
                      >
                        <option value="">(Biarkan Tidak Diubah)</option>
                        <option value="9">9 Meter (JTR Standar)</option>
                        <option value="11">11 Meter</option>
                        <option value="12">12 Meter (JTM Standar)</option>
                        <option value="13">13 Meter</option>
                        <option value="14">14 Meter (JTM Trafo)</option>
                        <option value="7">7 Meter</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Kekuatan (daN):</label>
                      <select
                        value={bulkForm.kekuatanTiang}
                        onChange={(e) => setBulkForm({ ...bulkForm, kekuatanTiang: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium outline-none"
                      >
                        <option value="">(Biarkan Tidak Diubah)</option>
                        <option value="200">200 daN (Tumpu)</option>
                        <option value="350">350 daN (Sudut/Trafo)</option>
                        <option value="100">100 daN</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Posisi Tiang:</label>
                      <select
                        value={bulkForm.posisiTiang}
                        onChange={(e) => setBulkForm({ ...bulkForm, posisiTiang: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium outline-none"
                      >
                        <option value="">(Biarkan Tidak Diubah)</option>
                        <option value="Tumpu">Tumpu</option>
                        <option value="Sudut">Sudut</option>
                        <option value="Awal">Awal</option>
                        <option value="Akhir">Akhir</option>
                        <option value="Penegang">Penegang</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Atribut Gardu (jika ada gardu terselect) */}
              {breakdown.garduCount > 0 && (
                <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3 space-y-2.5">
                  <span className="text-xs font-black text-purple-900 uppercase tracking-tight flex items-center gap-1.5">
                    <span>⚡</span> Atribut Gardu ({breakdown.garduCount} item)
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Jenis Gardu:</label>
                      <select
                        value={bulkForm.garduJenis}
                        onChange={(e) => setBulkForm({ ...bulkForm, garduJenis: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-medium outline-none"
                      >
                        <option value="">(Biarkan Tidak Diubah)</option>
                        <option value="Portal">Portal (2 Tiang)</option>
                        <option value="Cantol">Cantol (1 Tiang)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Kapasitas Trafo:</label>
                      <select
                        value={bulkForm.trafoKva}
                        onChange={(e) => setBulkForm({ ...bulkForm, trafoKva: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-medium outline-none"
                      >
                        <option value="">(Biarkan Tidak Diubah)</option>
                        <option value="25">25 kVA</option>
                        <option value="50">50 kVA</option>
                        <option value="100">100 kVA (Standar)</option>
                        <option value="160">160 kVA</option>
                        <option value="200">200 kVA</option>
                        <option value="250">250 kVA</option>
                        <option value="400">400 kVA</option>
                        <option value="630">630 kVA</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Atribut Kabel (jika ada kabel terselect) */}
              {breakdown.cableCount > 0 && (
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 space-y-2.5">
                  <span className="text-xs font-black text-blue-900 uppercase tracking-tight flex items-center gap-1.5">
                    <span>🔌</span> Atribut Kabel ({breakdown.cableCount} segmen)
                  </span>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Jaringan:</label>
                      <select
                        value={bulkForm.jenisJaringan}
                        onChange={(e) => setBulkForm({ ...bulkForm, jenisJaringan: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-medium outline-none"
                      >
                        <option value="">(Tidak Diubah)</option>
                        <option value="SUTM">SUTM (Saluran Udara TM)</option>
                        <option value="SKUTR">SKUTR (Saluran Kabel Udara TR)</option>
                        <option value="SKUTM">SKUTM (Kabel Udara TM / MVTIC)</option>
                        <option value="SKTM">SKTM (Kabel Tanah TM)</option>
                        <option value="SKTR">SKTR (Kabel Tanah TR)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Konduktor:</label>
                      <select
                        value={bulkForm.konduktorJenis}
                        onChange={(e) => setBulkForm({ ...bulkForm, konduktorJenis: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-medium outline-none"
                      >
                        <option value="">(Tidak Diubah)</option>
                        <option value="AAAC/S">AAAC/S</option>
                        <option value="AAAC">AAAC</option>
                        <option value="MVTIC">MVTIC</option>
                        <option value="NA2XSEYBY">NA2XSEYBY</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Ukuran:</label>
                      <select
                        value={bulkForm.kondukturUkuran}
                        onChange={(e) => setBulkForm({ ...bulkForm, kondukturUkuran: e.target.value })}
                        className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-medium outline-none"
                      >
                        <option value="">(Tidak Diubah)</option>
                        <option value="70">70 mm²</option>
                        <option value="150">150 mm²</option>
                        <option value="240">240 mm²</option>
                        <option value="50">50 mm²</option>
                        <option value="95">95 mm²</option>
                        <option value="120">120 mm²</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-200">
              <button
                onClick={() => setIsBulkEditOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteBulkEdit}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer shadow-md"
              >
                Terapkan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
