import React, { useMemo } from "react";
import type {
  SchematicData,
  SchematicObstacle,
  SchematicNode,
  SchematicEdge,
} from "../../../types/schematic";
import type { PageBoundary, ContinuationCallout } from "../../../lib/schematic/paginationEngine";
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
  pageBoundary?: PageBoundary;
  continuationCallouts?: ContinuationCallout[];
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
 * Menghitung otomatis bounding box atau menggunakan PageBoundary saat paginasi aktif.
 */
export default function SurveyDrawingCanvas({
  schematic,
  className = "",
  pageBoundary,
  continuationCallouts = [],
}: Props) {
  const { nodes = [], edges = [], obstacles = [] } = schematic;

  // Hitung bounding box agar gambar terpusat, atau gunakan batas halaman jika paginasi
  const viewBox = useMemo(() => {
    if (pageBoundary) {
      return `${pageBoundary.x} ${pageBoundary.y} ${pageBoundary.width} ${pageBoundary.height}`;
    }

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

  // Filter aset yang relevan untuk halaman ini jika paginasi aktif
  const visibleNodes = useMemo(() => {
    if (!pageBoundary) return nodes;
    return nodes.filter(
      (n) => pageBoundary.nodeIds.includes(n.id) || pageBoundary.referenceNodeIds.includes(n.id)
    );
  }, [nodes, pageBoundary]);

  const visibleEdges = useMemo(() => {
    if (!pageBoundary) return edges;
    return edges.filter((e) => pageBoundary.edgeIds.includes(e.id));
  }, [edges, pageBoundary]);

  const visibleObstacles = useMemo(() => {
    if (!pageBoundary) return obstacles;
    return obstacles.filter((o) => pageBoundary.obstacleIds.includes(o.id));
  }, [obstacles, pageBoundary]);

  // Jarak antar tiang terkecil untuk penskalaan visual konsisten (Task 1)
  const minPoleDist = useMemo(() => {
    let minD = Infinity;
    visibleEdges.forEach((e) => {
      const u = nodes.find((n) => n.id === e.fromNodeId);
      const v = nodes.find((n) => n.id === e.toNodeId);
      if (u && v) {
        const d = Math.hypot(v.x - u.x, v.y - u.y);
        if (d > 2) minD = Math.min(minD, d);
      }
    });
    return minD === Infinity ? 150 : minD;
  }, [nodes, visibleEdges]);

  // Faktor skala visual konsisten: simbol, font, dan garis mengecil proporsional
  const visualScale = useMemo(() => {
    if (minPoleDist >= 90) return 1.0;
    if (minPoleDist <= 30) return 0.65;
    return +(0.65 + (minPoleDist - 30) * (0.35 / 60)).toFixed(2);
  }, [minPoleDist]);

  const poleSize = Math.round(17 * visualScale);
  const poleRadius = poleSize / 2;
  const baseFontSize = Math.max(6.5, +(8 * visualScale).toFixed(1));
  const spanBadgeW = Math.max(26, Math.round(34 * visualScale));
  const spanBadgeH = Math.max(11, Math.round(14 * visualScale));

  // Layout label bentang kabel (Task 2: di atas / di bawah kabel, sejajar arah kabel, prioritas tinggi)
  const spanLabels = useMemo(() => {
    return visibleEdges
      .filter((e) => e.lengthM > 0)
      .map((edge) => {
        const from = nodes.find((n) => n.id === edge.fromNodeId);
        const to = nodes.find((n) => n.id === edge.toNodeId);
        if (!from || !to) return null;

        const isExist = edge.type === "kabel-existing";
        const cableStyle = getCableStyle(edge.jenisJaringan || "SUTM", isExist);

        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        let angle = +(Math.atan2(dy, dx) * (180 / Math.PI)).toFixed(1);

        // Pastikan orientasi teks selalu terbaca dari kiri ke kanan (tidak terbalik)
        if (angle > 90) angle -= 180;
        else if (angle < -90) angle += 180;

        const rad = (angle * Math.PI) / 180;
        // Jarak offset dari garis kabel agar label berada DI ATAS atau DI BAWAH (tidak pas di atas garis kabel)
        const gap = Math.max(3, Math.round(4 * visualScale));
        const offsetDist = spanBadgeH / 2 + gap;

        // Candidate 1: Di Atas Kabel (offsetY < 0 dalam koordinat lokal terotasi)
        const candAboveY = -offsetDist;
        const candBelowY = +offsetDist;

        // Hitung posisi pusat di koordinat world untuk kandidat "di atas"
        const aboveWorldX = midX + Math.sin(rad) * offsetDist;
        const aboveWorldY = midY - Math.cos(rad) * offsetDist;

        // Cek apakah posisi "di atas" terlalu dekat ke batas atas halaman atau mengenai tiang lain
        const isTooCloseToTop = aboveWorldY - spanBadgeH / 2 < 20;
        const hitsNodeAbove = nodes.some(
          (n) => Math.hypot(n.x - aboveWorldX, n.y - aboveWorldY) < poleRadius + 6
        );

        // Standar SLD: posisikan di atas kabel, bila mentok/terhalang gunakan di bawah kabel
        const offsetY = (isTooCloseToTop || hitsNodeAbove) ? candBelowY : candAboveY;

        return {
          edgeId: edge.id,
          midX,
          midY,
          angle,
          offsetY,
          lengthM: edge.lengthM,
          stroke: cableStyle.stroke,
          badgeW: spanBadgeW,
          badgeH: spanBadgeH,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [visibleEdges, nodes, spanBadgeW, spanBadgeH, visualScale, poleRadius]);

  // Solver Collision Avoidance & Penempatan Cerdas Label Tiang (Task 2)
  const nodeLabelsLayout = useMemo(() => {
    const layoutMap = new Map<
      string,
      {
        nodeId: string;
        label: string;
        badgeX: number;
        badgeY: number;
        badgeW: number;
        badgeH: number;
        fontSize: number;
        leaderLine?: { x1: number; y1: number; x2: number; y2: number };
        isRefNode?: boolean;
        konstruksi?: string;
        konstruksiX?: number;
        konstruksiY?: number;
      }
    >();

    const placedBoxes: { x1: number; y1: number; x2: number; y2: number }[] = [];

    // Daftarkan zona reserved untuk span labels (sesuai posisi nyata di atas/bawah kabel)
    spanLabels.forEach((span) => {
      const halfW = span.badgeW / 2 + 4;
      const halfH = span.badgeH / 2 + 4;
      const rad = (span.angle * Math.PI) / 180;
      const actualMidX = span.midX - Math.sin(rad) * span.offsetY;
      const actualMidY = span.midY + Math.cos(rad) * span.offsetY;

      placedBoxes.push({
        x1: actualMidX - halfW,
        y1: actualMidY - halfH,
        x2: actualMidX + halfW,
        y2: actualMidY + halfH,
      });
    });

    // Urutkan nodes
    const sortedNodes = [...visibleNodes].sort((a, b) => a.x - b.x);

    sortedNodes.forEach((node) => {
      const labelText = node.label || "";
      if (!labelText && !node.konstruksi) return;

      const isRefNode = pageBoundary?.referenceNodeIds.includes(node.id);
      const textToDisplay = labelText + (isRefNode ? " [Ref]" : "");

      // Cari kabel yang terhubung ke tiang ini untuk hitung sudut luar (outer angle)
      const connectedEdges = edges.filter(
        (e) => e.fromNodeId === node.id || e.toNodeId === node.id
      );

      const neighborVecs: { x: number; y: number }[] = [];
      connectedEdges.forEach((e) => {
        const otherId = e.fromNodeId === node.id ? e.toNodeId : e.fromNodeId;
        const other = nodes.find((n) => n.id === otherId);
        if (other) {
          const d = Math.hypot(other.x - node.x, other.y - node.y);
          if (d > 0.1) {
            neighborVecs.push({
              x: (other.x - node.x) / d,
              y: (other.y - node.y) / d,
            });
          }
        }
      });

      // Hitung vektor arah menjauhi garis kabel (sisi luar sudut)
      let outerDir = { x: 0, y: -1 }; // default: ke atas
      if (neighborVecs.length >= 2) {
        const sumX = neighborVecs.reduce((acc, v) => acc + v.x, 0);
        const sumY = neighborVecs.reduce((acc, v) => acc + v.y, 0);
        const len = Math.hypot(sumX, sumY);
        if (len > 0.08) {
          outerDir = { x: -sumX / len, y: -sumY / len };
        } else {
          // Garis lurus horizontal/vertikal: pilih normal tegak lurus ke atas
          outerDir = { x: -neighborVecs[0].y, y: neighborVecs[0].x };
          if (outerDir.y > 0) {
            outerDir.x = -outerDir.x;
            outerDir.y = -outerDir.y;
          }
        }
      } else if (neighborVecs.length === 1) {
        outerDir = { x: -neighborVecs[0].y, y: neighborVecs[0].x };
        if (outerDir.y > 0) {
          outerDir.x = -outerDir.x;
          outerDir.y = -outerDir.y;
        }
      }

      let curFontSize = baseFontSize;
      let badgeW = Math.max(26, Math.round((textToDisplay.length * 6.5 + 8) * visualScale));
      let badgeH = Math.max(11, Math.round(12 * visualScale));

      // Buat daftar kandidat posisi alternatif jika terjadi tabrakan
      const candidateDistances = [
        poleRadius + 8,
        poleRadius + 16,
        poleRadius + 24,
        poleRadius + 32,
        poleRadius + 40,
      ];

      const baseAngle = Math.atan2(outerDir.y, outerDir.x);
      const angleOffsets = [0, 45, -45, 90, -90, 135, -135, 180];

      let chosenX = node.x + outerDir.x * candidateDistances[0];
      let chosenY = node.y + outerDir.y * candidateDistances[0];
      let hasFoundNoCollision = false;

      candidateLoop: for (const dist of candidateDistances) {
        for (const angDeg of angleOffsets) {
          const angRad = baseAngle + (angDeg * Math.PI) / 180;
          const candDirX = Math.cos(angRad);
          const candDirY = Math.sin(angRad);

          const cx = node.x + candDirX * dist;
          const cy = node.y + candDirY * dist;

          const box = {
            x1: cx - badgeW / 2 - 2,
            y1: cy - badgeH / 2 - 2,
            x2: cx + badgeW / 2 + 2,
            y2: cy + badgeH / 2 + 2,
          };

          // Tidak boleh menutupi simbol tiang sendiri
          if (Math.hypot(cx - node.x, cy - node.y) < poleRadius + 4) {
            continue;
          }

          // Tidak boleh menutupi simbol tiang lain
          const collidesWithOtherNode = visibleNodes.some(
            (other) => other.id !== node.id && Math.hypot(cx - other.x, cy - other.y) < poleRadius + 6
          );
          if (collidesWithOtherNode) continue;

          // Cek tabrakan dengan kotak yang sudah diletakkan sebelumnya
          const collidesWithPlaced = placedBoxes.some(
            (p) => !(box.x2 < p.x1 || box.x1 > p.x2 || box.y2 < p.y1 || box.y1 > p.y2)
          );
          if (collidesWithPlaced) continue;

          chosenX = cx;
          chosenY = cy;
          hasFoundNoCollision = true;
          break candidateLoop;
        }
      }

      // Jika masih bertabrakan, perkecil font label sampai batas minimum
      if (!hasFoundNoCollision) {
        curFontSize = Math.max(6, +(baseFontSize * 0.85).toFixed(1));
        badgeW = Math.max(22, Math.round((textToDisplay.length * 5.5 + 6) * visualScale));
        badgeH = Math.max(10, Math.round(11 * visualScale));
      }

      const finalBox = {
        x1: chosenX - badgeW / 2,
        y1: chosenY - badgeH / 2,
        x2: chosenX + badgeW / 2,
        y2: chosenY + badgeH / 2,
      };
      placedBoxes.push(finalBox);

      // Garis penunjuk pendek (Leader Line) jika label digeser menjauh (> poleRadius + 14)
      const distFromCenter = Math.hypot(chosenX - node.x, chosenY - node.y);
      let leaderLine: { x1: number; y1: number; x2: number; y2: number } | undefined;
      if (distFromCenter > poleRadius + 14) {
        const dirX = (chosenX - node.x) / distFromCenter;
        const dirY = (chosenY - node.y) / distFromCenter;
        leaderLine = {
          x1: +(node.x + dirX * (poleRadius + 2)).toFixed(1),
          y1: +(node.y + dirY * (poleRadius + 2)).toFixed(1),
          x2: +(chosenX - dirX * (badgeW / 2)).toFixed(1),
          y2: +(chosenY - dirY * (badgeH / 2)).toFixed(1),
        };
      }

      // Posisi konstruksi: diletakkan di sisi berlawanan dengan label tiang
      const konstrDirX = -(chosenX - node.x) / (distFromCenter || 1);
      const konstrDirY = -(chosenY - node.y) / (distFromCenter || 1);
      const konstrDist = poleRadius + 10;
      const kX = +(node.x + konstrDirX * konstrDist).toFixed(1);
      const kY = +(node.y + konstrDirY * konstrDist + 3).toFixed(1);

      layoutMap.set(node.id, {
        nodeId: node.id,
        label: textToDisplay,
        badgeX: +chosenX.toFixed(1),
        badgeY: +chosenY.toFixed(1),
        badgeW,
        badgeH,
        fontSize: curFontSize,
        leaderLine,
        isRefNode,
        konstruksi: node.konstruksi,
        konstruksiX: kX,
        konstruksiY: kY,
      });
    });

    return layoutMap;
  }, [visibleNodes, edges, spanLabels, poleRadius, baseFontSize, visualScale, pageBoundary]);

  const clipId = pageBoundary ? `page-clip-${pageBoundary.pageIndex}` : undefined;

  return (
    <div className={`w-full h-full bg-white relative overflow-hidden select-none ${className}`}>
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full block bg-white"
      >
        {/* Definisi ClipPath untuk clipping obstacle di batas halaman */}
        {pageBoundary && (
          <defs>
            <clipPath id={clipId}>
              <rect
                x={pageBoundary.x}
                y={pageBoundary.y}
                width={pageBoundary.width}
                height={pageBoundary.height}
              />
            </clipPath>
          </defs>
        )}

        {/* Layer 1 & 2: Obstacles dengan ClipPath */}
        <g id="export-obstacles" clipPath={clipId ? `url(#${clipId})` : undefined}>
          {/* 1. Roads & Alleys */}
          <g id="export-roads">
            {visibleObstacles
              .filter((o: SchematicObstacle) => o.obstacleType === "road" || o.obstacleType === "alley")
              .map(renderRoad)}
          </g>

          {/* 2. Buildings */}
          <g id="export-buildings">
            {visibleObstacles
              .filter((o: SchematicObstacle) => o.obstacleType === "building")
              .map(renderBuilding)}
          </g>
        </g>

        {/* Layer 3: Edges (Kabel & Konduktor) */}
        <g id="export-edges">
          {visibleEdges.map((edge: SchematicEdge) => {
            const from = nodes.find((n) => n.id === edge.fromNodeId);
            const to = nodes.find((n) => n.id === edge.toNodeId);
            if (!from || !to) return null;

            const isExist = edge.type === "kabel-existing";
            const cableStyle = getCableStyle(edge.jenisJaringan || "SUTM", isExist);
            const edgeStrokeWidth = Math.max(1.5, Math.round((cableStyle.strokeWidth || 3) * visualScale));

            return (
              <line
                key={`line-${edge.id}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={cableStyle.stroke}
                strokeWidth={edgeStrokeWidth}
                strokeDasharray={cableStyle.strokeDasharray}
                strokeLinecap="round"
              />
            );
          })}

          {/* Badge Panjang Kabel / Label Bentang (di atas atau bawah kabel, tidak pas kabel) */}
          {spanLabels.map((span) => (
            <g
              key={`span-${span.edgeId}`}
              transform={`translate(${span.midX}, ${span.midY}) rotate(${span.angle})`}
            >
              <rect
                x={-span.badgeW / 2}
                y={span.offsetY - span.badgeH / 2}
                width={span.badgeW}
                height={span.badgeH}
                rx={3}
                fill="#ffffff"
                stroke={span.stroke}
                strokeWidth={1}
              />
              <text
                x={0}
                y={span.offsetY + Math.round(span.badgeH * 0.25)}
                textAnchor="middle"
                fontSize={Math.max(6, Math.round(8 * visualScale))}
                fontWeight={800}
                fill="#0f172a"
                fontFamily="system-ui, sans-serif"
              >
                {span.lengthM}m
              </text>
            </g>
          ))}
        </g>

        {/* Layer 4: Nodes (Poles, Gardu, Schoor, Box APP) */}
        <g id="export-nodes">
          {visibleNodes.map((node: SchematicNode) => {
            const isExist = node.type === "tiang-existing";
            const isLast = node.posisiTiang === "Ujung";
            const isRefNode = pageBoundary?.referenceNodeIds.includes(node.id);
            const lbl = nodeLabelsLayout.get(node.id);

            return (
              <g key={node.id}>
                {/* Posisi Fisik Simbol Tiang/Gardu */}
                <g transform={`translate(${node.x}, ${node.y})`}>
                  {/* Lingkaran Penanda Tiang Referensi Overlap */}
                  {isRefNode && (
                    <circle
                      r={poleRadius + 7}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      opacity={0.85}
                    />
                  )}

                  {/* 1. Tiang */}
                  {(node.type.startsWith("tiang") || !node.type) &&
                    renderPoleSvg({
                      material: node.materialTiang || "Beton",
                      status: isExist ? "Existing" : "Rencana",
                      isExisting: isExist,
                      isLast,
                      size: poleSize,
                    })}

                  {/* 2. Gardu */}
                  {node.type === "gardu" &&
                    renderGarduSvg({
                      jenis: node.garduJenis || "Portal",
                      rotationDeg: node.rotationDeg || 0,
                      offsetX: node.offsetX || 0,
                      offsetY: node.offsetY || 0,
                      trafoKva: node.trafoKva || 100,
                      renderMainPole: true,
                      poleSize,
                    })}

                  {/* 3. Schoor / Penopang */}
                  {node.schoor &&
                    renderSchoorSvg({
                      jenis: node.schoor.jenis,
                      tipe: node.schoor.tipe,
                      rot: node.schoor.rotation || 0,
                      poleSize,
                    })}
                  {node.type === "treck-schoor" && (
                    renderSchoorSvg({ jenis: "Treck", tipe: "Standar", rot: node.rotationDeg || 0, poleSize })
                  )}
                  {node.type === "druck-schoor" && (
                    renderSchoorSvg({ jenis: "Druck", rot: node.rotationDeg || 0, poleSize })
                  )}
                  {node.type === "kontramast" && (
                    renderSchoorSvg({ jenis: "Kontramast", rot: node.rotationDeg || 0, poleSize })
                  )}

                  {/* 4. Box APP */}
                  {node.type === "box-app" && (
                    renderBoxAppSvg({ boxKva: node.boxKva || 197, size: Math.round(18 * visualScale) })
                  )}
                </g>

                {/* Leader line jika label tiang digeser alternatif */}
                {lbl?.leaderLine && (
                  <line
                    x1={lbl.leaderLine.x1}
                    y1={lbl.leaderLine.y1}
                    x2={lbl.leaderLine.x2}
                    y2={lbl.leaderLine.y2}
                    stroke="#64748b"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                  />
                )}

                {/* Label Node Tiang (Bebas Tabrakan, sisi luar sudut - Task 2) */}
                {lbl && (
                  <g transform={`translate(${lbl.badgeX}, ${lbl.badgeY})`}>
                    <rect
                      x={-lbl.badgeW / 2}
                      y={-lbl.badgeH / 2}
                      width={lbl.badgeW}
                      height={lbl.badgeH}
                      rx={2}
                      fill="#ffffff"
                      stroke={lbl.isRefNode ? "#2563eb" : "#0f172a"}
                      strokeWidth={lbl.isRefNode ? 1.2 : 0.8}
                    />
                    <text
                      x={0}
                      y={Math.round(lbl.badgeH * 0.26)}
                      textAnchor="middle"
                      fontSize={lbl.fontSize}
                      fontWeight={900}
                      fill={lbl.isRefNode ? "#1d4ed8" : "#0f172a"}
                      fontFamily="system-ui, sans-serif"
                    >
                      {lbl.label}
                    </text>
                  </g>
                )}

                {/* Kode Konstruksi (e.g. "C1", "A1") sisi berlawanan */}
                {lbl?.konstruksi && lbl.konstruksiX !== undefined && lbl.konstruksiY !== undefined && (
                  <text
                    x={lbl.konstruksiX}
                    y={lbl.konstruksiY}
                    textAnchor="middle"
                    fontSize={Math.max(6, Math.round(7 * visualScale))}
                    fontWeight={700}
                    fill="#334155"
                    fontFamily="system-ui, sans-serif"
                  >
                    {lbl.konstruksi}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Layer 5: Penanda Sambungan Antar Halaman (Continuation Callouts) */}
        {continuationCallouts.length > 0 && (
          <g id="export-continuation-callouts">
            {continuationCallouts.map((callout, idx) => {
              const isExit = callout.kind === "exit";

              // Geser badge masuk ke dalam frame agar tidak terpotong tepi kertas
              let badgeX = callout.x;
              let badgeY = callout.y;
              if (pageBoundary) {
                const marginX = 85;
                const marginY = 30;
                badgeX = Math.max(pageBoundary.x + marginX, Math.min(pageBoundary.x + pageBoundary.width - marginX, callout.x));
                badgeY = Math.max(pageBoundary.y + marginY, Math.min(pageBoundary.y + pageBoundary.height - marginY, callout.y));
              }

              const badgeWidth = callout.label.length * 6.8 + 24;

              return (
                <g key={`callout-${idx}`}>
                  {/* Leader line ke titik potong batas */}
                  <line
                    x1={callout.x}
                    y1={callout.y}
                    x2={badgeX}
                    y2={badgeY}
                    stroke={isExit ? "#2563eb" : "#16a34a"}
                    strokeWidth={1.8}
                    strokeDasharray="4 3"
                  />
                  <circle
                    cx={callout.x}
                    cy={callout.y}
                    r={3.5}
                    fill={isExit ? "#2563eb" : "#16a34a"}
                  />

                  {/* Kotak Callout Sambungan */}
                  <g transform={`translate(${badgeX}, ${badgeY})`}>
                    <rect
                      x={-badgeWidth / 2}
                      y={-10}
                      width={badgeWidth}
                      height={20}
                      rx={4}
                      fill={isExit ? "#eff6ff" : "#f0fdf4"}
                      stroke={isExit ? "#2563eb" : "#16a34a"}
                      strokeWidth={1.4}
                    />
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight={800}
                      fill={isExit ? "#1d4ed8" : "#15803d"}
                      fontFamily="system-ui, sans-serif"
                    >
                      {isExit ? `${callout.label} ➜` : `⬅ ${callout.label}`}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}
