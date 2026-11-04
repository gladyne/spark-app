import type {
  SchematicData,
  SchematicNode,
  SchematicEdge,
  SchematicObstacle,
} from "../../types/schematic";

export interface PageBoundary {
  id: string;
  pageIndex: number; // 1, 2, 3...
  x: number;
  y: number;
  width: number;
  height: number;
  nodeIds: string[];
  referenceNodeIds: string[]; // Node di zona overlap dari halaman tetangga
  edgeIds: string[];
  obstacleIds: string[];
}

export interface ContinuationCallout {
  edgeId: string;
  kind: "exit" | "entry";
  x: number;
  y: number;
  angleDeg: number;
  label: string; // Misal: "Lanjut ke Hal. 2 (T.07)" atau "Sambungan dari Hal. 1 (T.06)"
  targetPage: number;
  remoteNodeLabel?: string;
}

export interface PaginationResult {
  pages: PageBoundary[];
  scale: number;
  effectiveScale: number;
  totalPages: number;
  isSinglePage: boolean;
  orientation: "portrait" | "landscape";
  drawingAreaWidth: number;
  drawingAreaHeight: number;
  calloutsByPage: Record<number, ContinuationCallout[]>;
}

// Dimensi Area Gambar (Canvas) pada Lembar A2 (dalam satuan px lembar cetak)
export const DRAWING_BOX_DIMS = {
  landscape: {
    width: 1880,
    height: 760,
  },
  portrait: {
    width: 1300,
    height: 1180,
  },
};

// Skala minimum di mana simbol tiang (~18px) dan label (~10px) tetap terbaca jelas di cetak A2
export const MIN_READABLE_SCALE = 0.85;

/**
 * Menghitung bounding box seluruh aset skematik.
 */
export function getSchematicBounds(schematic: SchematicData): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  const { nodes = [], obstacles = [] } = schematic;

  if (nodes.length === 0 && obstacles.length === 0) {
    return { minX: 0, minY: 0, maxX: 1200, maxY: 500, width: 1200, height: 500 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((n) => {
    minX = Math.min(minX, n.x - 45);
    maxX = Math.max(maxX, n.x + 45);
    minY = Math.min(minY, n.y - 45);
    maxY = Math.max(maxY, n.y + 45);
  });

  obstacles.forEach((o) => {
    if (o.obstacleType === "building") {
      const w = (o.width || 80) / 2 + 25;
      const h = (o.height || 50) / 2 + 25;
      minX = Math.min(minX, o.x - w);
      maxX = Math.max(maxX, o.x + w);
      minY = Math.min(minY, o.y - h);
      maxY = Math.max(maxY, o.y + h);
    } else if (o.points && o.points.length > 0) {
      o.points.forEach((p) => {
        minX = Math.min(minX, p.x - 30);
        maxX = Math.max(maxX, p.x + 30);
        minY = Math.min(minY, p.y - 30);
        maxY = Math.max(maxY, p.y + 30);
      });
    }
  });

  const width = Math.max(200, maxX - minX);
  const height = Math.max(150, maxY - minY);

  return { minX, minY, maxX, maxY, width, height };
}

/**
 * Titik potong garis segmen (p1 -> p2) dengan persegi panjang (rect: x, y, width, height).
 */
export function getLineRectIntersection(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): { x: number; y: number; side: "top" | "bottom" | "left" | "right" } | null {
  const { x, y, width, height } = rect;
  const rx1 = x;
  const rx2 = x + width;
  const ry1 = y;
  const ry2 = y + height;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // Cek 4 garis tepi
  const edges: {
    side: "top" | "bottom" | "left" | "right";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }[] = [
    { side: "left", x1: rx1, y1: ry1, x2: rx1, y2: ry2 },
    { side: "right", x1: rx2, y1: ry1, x2: rx2, y2: ry2 },
    { side: "top", x1: rx1, y1: ry1, x2: rx2, y2: ry1 },
    { side: "bottom", x1: rx1, y1: ry2, x2: rx2, y2: ry2 },
  ];

  for (const edge of edges) {
    const denom = (edge.y2 - edge.y1) * dx - (edge.x2 - edge.x1) * dy;
    if (Math.abs(denom) < 1e-6) continue;

    const ua =
      ((edge.x2 - edge.x1) * (p1.y - edge.y1) - (edge.y2 - edge.y1) * (p1.x - edge.x1)) / denom;
    const ub =
      (dx * (p1.y - edge.y1) - dy * (p1.x - edge.x1)) / denom;

    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      return {
        x: +(p1.x + ua * dx).toFixed(2),
        y: +(p1.y + ua * dy).toFixed(2),
        side: edge.side,
      };
    }
  }

  return null;
}

/**
 * Mengurutkan halaman mengikuti alur jaringan tiang/gardu.
 * Memilih tiang pertama (misal T.01 / Feeder / Gardu / titik terkiri)
 * dan mengurutkan halaman berdasarkan urutan kunjungan alur jaringan.
 */
function sortPagesByNetworkFlow(
  pages: { x: number; y: number; width: number; height: number; nodes: SchematicNode[] }[],
  schematic: SchematicData
): typeof pages {
  if (pages.length <= 1) return pages;

  // Temukan root node (misal T.01 atau tiang dengan X terkecil)
  const rootNode = [...schematic.nodes].sort((a, b) => {
    const aLabel = (a.label || "").toLowerCase();
    const bLabel = (b.label || "").toLowerCase();
    if (aLabel.includes("1") || aLabel.includes("01")) return -1;
    if (bLabel.includes("1") || bLabel.includes("01")) return 1;
    return a.x - b.x;
  })[0];

  const rootX = rootNode ? rootNode.x : 0;
  const rootY = rootNode ? rootNode.y : 0;

  // Urutkan halaman berdasarkan jarak pusat halaman ke titik awal jaringan, lalu alur X/Y
  return [...pages].sort((a, b) => {
    const centerAX = a.x + a.width / 2;
    const centerAY = a.y + a.height / 2;
    const centerBX = b.x + b.width / 2;
    const centerBY = b.y + b.height / 2;

    const distA = Math.hypot(centerAX - rootX, centerAY - rootY);
    const distB = Math.hypot(centerBX - rootX, centerBY - rootY);

    if (Math.abs(distA - distB) > a.width * 0.4) {
      return distA - distB;
    }
    // Jika jarak mirip, urutkan kiri ke kanan, lalu atas ke bawah
    if (Math.abs(a.y - b.y) > 80) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });
}

/**
 * Menghitung lebar kotak label tiang terbesar dalam skematik.
 */
export function getMaxPoleLabelWidth(nodes: SchematicNode[]): number {
  if (!nodes || nodes.length === 0) return 36;
  let maxW = 34;
  nodes.forEach((n) => {
    const text = n.label || n.id || "T.01";
    const w = Math.max(34, text.length * 7 + 8);
    if (w > maxW) maxW = w;
  });
  return maxW;
}

/**
 * Menghitung jarak terkecil antar-tiang yang terhubung (atau tiang terdekat).
 */
export function getMinInterPoleDistance(nodes: SchematicNode[], edges: SchematicEdge[]): number {
  let minD = Infinity;
  edges.forEach((e) => {
    const u = nodes.find((n) => n.id === e.fromNodeId);
    const v = nodes.find((n) => n.id === e.toNodeId);
    if (u && v) {
      const d = Math.hypot(v.x - u.x, v.y - u.y);
      if (d > 2) minD = Math.min(minD, d);
    }
  });

  if (minD === Infinity && nodes.length > 1) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y);
        if (d > 2) minD = Math.min(minD, d);
      }
    }
  }

  return minD === Infinity ? 150 : minD;
}

/**
 * Menghitung pembagian halaman (Paginasi) secara cerdas.
 */
export function calculatePagination({
  schematic,
  orientation = "landscape",
  scaleOption = "auto",
  manualPageFrames,
}: {
  schematic: SchematicData;
  orientation: "portrait" | "landscape";
  scaleOption?: "auto" | number;
  manualPageFrames?: PageBoundary[];
}): PaginationResult {
  const boxDims = DRAWING_BOX_DIMS[orientation];
  const bounds = getSchematicBounds(schematic);

  const { nodes = [], edges = [], obstacles = [] } = schematic;

  // Tambahkan margin padding 50px di sekeliling konten
  const padding = 50;
  const contentW = bounds.width + padding * 2;
  const contentH = bounds.height + padding * 2;
  const originX = bounds.minX - padding;
  const originY = bounds.minY - padding;

  // Hitung skala yang dibutuhkan agar seluruh gambar muat dalam 1 halaman
  const scaleFit = Math.min(boxDims.width / contentW, boxDims.height / contentH);

  // Aturan Task 1: Jarak minimum antar-tiang di kertas >= 1.3 x lebar kotak label tiang terbesar
  const maxLabelWidth = getMaxPoleLabelWidth(nodes);
  const minInterPoleDist = getMinInterPoleDistance(nodes, edges);
  const minRequiredDistanceOnPaper = Math.max(55, 1.3 * maxLabelWidth);
  const distanceOnPaperAtFit = minInterPoleDist * scaleFit;

  let effectiveScale: number;
  let isSinglePage = false;

  if (scaleOption === "auto") {
    // Jika pada skala "fit" jarak terkecil kurang dari 1.3 x lebar label terbesar,
    // JANGAN dikecilkan lagi, tetapi pertahankan skala terbaca dan pecah ke beberapa halaman!
    if (distanceOnPaperAtFit < minRequiredDistanceOnPaper && nodes.length > 1) {
      const readableScale = +(minRequiredDistanceOnPaper / Math.max(1, minInterPoleDist)).toFixed(3);
      effectiveScale = Math.max(MIN_READABLE_SCALE, readableScale);
      isSinglePage = false;
    } else if (scaleFit >= MIN_READABLE_SCALE) {
      // Muat dalam 1 halaman dengan skala yang masih nyaman dibaca dan jarak mencukupi
      effectiveScale = Math.min(1.25, +scaleFit.toFixed(3));
      isSinglePage = true;
    } else {
      // Melebihi 1 halaman jika dipertahankan pada skala minimum yang terbaca
      effectiveScale = 1.0; // Skala standar nyaman dibaca
      isSinglePage = false;
    }
  } else {
    effectiveScale = scaleOption;
    isSinglePage =
      contentW * effectiveScale <= boxDims.width &&
      contentH * effectiveScale <= boxDims.height &&
      minInterPoleDist * effectiveScale >= minRequiredDistanceOnPaper;
  }

  // Jika manual page frames disediakan oleh user di editor, gunakan langsung
  if (manualPageFrames && manualPageFrames.length > 0) {
    const calloutsByPage: Record<number, ContinuationCallout[]> = {};
    manualPageFrames.forEach((p) => {
      calloutsByPage[p.pageIndex] = computePageCallouts(p, manualPageFrames, edges, nodes);
    });

    return {
      pages: manualPageFrames,
      scale: effectiveScale,
      effectiveScale,
      totalPages: manualPageFrames.length,
      isSinglePage: manualPageFrames.length === 1,
      orientation,
      drawingAreaWidth: boxDims.width,
      drawingAreaHeight: boxDims.height,
      calloutsByPage,
    };
  }

  // JIKA 1 HALAMAN (KASUS PROYEK KECIL ATAU FIT)
  if (isSinglePage) {
    const singleWidth = boxDims.width / effectiveScale;
    const singleHeight = boxDims.height / effectiveScale;

    // Pusatkan gambar di dalam bingkai
    const offX = originX - Math.max(0, (singleWidth - contentW) / 2);
    const offY = originY - Math.max(0, (singleHeight - contentH) / 2);

    const singlePage: PageBoundary = {
      id: "page-1",
      pageIndex: 1,
      x: Math.round(offX),
      y: Math.round(offY),
      width: Math.round(singleWidth),
      height: Math.round(singleHeight),
      nodeIds: nodes.map((n) => n.id),
      referenceNodeIds: [],
      edgeIds: edges.map((e) => e.id),
      obstacleIds: obstacles.map((o) => o.id),
    };

    return {
      pages: [singlePage],
      scale: effectiveScale,
      effectiveScale,
      totalPages: 1,
      isSinglePage: true,
      orientation,
      drawingAreaWidth: boxDims.width,
      drawingAreaHeight: boxDims.height,
      calloutsByPage: { 1: [] },
    };
  }

  // JIKA MELEBIHI 1 HALAMAN: BAGI MENJADI GRID CERDAS DENGAN OVERLAP
  const pageW = Math.round(boxDims.width / effectiveScale);
  const pageH = Math.round(boxDims.height / effectiveScale);

  // Zona tumpang tindih (overlap) ±1 bentang (~140px) agar tiang referensi terlihat di kedua halaman
  const overlapX = 140;
  const overlapY = 100;

  const stepX = Math.max(200, pageW - overlapX);
  const stepY = Math.max(150, pageH - overlapY);

  const numCols = Math.max(1, Math.ceil((contentW - overlapX) / stepX));
  const numRows = Math.max(1, Math.ceil((contentH - overlapY) / stepY));

  const candidatePages: {
    x: number;
    y: number;
    width: number;
    height: number;
    nodes: SchematicNode[];
  }[] = [];

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      let curX = originX + c * stepX;
      let curY = originY + r * stepY;

      // Geser batas halaman sedikit jika ada tiang tepat di garis batas (Boundary Nudge)
      const testBoundaryX = curX + pageW;
      const nearNodes = nodes.filter((n) => Math.abs(n.x - testBoundaryX) < 30);
      if (nearNodes.length > 0) {
        // Geser boundary ke kanan tiang agar tiang masuk utuh
        curX += 35;
      }

      const rect = { x: curX, y: curY, width: pageW, height: pageH };

      // Cari aset di dalam kotak ini
      const pageNodes = nodes.filter(
        (n) =>
          n.x >= rect.x - 10 &&
          n.x <= rect.x + rect.width + 10 &&
          n.y >= rect.y - 10 &&
          n.y <= rect.y + rect.height + 10
      );

      const hasObstacles = obstacles.some((o) => {
        if (o.obstacleType === "building") {
          return (
            o.x >= rect.x - 40 &&
            o.x <= rect.x + rect.width + 40 &&
            o.y >= rect.y - 30 &&
            o.y <= rect.y + rect.height + 30
          );
        }
        return (o.points || []).some(
          (p) => p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height
        );
      });

      // Halaman kosong (tanpa tiang & tanpa obstacle) otomatis dilewati
      if (pageNodes.length === 0 && !hasObstacles) {
        continue;
      }

      candidatePages.push({
        ...rect,
        nodes: pageNodes,
      });
    }
  }

  // Jika setelah filter tidak ada halaman (kasus tepi), fallback ke 1 halaman default
  if (candidatePages.length === 0) {
    candidatePages.push({
      x: originX,
      y: originY,
      width: pageW,
      height: pageH,
      nodes,
    });
  }

  // Urutkan halaman mengikuti alur jaringan dari tiang pertama (feeder/T.01)
  const orderedPages = sortPagesByNetworkFlow(candidatePages, schematic);

  // Buat PageBoundary final dengan penomoran berurutan 1, 2, 3...
  const finalPages: PageBoundary[] = orderedPages.map((p, idx) => {
    const pageIndex = idx + 1;
    const rect = { x: p.x, y: p.y, width: p.width, height: p.height };

    // Node utama halaman ini
    const coreNodeIds = p.nodes.map((n) => n.id);

    // Node referensi dari halaman tetangga (berada di zona tepi overlap)
    const refNodeIds = nodes
      .filter((n) => !coreNodeIds.includes(n.id))
      .filter(
        (n) =>
          n.x >= rect.x - 25 &&
          n.x <= rect.x + rect.width + 25 &&
          n.y >= rect.y - 25 &&
          n.y <= rect.y + rect.height + 25
      )
      .map((n) => n.id);

    const edgeIds = edges
      .filter((e) => {
        const fromIn = coreNodeIds.includes(e.fromNodeId) || refNodeIds.includes(e.fromNodeId);
        const toIn = coreNodeIds.includes(e.toNodeId) || refNodeIds.includes(e.toNodeId);
        return fromIn || toIn;
      })
      .map((e) => e.id);

    const obstacleIds = obstacles
      .filter((o) => {
        if (o.obstacleType === "building") {
          return (
            o.x >= rect.x - 60 &&
            o.x <= rect.x + rect.width + 60 &&
            o.y >= rect.y - 40 &&
            o.y <= rect.y + rect.height + 40
          );
        }
        return (o.points || []).some(
          (pt) => pt.x >= rect.x - 30 && pt.x <= rect.x + rect.width + 30 && pt.y >= rect.y - 30 && pt.y <= rect.y + rect.height + 30
        );
      })
      .map((o) => o.id);

    return {
      id: `page-${pageIndex}`,
      pageIndex,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      nodeIds: coreNodeIds,
      referenceNodeIds: refNodeIds,
      edgeIds,
      obstacleIds,
    };
  });

  // Hitung Callout Sambungan (Continuation Callouts) antar halaman
  const calloutsByPage: Record<number, ContinuationCallout[]> = {};
  finalPages.forEach((p) => {
    calloutsByPage[p.pageIndex] = computePageCallouts(p, finalPages, edges, nodes);
  });

  return {
    pages: finalPages,
    scale: effectiveScale,
    effectiveScale,
    totalPages: finalPages.length,
    isSinglePage: finalPages.length === 1,
    orientation,
    drawingAreaWidth: boxDims.width,
    drawingAreaHeight: boxDims.height,
    calloutsByPage,
  };
}

/**
 * Menghitung penanda sambungan (callout) untuk kabel yang memotong batas halaman ini.
 */
function computePageCallouts(
  curPage: PageBoundary,
  allPages: PageBoundary[],
  edges: SchematicEdge[],
  nodes: SchematicNode[]
): ContinuationCallout[] {
  const callouts: ContinuationCallout[] = [];
  const rect = { x: curPage.x, y: curPage.y, width: curPage.width, height: curPage.height };

  edges.forEach((edge) => {
    const from = nodes.find((n) => n.id === edge.fromNodeId);
    const to = nodes.find((n) => n.id === edge.toNodeId);
    if (!from || !to) return;

    const fromIn = curPage.nodeIds.includes(from.id);
    const toIn = curPage.nodeIds.includes(to.id);

    // Jika keduanya di dalam halaman yang sama, tidak perlu callout sambungan
    if (fromIn && toIn) return;

    // Jika salah satu di dalam dan salah satu di luar: ada garis kabel memotong batas!
    if (fromIn || toIn) {
      const intersection = getLineRectIntersection(from, to, rect);
      if (!intersection) return;

      const isExit = fromIn && !toIn;
      const remoteNode = isExit ? to : from;

      // Cari di halaman mana remoteNode berada
      const targetPageObj = allPages.find((p) => p.nodeIds.includes(remoteNode.id));
      const targetPageNum = targetPageObj ? targetPageObj.pageIndex : isExit ? curPage.pageIndex + 1 : curPage.pageIndex - 1;

      const angleDeg = +(Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI)).toFixed(1);

      const label = isExit
        ? `Lanjut ke Hal. ${targetPageNum} (${remoteNode.label || remoteNode.id})`
        : `Sambungan dari Hal. ${targetPageNum} (${remoteNode.label || remoteNode.id})`;

      callouts.push({
        edgeId: edge.id,
        kind: isExit ? "exit" : "entry",
        x: intersection.x,
        y: intersection.y,
        angleDeg: isExit ? angleDeg : angleDeg + 180,
        label,
        targetPage: targetPageNum,
        remoteNodeLabel: remoteNode.label || remoteNode.id,
      });
    }
  });

  return callouts;
}
