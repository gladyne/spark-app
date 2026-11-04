import type {
  SchematicData,
  SchematicNode,
  SchematicEdge,
  SchematicObstacle,
} from "../../types/schematic";
import { DRAWING_FRAME } from "./mapSyncEngine";

export interface AutoLayoutOptions {
  mode?: "serpentine" | "straight";
  targetWidth?: number;
  targetHeight?: number;
  margin?: number;
  spacingX?: number;
  spacingY?: number;
}

/**
 * Membangun adjacency graph dari nodes dan edges skematik.
 */
function buildAdjacency(nodes: SchematicNode[], edges: SchematicEdge[]) {
  const nodeMap = new Map<string, SchematicNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const adj = new Map<string, { neighborId: string; edge: SchematicEdge }[]>();
  nodes.forEach((n) => adj.set(n.id, []));

  edges.forEach((e) => {
    if (adj.has(e.fromNodeId) && adj.has(e.toNodeId)) {
      adj.get(e.fromNodeId)!.push({ neighborId: e.toNodeId, edge: e });
      adj.get(e.toNodeId)!.push({ neighborId: e.fromNodeId, edge: e });
    }
  });

  return { nodeMap, adj };
}

/**
 * Mencari root / titik awal jaringan (misal T.01, T.1, TB.00, gardu, atau tiang existing).
 */
function findRootNodeId(nodes: SchematicNode[], adj: Map<string, { neighborId: string; edge: SchematicEdge }[]>): string {
  if (nodes.length === 0) return "";
  if (nodes.length === 1) return nodes[0].id;

  // 1. Cari node yang memiliki label nomor 1 (T.01, T.1, P1, TB.01, Feeder)
  const labeledNodes = [...nodes].sort((a, b) => {
    const aLabel = (a.label || "").toLowerCase();
    const bLabel = (b.label || "").toLowerCase();

    const aIs1 = /\b(t\.?0?1|tb\.?0?1|p\.?0?1|feeder|gardu)\b/.test(aLabel) || aLabel.startsWith("t.01") || aLabel === "t.1";
    const bIs1 = /\b(t\.?0?1|tb\.?0?1|p\.?0?1|feeder|gardu)\b/.test(bLabel) || bLabel.startsWith("t.01") || bLabel === "t.1";

    if (aIs1 && !bIs1) return -1;
    if (!aIs1 && bIs1) return 1;

    // Prioritaskan tiang existing sebagai pangkal
    if (a.type === "tiang-existing" && b.type !== "tiang-existing") return -1;
    if (a.type !== "tiang-existing" && b.type === "tiang-existing") return 1;

    // Prioritaskan node ujung (degree 1)
    const degA = adj.get(a.id)?.length || 0;
    const degB = adj.get(b.id)?.length || 0;
    if (degA === 1 && degB !== 1) return -1;
    if (degA !== 1 && degB === 1) return 1;

    // Posisi terkiri (x terkecil)
    return a.x - b.x;
  });

  return labeledNodes[0].id;
}

/**
 * Menemukan jalur utama (Main Trunk) terpanjang dari root.
 */
function findMainTrunk(
  rootId: string,
  adj: Map<string, { neighborId: string; edge: SchematicEdge }[]>
): string[] {
  let longestPath: string[] = [];

  function dfs(curr: string, visited: Set<string>, path: string[]) {
    path.push(curr);
    visited.add(curr);

    if (path.length > longestPath.length) {
      longestPath = [...path];
    }

    const neighbors = adj.get(curr) || [];
    for (const { neighborId } of neighbors) {
      if (!visited.has(neighborId)) {
        dfs(neighborId, visited, path);
      }
    }

    path.pop();
    visited.delete(curr);
  }

  dfs(rootId, new Set<string>(), []);
  return longestPath;
}

/**
 * Merapikan layout jaringan skematik menjadi Single Line Diagram (SLD) berjarak seragam.
 *
 * Sesuai Task 3 & Task 4:
 * 1. Mengubah HANYA layout skematik (x, y). TIDAK mengubah koordinat peta dan TIDAK mengubah atribut/RAB.
 * 2. Luruskan jalur utama menjadi garis horizontal berjarak seragam (single line diagram).
 * 3. Mempertahankan topologi dan urutan tiang.
 * 4. Cabang digambar tegak lurus (90°) dari jalur utama.
 * 5. Jika jalur terlalu panjang untuk satu baris, bungkus (serpentine / baris baru) pada batas lebar.
 * 6. Panjang bentang tetap menampilkan jarak NYATA (label), bukan panjang garis di kertas (NTS).
 * 7. Memanfaatkan lebar & tinggi bidang gambar dengan margin merata (Task 4).
 */
export function tidySchematicLayout(
  schematic: SchematicData,
  options?: AutoLayoutOptions
): SchematicData {
  const { nodes = [], edges = [], obstacles = [] } = schematic;

  if (nodes.length <= 1) {
    return schematic;
  }

  const targetW = options?.targetWidth || DRAWING_FRAME.WIDTH; // 1200
  const targetH = options?.targetHeight || DRAWING_FRAME.HEIGHT; // 500
  const margin = options?.margin ?? 60;

  const { nodeMap, adj } = buildAdjacency(nodes, edges);

  // Kumpulkan connected components
  const visited = new Set<string>();
  const components: string[][] = [];

  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      const comp: string[] = [];
      const queue = [n.id];
      visited.add(n.id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        comp.push(curr);
        const neighbors = adj.get(curr) || [];
        neighbors.forEach(({ neighborId }) => {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        });
      }
      components.push(comp);
    }
  });

  // Urutkan komponen dari yang terbanyak nodenya
  components.sort((a, b) => b.length - a.length);

  // Map posisi baru untuk setiap node
  const newPositions = new Map<string, { x: number; y: number }>();

  // Hitung area usable untuk komponen utama
  const usableW = Math.max(400, targetW - margin * 2);
  const usableH = Math.max(300, targetH - margin * 2);

  // Proses setiap komponen
  components.forEach((compNodeIds, compIndex) => {
    const compNodes = compNodeIds.map((id) => nodeMap.get(id)!).filter(Boolean);
    const rootId = findRootNodeId(compNodes, adj);
    const trunk = findMainTrunk(rootId, adj);
    const trunkSet = new Set(trunk);

    const trunkLen = trunk.length;

    // Tentukan jumlah tiang per baris (Poles Per Row)
    // Standar NTS: jarak antar-tiang 140 - 165 px nyaman dibaca
    const idealSpacingX = options?.spacingX || 150;
    const maxPolesPerRow = Math.max(4, Math.floor(usableW / idealSpacingX) + 1);

    const useSerpentine = trunkLen > maxPolesPerRow;
    const polesPerRow = useSerpentine ? Math.min(maxPolesPerRow, Math.ceil(trunkLen / Math.ceil(trunkLen / maxPolesPerRow))) : trunkLen;
    const numRows = Math.ceil(trunkLen / polesPerRow);

    // Hitung spacing dinamis
    const actualSpacingX = polesPerRow > 1 ? Math.min(170, Math.max(125, usableW / (polesPerRow - 1))) : 150;
    const actualSpacingY = numRows > 1 ? Math.min(135, Math.max(85, usableH / (numRows - 1))) : 120;

    const startX = margin + (usableW - (polesPerRow - 1) * actualSpacingX) / 2;
    // Beri offset vertikal jika ada komponen lain
    const compOffsetY = compIndex * 160;
    const startY = margin + compOffsetY + (usableH - (numRows - 1) * actualSpacingY) / 2;

    // 1. Tempatkan tiang jalur utama (Trunk) dengan Serpentine
    trunk.forEach((nodeId, idx) => {
      const row = Math.floor(idx / polesPerRow);
      const col = idx % polesPerRow;

      let x: number;
      if (row % 2 === 0) {
        // Baris genap: Kiri ke Kanan
        x = startX + col * actualSpacingX;
      } else {
        // Baris ganjil: Kanan ke Kiri (Serpentine snake)
        x = startX + (polesPerRow - 1 - col) * actualSpacingX;
      }
      const y = startY + row * actualSpacingY;

      newPositions.set(nodeId, { x: Math.round(x), y: Math.round(y) });
    });

    // 2. Tempatkan tiang cabang (Branches) tegak lurus (90°) dari jalur utama
    const placedNodes = new Set<string>(trunk);

    function placeBranches(parentNodeId: string, parentX: number, parentY: number, dirY: 1 | -1) {
      const neighbors = adj.get(parentNodeId) || [];
      const branchNeighbors = neighbors.filter((item) => !placedNodes.has(item.neighborId));

      branchNeighbors.forEach(({ neighborId }, branchIdx) => {
        placedNodes.add(neighborId);
        // Cabang tegak lurus ke atas / ke bawah
        const branchSpacingY = 70;
        const branchX = parentX + (branchIdx > 0 ? (branchIdx % 2 === 1 ? 50 : -50) * Math.ceil(branchIdx / 2) : 0);
        const branchY = parentY + dirY * branchSpacingY * (Math.floor(branchIdx / 2) + 1);

        newPositions.set(neighborId, { x: Math.round(branchX), y: Math.round(branchY) });

        // Lanjutkan cabang dari anak jika ada ranting lebih dalam
        placeBranches(neighborId, branchX, branchY, dirY);
      });
    }

    trunk.forEach((trunkNodeId, idx) => {
      const pos = newPositions.get(trunkNodeId)!;
      const row = Math.floor(idx / polesPerRow);
      // Jika baris pertama, arahkan cabang ke atas jika memungkinkan, atau ke bawah
      const dirY: 1 | -1 = row === 0 ? -1 : 1;
      placeBranches(trunkNodeId, pos.x, pos.y, dirY);
    });
  });

  // 3. Normalisasi & Pusatkan Konten (Task 4: Pemakaian Bidang Gambar)
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  newPositions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y);
  });

  if (minX !== Infinity) {
    const currentW = Math.max(10, maxX - minX);
    const currentH = Math.max(10, maxY - minY);

    // Hitung offset agar berada tepat di tengah area kanvas
    const targetCenterX = targetW / 2;
    const targetCenterY = targetH / 2;
    const currentCenterX = minX + currentW / 2;
    const currentCenterY = minY + currentH / 2;

    const shiftX = Math.round(targetCenterX - currentCenterX);
    const shiftY = Math.round(targetCenterY - currentCenterY);

    newPositions.forEach((pos, id) => {
      newPositions.set(id, {
        x: Math.max(20, Math.min(targetW - 20, pos.x + shiftX)),
        y: Math.max(20, Math.min(targetH - 20, pos.y + shiftY)),
      });
    });
  }

  // Bangun nodes baru dengan posisi yang sudah dirapikan
  // Pastikan SEMUA atribut teknis, tipe, label, kop, dan RAB TETAP UTUH!
  const updatedNodes: SchematicNode[] = nodes.map((node) => {
    const pos = newPositions.get(node.id);
    if (!pos) return node;
    return {
      ...node,
      x: pos.x,
      y: pos.y,
    };
  });

  return {
    ...schematic,
    nodes: updatedNodes,
    // Edges tetap utuh dengan lengthM asli yang sama persis
    edges: [...edges],
    // Obstacles tetap utuh
    obstacles: [...obstacles],
  };
}
