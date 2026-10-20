"use client";

import React, { useMemo } from "react";
import type { SchematicData, SchematicObstacle } from "../../../types/schematic";
import {
  SPARK_ASSET_COLORS,
  renderPoleSvg,
  renderGarduSvg,
  renderSchoorSvg,
  renderBoxAppSvg,
  getCableStyle,
} from "../../../lib/assetStyles";

interface Props {
  schematic: SchematicData;
  className?: string;
}

function adjustColorBrightness(hex: string, percent: number): string {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6) return hex;
  const num = parseInt(cleanHex, 16);
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function getRoofColors(baseColor: string) {
  return {
    top: adjustColorBrightness(baseColor, 12),
    bottom: adjustColorBrightness(baseColor, -22),
    left: adjustColorBrightness(baseColor, -6),
    right: adjustColorBrightness(baseColor, -14),
    border: adjustColorBrightness(baseColor, -40),
  };
}

/**
 * Area Gambar Vektor Beresolusi Tinggi untuk Export Gambar Survei A2.
 * Menghitung otomatis bounding box elemen kanvas dan memusatkannya secara proporsional.
 */
export default function SurveyDrawingCanvas({ schematic, className = "" }: Props) {
  const { nodes = [], edges = [], obstacles = [] } = schematic;

  // Hitung bounding box agar seluruh gambar muat dan terpusat di Area Gambar
  const viewBox = useMemo(() => {
    if (nodes.length === 0 && obstacles.length === 0) {
      return "0 0 1000 600";
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach(n => {
      minX = Math.min(minX, n.x - 40);
      maxX = Math.max(maxX, n.x + 40);
      minY = Math.min(minY, n.y - 40);
      maxY = Math.max(maxY, n.y + 40);
    });

    obstacles.forEach(o => {
      if (o.obstacleType === "building") {
        const w = (o.width || 80) / 2 + 20;
        const h = (o.height || 50) / 2 + 20;
        minX = Math.min(minX, o.x - w);
        maxX = Math.max(maxX, o.x + w);
        minY = Math.min(minY, o.y - h);
        maxY = Math.max(maxY, o.y + h);
      } else if (o.points && o.points.length > 0) {
        o.points.forEach(p => {
          minX = Math.min(minX, p.x - 30);
          maxX = Math.max(maxX, p.x + 30);
          minY = Math.min(minY, p.y - 30);
          maxY = Math.max(maxY, p.y + 30);
        });
      }
    });

    // Tambahkan margin padding 50px di sekeliling
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const w = Math.max(300, maxX - minX);
    const h = Math.max(200, maxY - minY);

    return `${minX} ${minY} ${w} ${h}`;
  }, [nodes, obstacles]);

  // Render Obstacle: Building
  const renderBuilding = (obs: SchematicObstacle) => {
    const w = obs.width || 80;
    const h = obs.height || 50;
    const rot = obs.rotationDeg || 0;
    const baseColor = obs.color || "#ea580c";
    const colors = getRoofColors(baseColor);
    const ridgeInset = Math.min(18, w * 0.22);

    return (
      <g key={obs.id} transform={`translate(${obs.x}, ${obs.y}) rotate(${rot})`}>
        {/* Drop shadow */}
        <rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          rx={3}
          fill="rgba(0,0,0,0.12)"
          transform="translate(0, 3)"
        />
        {/* Atap 4 sisi */}
        <polygon points={`${-w / 2},${-h / 2} ${w / 2},${-h / 2} ${w / 2 - ridgeInset},0 ${-w / 2 + ridgeInset},0`} fill={colors.top} />
        <polygon points={`${-w / 2 + ridgeInset},0 ${w / 2 - ridgeInset},0 ${w / 2},${h / 2} ${-w / 2},${h / 2}`} fill={colors.bottom} />
        <polygon points={`${-w / 2},${-h / 2} ${-w / 2 + ridgeInset},0 ${-w / 2},${h / 2}`} fill={colors.left} />
        <polygon points={`${w / 2},${-h / 2} ${w / 2},${h / 2} ${w / 2 - ridgeInset},0`} fill={colors.right} />
        {/* Bubungan */}
        <line x1={-w / 2 + ridgeInset} y1={0} x2={w / 2 - ridgeInset} y2={0} stroke="#ffffff" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
        {/* Lis Atap */}
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2} fill="none" stroke={colors.border} strokeWidth={1.4} />

        {/* Label Bangunan */}
        {obs.label && (
          <g>
            <rect
              x={-(obs.label.length * 3.2 + 6)}
              y={-7}
              width={obs.label.length * 6.4 + 12}
              height={14}
              rx={3}
              fill="rgba(255, 255, 255, 0.94)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={0.8}
            />
            <text x={0} y={3} textAnchor="middle" fontSize={8} fontWeight={800} fill="#0f172a">
              {obs.label}
            </text>
          </g>
        )}
      </g>
    );
  };

  // Render Obstacle: Road / Alley
  const renderRoad = (obs: SchematicObstacle) => {
    const pts = obs.points || [];
    if (pts.length < 2) return null;
    const pathD = pts.reduce((acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
    const isHighway = obs.obstacleType === "road";
    const roadW = obs.roadWidth || (isHighway ? 24 : 10);

    const midIdx = Math.floor((pts.length - 1) / 2);
    const pA = pts[midIdx];
    const pB = pts[midIdx + 1] || pA;
    const midX = (pA.x + pB.x) / 2;
    const midY = (pA.y + pB.y) / 2;

    return (
      <g key={obs.id}>
        {/* Asphalt base */}
        <path
          d={pathD}
          fill="none"
          stroke={isHighway ? "#334155" : "#94a3b8"}
          strokeWidth={roadW}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Marka Jalan Tengah */}
        {isHighway && (
          <path
            d={pathD}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={1.8}
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        )}
        {/* Marka Gang */}
        {!isHighway && (
          <path
            d={pathD}
            fill="none"
            stroke="#ffffff"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {/* Label Jalan */}
        {obs.label && (
          <g transform={`translate(${midX}, ${midY})`}>
            <rect
              x={-(obs.label.length * 3.2 + 6)}
              y={-7}
              width={obs.label.length * 6.4 + 12}
              height={14}
              rx={3}
              fill="rgba(255, 255, 255, 0.94)"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={0.8}
            />
            <text x={0} y={3} textAnchor="middle" fontSize={8} fontWeight={800} fill="#0f172a">
              {obs.label}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className={`w-full h-full bg-white relative overflow-hidden select-none ${className}`}>
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full block bg-white"
      >
        {/* Layer 1: Obstacles (Roads & Alleys) */}
        <g id="export-roads">
          {obstacles.filter(o => o.obstacleType === "road" || o.obstacleType === "alley").map(renderRoad)}
        </g>

        {/* Layer 2: Obstacles (Buildings) */}
        <g id="export-buildings">
          {obstacles.filter(o => o.obstacleType === "building").map(renderBuilding)}
        </g>

        {/* Layer 3: Edges (Kabel & Konduktor) */}
        <g id="export-edges">
          {edges.map(edge => {
            const from = nodes.find(n => n.id === edge.fromNodeId);
            const to = nodes.find(n => n.id === edge.toNodeId);
            if (!from || !to) return null;

            const isExist = edge.type === "kabel-existing";
            const cableStyle = getCableStyle(edge.jenisJaringan || "SUTM", isExist);

            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;

            return (
              <g key={edge.id}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={cableStyle.stroke}
                  strokeWidth={cableStyle.strokeWidth || 3}
                  strokeDasharray={cableStyle.strokeDasharray}
                  strokeLinecap="round"
                />

                {/* Badge Panjang Kabel / Label */}
                {edge.lengthM > 0 && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-16}
                      y={-7}
                      width={32}
                      height={14}
                      rx={3}
                      fill="#ffffff"
                      stroke={cableStyle.stroke}
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      fontSize={8}
                      fontWeight={800}
                      fill="#0f172a"
                      fontFamily="system-ui, sans-serif"
                    >
                      {edge.lengthM}m
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Layer 4: Nodes (Poles, Gardu, Schoor, Box APP) */}
        <g id="export-nodes">
          {nodes.map(node => {
            const isExist = node.type === "tiang-existing";
            const isLast = node.posisiTiang === "Ujung";

            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                {/* 1. Tiang */}
                {(node.type.startsWith("tiang") || !node.type) && (
                  renderPoleSvg({
                    material: node.materialTiang || "Beton",
                    status: isExist ? "Existing" : "Rencana",
                    isExisting: isExist,
                    isLast,
                    size: 17,
                  })
                )}

                {/* 2. Gardu */}
                {node.type === "gardu" && (
                  renderGarduSvg({
                    jenis: node.garduJenis || "Portal",
                    rotationDeg: node.rotationDeg || 0,
                    offsetX: node.offsetX || 0,
                    offsetY: node.offsetY || 0,
                    trafoKva: node.trafoKva || 100,
                    renderMainPole: true,
                  })
                )}

                {/* 3. Schoor / Penopang */}
                {node.schoor && (
                  renderSchoorSvg({
                    jenis: node.schoor.jenis,
                    tipe: node.schoor.tipe,
                    rot: node.schoor.rotation || 0,
                  })
                )}
                {node.type === "treck-schoor" && (
                  renderSchoorSvg({ jenis: "Treck", tipe: "Standar", rot: node.rotationDeg || 0 })
                )}
                {node.type === "druck-schoor" && (
                  renderSchoorSvg({ jenis: "Druck", rot: node.rotationDeg || 0 })
                )}
                {node.type === "kontramast" && (
                  renderSchoorSvg({ jenis: "Kontramast", rot: node.rotationDeg || 0 })
                )}

                {/* 4. Box APP */}
                {node.type === "box-app" && (
                  renderBoxAppSvg({ boxKva: node.boxKva || 197, size: 18 })
                )}

                {/* Label Node (e.g. "T.01") */}
                {node.label && (
                  <g transform="translate(0, -14)">
                    <rect
                      x={-(node.label.length * 3.5 + 4)}
                      y={-6}
                      width={node.label.length * 7 + 8}
                      height={12}
                      rx={2}
                      fill="#ffffff"
                      stroke="#0f172a"
                      strokeWidth={0.8}
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      fontSize={8}
                      fontWeight={900}
                      fill="#0f172a"
                    >
                      {node.label}
                    </text>
                  </g>
                )}

                {/* Konstruksi spec (e.g. "A1 - 12m/200daN") */}
                {node.konstruksi && (
                  <text
                    x={0}
                    y={16}
                    textAnchor="middle"
                    fontSize={7}
                    fontWeight={700}
                    fill="#334155"
                  >
                    {node.konstruksi}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
