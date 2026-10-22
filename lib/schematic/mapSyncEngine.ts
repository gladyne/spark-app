import type {
  SchematicData,
  SchematicNode,
  SchematicEdge,
  SchematicNodeType,
  SchematicEdgeType,
  SchematicKop,
} from "../../types/schematic";
import type {
  NetworkLayer,
  JunctionInfo,
  Connection,
} from "../../types/spark";
import { haversineMeters } from "../geo";
import { parseKva } from "../assetStyles";
import { calculateRabVolumes } from "../rab/rabMapper";
import { convertSchematicToRabLayers } from "../rab/schematicAdapter";

export interface SparkMapSyncPayload {
  projectId?: string;
  projectName?: string;
  savedLayers: NetworkLayer[];
  draftLayer?: NetworkLayer | null;
  junctions?: JunctionInfo[];
  connections?: Connection[];
  updatedAt?: number;
}

export interface UnsyncedItem {
  category: string;
  title: string;
  location: string;
  detail: string;
}

export interface NodeDiff {
  node: SchematicNode;
  isNew: boolean;
  changes?: string[];
}

export interface EdgeDiff {
  edge: SchematicEdge;
  isNew: boolean;
  changes?: string[];
}

export interface MapSyncPlan {
  // Ringkasan
  projectName: string;
  hasDraft: boolean;
  draftPolesCount: number;
  draftEdgesCount: number;

  // Diffs
  toAddNodes: SchematicNode[];
  toUpdateNodes: NodeDiff[];
  toDeleteNodes: SchematicNode[];

  toAddEdges: SchematicEdge[];
  toUpdateEdges: EdgeDiff[];
  toDeleteEdges: SchematicEdge[];

  // Item peta yang tidak didukung di skematik
  unsyncedItems: UnsyncedItem[];

  // Evaluasi RAB
  mapRabTotal: number;
  schematicRabTotal: number;
  rabDiff: number;

  // Data skematik kandidat hasil sinkronisasi
  candidateSchematic: SchematicData;
}

export const DRAWING_FRAME = {
  WIDTH: 1200,
  HEIGHT: 500,
  MARGIN: 40,
};

/**
 * Normalisasi dan proyeksi koordinat GPS (lat, lng) ke kanvas skematik (x, y).
 * Menggunakan Equirectangular Projection dengan:
 * - Arah Utara ke ATAS (North is UP)
 * - Skala aspek seragam 1:1 (tidak terdistorsi/stretch)
 * - Fit ke dalam batas area gambar (1200 x 500) dengan margin ±40px
 * - Terpusat secara proporsional di dalam area gambar
 */
export function projectCoordinatesToCanvas(
  coords: { id: string; lat: number; lng: number }[],
  canvasWidth = DRAWING_FRAME.WIDTH,
  canvasHeight = DRAWING_FRAME.HEIGHT,
  margin = DRAWING_FRAME.MARGIN
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (coords.length === 0) return result;

  if (coords.length === 1) {
    result.set(coords[0].id, {
      x: Math.round(canvasWidth / 2),
      y: Math.round(canvasHeight / 2),
    });
    return result;
  }

  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;

  for (const c of coords) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  }

  const midLat = (minLat + maxLat) / 2;
  const cosMid = Math.cos((midLat * Math.PI) / 180);

  const spanX = Math.max(0.000001, (maxLng - minLng) * cosMid);
  const spanY = Math.max(0.000001, maxLat - minLat);

  const availW = Math.max(200, canvasWidth - 2 * margin);
  const availH = Math.max(200, canvasHeight - 2 * margin);

  // Skala seragam 1:1
  const scale = Math.min(availW / spanX, availH / spanY);

  const renderedW = spanX * scale;
  const renderedH = spanY * scale;

  const offsetX = margin + (availW - renderedW) / 2;
  const offsetY = margin + (availH - renderedH) / 2;

  for (const c of coords) {
    const x = Math.round(offsetX + (c.lng - minLng) * cosMid * scale);
    // North is UP: semakin besar lat, semakin kecil y (ke arah atas kanvas)
    const y = Math.round(offsetY + (maxLat - c.lat) * scale);
    result.set(c.id, { x, y });
  }

  return result;
}

/**
 * Membangun rencana sinkronisasi (Sync Plan) dari data SparkMap ke Schematic.
 */
export function buildMapSyncPlan(
  mapData: SparkMapSyncPayload,
  currentSchematic: SchematicData,
  options: {
    includeDraft: boolean;
    deleteRemovedNodes?: boolean;
    excludedDeleteNodeIds?: Set<string>;
  }
): MapSyncPlan {
  const { includeDraft, deleteRemovedNodes = false, excludedDeleteNodeIds = new Set<string>() } = options;

  // 1. Kumpulkan layer yang akan disinkronkan
  const activeLayers: NetworkLayer[] = [...(mapData.savedLayers || [])];
  let draftPolesCount = 0;
  let draftEdgesCount = 0;
  const hasDraft = Boolean(mapData.draftLayer && mapData.draftLayer.poles && mapData.draftLayer.poles.length > 0);

  if (hasDraft && mapData.draftLayer) {
    draftPolesCount = mapData.draftLayer.poles.length;
    draftEdgesCount = Math.max(0, mapData.draftLayer.poles.length - 1);
    if (includeDraft) {
      activeLayers.push(mapData.draftLayer);
    }
  }

  const junctions = mapData.junctions || [];
  const unsyncedItems: UnsyncedItem[] = [];

  // Helper canonical key untuk junction topologis
  const getCanonicalKey = (layerId: number, poleIdx: number): string => {
    const j = junctions.find(
      (item) => item.branchLayerId === layerId && item.branchPoleIdx === poleIdx
    );
    if (j) {
      return `canonical_${j.hostLayerId}_pole_${j.hostPoleIdx}`;
    }
    return `canonical_${layerId}_pole_${poleIdx}`;
  };

  // 2. Ekstraksi tiang dan gardu dari peta
  interface ExtractedPole {
    canonicalId: string;
    sourceId: string;
    lat: number;
    lng: number;
    label: string;
    layerId: number;
    poleIdx: number;
    statusJaringan: string;
    jenisJaringan: string;
    materialTiang: "Beton" | "Baja";
    tinggiTiang: number;
    kekuatanTiang: number;
    posisiTiang: "Tumpu" | "Topang-Sudut" | "Ujung";
    konstruksi: string;
    gardu?: NetworkLayer["gardus"][number];
    schoor?: NetworkLayer["schoors"][number];
    poleAttributes?: NetworkLayer["poleAttributes"];
  }

  const mapPolesMap = new Map<string, ExtractedPole>();

  activeLayers.forEach((l) => {
    // Deteksi Underbuild (jaringan ganda)
    if (l.jenisJaringan.toLowerCase().includes("underbuild")) {
      unsyncedItems.push({
        category: "Jaringan Khusus",
        title: "Konstruksi Underbuild Ganda",
        location: `Layer '${l.label}' (${l.jenisJaringan})`,
        detail: "Konstruksi underbuild ganda pada tiang yang sama tidak memiliki node gabungan tunggal di kanvas skematik; kabel disinkronkan secara terpisah.",
      });
    }

    // Deteksi Kabel Tanah (SKTM/SKTR) dengan Jointing & Terminasi
    if (l.jenisJaringan === "SKTM" || l.jenisJaringan === "SKTR") {
      unsyncedItems.push({
        category: "Kabel Tanah",
        title: `Aksesoris Jointing & Terminasi ${l.jenisJaringan}`,
        location: `Layer '${l.label}'`,
        detail: "Simbol jointing (JNT) dan terminasi (TRM) kabel tanah belum didukung sebagai simbol mandiri di kanvas skematik (tetap dihitung dalam RAB).",
      });
    }

    const isTM =
      l.jenisJaringan.startsWith("SUTM") ||
      l.jenisJaringan.startsWith("SKUTM") ||
      l.jenisJaringan.startsWith("SKTM");

    l.poles.forEach((p, idx) => {
      const canonicalId = getCanonicalKey(l.id, idx);
      const isEnd = idx === 0 || idx === l.poles.length - 1;
      const posisi: "Tumpu" | "Topang-Sudut" | "Ujung" =
        l.posisiTiang || (isEnd ? "Ujung" : "Tumpu");
      const mat: "Beton" | "Baja" = (l.materialTiang || "")
        .toLowerCase()
        .includes("baja")
        ? "Baja"
        : "Beton";

      const konstruksi =
        l.konstruksiOverrides?.[idx] ||
        (isTM ? (posisi === "Ujung" ? "C2" : "C1") : (posisi === "Ujung" ? "S2" : "S1"));

      const garduCfg = l.gardus?.[idx];
      const schoorCfg = l.schoors?.[idx];

      // Cek item yang belum punya padanan simbol skematik resmi
      const attr = l.poleAttributes?.[idx];
      if (attr?.hasArrester) {
        unsyncedItems.push({
          category: "Aksesoris Tiang",
          title: "Lightning Arrester (LA)",
          location: `Layer ${l.label} - Tiang T.${idx + 1}`,
          detail: "Belum ada simbol skematik mandiri untuk arrester (diakomodasi dalam RAB saja).",
        });
      }
      if (attr?.hasGrounding) {
        unsyncedItems.push({
          category: "Aksesoris Tiang",
          title: "Sistem Grounding / Pembumian",
          location: `Layer ${l.label} - Tiang T.${idx + 1}`,
          detail: "Belum ada simbol skematik mandiri untuk grounding.",
        });
      }
      if (attr?.hasCutOut) {
        unsyncedItems.push({
          category: "Aksesoris Tiang",
          title: "Fused Cut Out (FCO)",
          location: `Layer ${l.label} - Tiang T.${idx + 1}`,
          detail: "Belum ada simbol skematik mandiri untuk FCO.",
        });
      }

      if (!mapPolesMap.has(canonicalId)) {
        mapPolesMap.set(canonicalId, {
          canonicalId,
          sourceId: `map_pole_${canonicalId}`,
          lat: p[0],
          lng: p[1],
          label: garduCfg ? `G.${idx + 1}` : `T.${idx + 1}`,
          layerId: l.id,
          poleIdx: idx,
          statusJaringan: l.statusJaringan || "Rencana",
          jenisJaringan: l.jenisJaringan,
          materialTiang: mat,
          tinggiTiang: l.tinggiTiang || (isTM ? 12 : 9),
          kekuatanTiang: l.kekuatanTiang || 200,
          posisiTiang: posisi,
          konstruksi,
          gardu: garduCfg,
          schoor: schoorCfg,
          poleAttributes: l.poleAttributes,
        });
      } else {
        // Jika sudah ada (junction host), tambahkan gardu/schoor jika ada di branch
        const existing = mapPolesMap.get(canonicalId)!;
        if (garduCfg && !existing.gardu) existing.gardu = garduCfg;
        if (schoorCfg && !existing.schoor) existing.schoor = schoorCfg;
      }
    });
  });

  // 3. Proyeksikan koordinat GPS ke kanvas untuk seluruh tiang peta
  const coordsToProject = Array.from(mapPolesMap.values()).map((p) => ({
    id: p.sourceId,
    lat: p.lat,
    lng: p.lng,
  }));
  const projectedPositions = projectCoordinatesToCanvas(coordsToProject);

  // 4. Cocokkan dengan node skematik saat ini (Re-sync & Diffing)
  const currentNodesBySourceId = new Map<string, SchematicNode>();
  const manualNodes: SchematicNode[] = [];

  (currentSchematic.nodes || []).forEach((n) => {
    if (n.sourceId) {
      currentNodesBySourceId.set(n.sourceId, n);
    } else {
      manualNodes.push(n);
    }
  });

  const toAddNodes: SchematicNode[] = [];
  const toUpdateNodes: NodeDiff[] = [];
  const candidateNodes: SchematicNode[] = [...manualNodes];

  mapPolesMap.forEach((pole) => {
    const existing = currentNodesBySourceId.get(pole.sourceId);
    const proj = projectedPositions.get(pole.sourceId) || { x: 400, y: 300 };

    const isTM =
      pole.jenisJaringan.startsWith("SUTM") ||
      pole.jenisJaringan.startsWith("SKUTM") ||
      pole.jenisJaringan.startsWith("SKTM");

    let nodeType: SchematicNodeType = "tiang-rencana";
    if (pole.gardu) {
      nodeType = "gardu";
    } else if (pole.statusJaringan === "Existing") {
      nodeType = "tiang-existing";
    } else if (isTM) {
      nodeType = "tiang-tm";
    } else {
      nodeType = "tiang-tr";
    }

    const schoorData = pole.schoor
      ? {
          jenis: pole.schoor.jenis,
          rotation: pole.schoor.rotation,
          tipe: "Standar" as const,
        }
      : undefined;

    if (!existing) {
      // 🟢 Node Baru (Add)
      const newNode: SchematicNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sourceId: pole.sourceId,
        geoPlaced: true,
        schematicPlaced: true,
        type: nodeType,
        x: proj.x,
        y: proj.y,
        label: pole.label,
        kategori: isTM ? "TM" : "TR",
        materialTiang: pole.materialTiang,
        tinggiTiang: pole.tinggiTiang,
        kekuatanTiang: pole.kekuatanTiang,
        posisiTiang: pole.posisiTiang,
        konstruksi: pole.konstruksi,
        garduJenis: pole.gardu?.jenis,
        trafoKva: pole.gardu?.trafo ? parseKva(pole.gardu.trafo) : undefined,
        rotationDeg:
          pole.gardu?.rotationDeg ||
          (pole.gardu?.orientasi === "Vertikal" ? 90 : 0),
        offsetX: pole.gardu?.offsetX || 0,
        offsetY: pole.gardu?.offsetY || 0,
        schoor: schoorData,
      };
      toAddNodes.push(newNode);
      candidateNodes.push(newNode);
    } else {
      // 🔵 Node Sudah Ada (Update atribut, pertahankan posisi x/y)
      const changes: string[] = [];
      if (existing.materialTiang !== pole.materialTiang) {
        changes.push(`Material: ${existing.materialTiang || "-"} → ${pole.materialTiang}`);
      }
      if (existing.tinggiTiang !== pole.tinggiTiang) {
        changes.push(`Tinggi: ${existing.tinggiTiang || "-"}m → ${pole.tinggiTiang}m`);
      }
      if (existing.kekuatanTiang !== pole.kekuatanTiang) {
        changes.push(`Kekuatan: ${existing.kekuatanTiang || "-"} daN → ${pole.kekuatanTiang} daN`);
      }
      if (existing.konstruksi !== pole.konstruksi) {
        changes.push(`Konstruksi: ${existing.konstruksi || "-"} → ${pole.konstruksi}`);
      }
      if (pole.gardu && existing.garduJenis !== pole.gardu.jenis) {
        changes.push(`Gardu: ${existing.garduJenis || "-"} → ${pole.gardu.jenis}`);
      }
      if (pole.schoor && existing.schoor?.jenis !== pole.schoor.jenis) {
        changes.push(`Schoor: ${existing.schoor?.jenis || "-"} → ${pole.schoor.jenis}`);
      }

      const updatedNode: SchematicNode = {
        ...existing,
        // PERTAHANKAN POSISI X/Y DAN OFFSET/ROTASI USER
        x: existing.x,
        y: existing.y,
        offsetX: existing.offsetX ?? (pole.gardu?.offsetX || 0),
        offsetY: existing.offsetY ?? (pole.gardu?.offsetY || 0),
        rotationDeg: existing.rotationDeg ?? (pole.gardu?.rotationDeg || 0),
        // PERBARUI ATRIBUT TEKNIS DARI PETA
        type: nodeType,
        kategori: isTM ? "TM" : "TR",
        materialTiang: pole.materialTiang,
        tinggiTiang: pole.tinggiTiang,
        kekuatanTiang: pole.kekuatanTiang,
        posisiTiang: pole.posisiTiang,
        konstruksi: pole.konstruksi,
        garduJenis: pole.gardu?.jenis,
        trafoKva: pole.gardu?.trafo ? parseKva(pole.gardu.trafo) : existing.trafoKva,
        schoor: schoorData,
      };

      if (changes.length > 0) {
        toUpdateNodes.push({ node: updatedNode, isNew: false, changes });
      }
      candidateNodes.push(updatedNode);
    }
  });

  // 🟠 Node yang dihapus di peta (ada di skematik tapi tidak di peta)
  const toDeleteNodes: SchematicNode[] = [];
  currentNodesBySourceId.forEach((node, sId) => {
    if (!mapPolesMap.has(sId.replace("map_pole_", ""))) {
      toDeleteNodes.push(node);
      // Jika user memilih untuk mempertahankan, tetap masukkan ke candidateNodes
      if (!deleteRemovedNodes || excludedDeleteNodeIds.has(node.id)) {
        candidateNodes.push(node);
      }
    }
  });

  // ─── Task 1: Fit-to-Canvas Guard ──────────────────────────────────────────
  // Periksa apakah ada node baru yang melebihi batas area gambar [40, 1160] x [40, 460]
  // Jika ya, skalakan SERAGAM (tanpa stretch) dan pusatkan di dalam area gambar.
  if (toAddNodes.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    toAddNodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    });

    const targetW = DRAWING_FRAME.WIDTH - 2 * DRAWING_FRAME.MARGIN; // 1120
    const targetH = DRAWING_FRAME.HEIGHT - 2 * DRAWING_FRAME.MARGIN; // 420

    if (
      minX < DRAWING_FRAME.MARGIN ||
      maxX > DRAWING_FRAME.WIDTH - DRAWING_FRAME.MARGIN ||
      minY < DRAWING_FRAME.MARGIN ||
      maxY > DRAWING_FRAME.HEIGHT - DRAWING_FRAME.MARGIN
    ) {
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      const fitScale = Math.min(targetW / spanX, targetH / spanY);
      const renderedW = spanX * fitScale;
      const renderedH = spanY * fitScale;
      const offX = DRAWING_FRAME.MARGIN + (targetW - renderedW) / 2;
      const offY = DRAWING_FRAME.MARGIN + (targetH - renderedH) / 2;

      toAddNodes.forEach((n) => {
        n.x = Math.round(offX + (n.x - minX) * fitScale);
        n.y = Math.round(offY + (n.y - minY) * fitScale);
      });
    }
  }

  // Map untuk lookup ID node kandidat berdasarkan sourceId
  const candidateNodeIdBySourceId = new Map<string, string>();
  candidateNodes.forEach((n) => {
    if (n.sourceId) candidateNodeIdBySourceId.set(n.sourceId, n.id);
  });

  // 5. Ekstraksi kabel / span dari peta
  interface ExtractedSpan {
    sourceId: string;
    fromSourceId: string;
    toSourceId: string;
    lengthM: number;
    jenisJaringan: string;
    konduktorJenis: "AAAC" | "AAAC/S";
    kondukturUkuran: number;
    statusJaringan: string;
  }

  const mapSpans: ExtractedSpan[] = [];

  activeLayers.forEach((l) => {
    const isTR =
      l.jenisJaringan.startsWith("SUTR") ||
      l.jenisJaringan.startsWith("SKUTR") ||
      l.jenisJaringan.startsWith("SKTR");

    for (let i = 0; i < l.poles.length - 1; i++) {
      const fromCan = getCanonicalKey(l.id, i);
      const toCan = getCanonicalKey(l.id, i + 1);
      const fromSourceId = `map_pole_${fromCan}`;
      const toSourceId = `map_pole_${toCan}`;

      // Jarak nyata geodesik (meter)
      const dist = Math.max(
        1,
        Math.round(haversineMeters(l.poles[i][0], l.poles[i][1], l.poles[i + 1][0], l.poles[i + 1][1]))
      );

      const spanSourceId = `map_span_${fromCan}_${toCan}`;
      mapSpans.push({
        sourceId: spanSourceId,
        fromSourceId,
        toSourceId,
        lengthM: dist,
        jenisJaringan: l.jenisJaringan,
        konduktorJenis: (l.konduktorJenis === "AAAC" ? "AAAC" : "AAAC/S") as "AAAC" | "AAAC/S",
        kondukturUkuran: l.kondukturUkuran || (isTR ? 70 : 70),
        statusJaringan: l.statusJaringan || "Rencana",
      });
    }
  });

  // 6. Cocokkan edges skematik
  const currentEdgesBySourceId = new Map<string, SchematicEdge>();
  const manualEdges: SchematicEdge[] = [];

  (currentSchematic.edges || []).forEach((e) => {
    if (e.sourceId) {
      currentEdgesBySourceId.set(e.sourceId, e);
    } else {
      manualEdges.push(e);
    }
  });

  const toAddEdges: SchematicEdge[] = [];
  const toUpdateEdges: EdgeDiff[] = [];
  const candidateEdges: SchematicEdge[] = [...manualEdges];

  mapSpans.forEach((span) => {
    const fromNodeId = candidateNodeIdBySourceId.get(span.fromSourceId);
    const toNodeId = candidateNodeIdBySourceId.get(span.toSourceId);

    if (!fromNodeId || !toNodeId) return;

    const existingEdge = currentEdgesBySourceId.get(span.sourceId);

    const isTR =
      span.jenisJaringan.startsWith("SUTR") ||
      span.jenisJaringan.startsWith("SKUTR") ||
      span.jenisJaringan.startsWith("SKTR");

    let edgeType: SchematicEdgeType = "kabel-rencana";
    if (span.statusJaringan === "Existing") {
      edgeType = "kabel-existing";
    } else if (isTR) {
      edgeType = "kabel-tr";
    } else {
      edgeType = "kabel-tm";
    }

    if (!existingEdge) {
      const newEdge: SchematicEdge = {
        id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sourceId: span.sourceId,
        geoPlaced: true,
        schematicPlaced: true,
        type: edgeType,
        fromNodeId,
        toNodeId,
        lengthM: span.lengthM,
        jenisJaringan: span.jenisJaringan,
        konduktorJenis: span.konduktorJenis,
        kondukturUkuran: span.kondukturUkuran,
      };
      toAddEdges.push(newEdge);
      candidateEdges.push(newEdge);
    } else {
      const changes: string[] = [];
      if (existingEdge.lengthM !== span.lengthM) {
        changes.push(`Panjang: ${existingEdge.lengthM}m → ${span.lengthM}m`);
      }
      if (existingEdge.jenisJaringan !== span.jenisJaringan) {
        changes.push(`Jenis: ${existingEdge.jenisJaringan} → ${span.jenisJaringan}`);
      }

      const updatedEdge: SchematicEdge = {
        ...existingEdge,
        fromNodeId,
        toNodeId,
        type: edgeType,
        lengthM: span.lengthM,
        jenisJaringan: span.jenisJaringan,
        konduktorJenis: span.konduktorJenis,
        kondukturUkuran: span.kondukturUkuran,
      };

      if (changes.length > 0) {
        toUpdateEdges.push({ edge: updatedEdge, isNew: false, changes });
      }
      candidateEdges.push(updatedEdge);
    }
  });

  const toDeleteEdges: SchematicEdge[] = [];
  currentEdgesBySourceId.forEach((edge, sId) => {
    if (!mapSpans.some((s) => s.sourceId === sId)) {
      toDeleteEdges.push(edge);
      if (!deleteRemovedNodes) {
        candidateEdges.push(edge);
      }
    }
  });

  // 7. Bangun Candidate Schematic (Obstacles & Kop TIDAK disentuh, hanya fallback default jika belum ada)
  const defaultKop: SchematicKop = {
    unit: "UP3 KUPANG - ULP KUPANG",
    namaPekerjaan: mapData.projectName || "Pembangunan Jaringan Distribusi",
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

  const candidateSchematic: SchematicData = {
    ...currentSchematic,
    nodes: candidateNodes,
    edges: candidateEdges,
    kop: currentSchematic.kop
      ? {
          ...currentSchematic.kop,
          namaPekerjaan:
            currentSchematic.kop.namaPekerjaan || mapData.projectName || defaultKop.namaPekerjaan,
        }
      : defaultKop,
  };

  // 8. Evaluasi Perbandingan RAB (Peta vs Skematik Hasil Sinkron)
  // Evaluasi RAB peta:
  const mapInputLayers = activeLayers.map((l) => {
    const normalizedGardus: Record<number, any> = {};
    if (l.gardus) {
      Object.entries(l.gardus).forEach(([k, g]: [string, any]) => {
        if (!g) return;
        normalizedGardus[Number(k)] = {
          ...g,
          trafo: g.trafo || (g.kapasitasKva ? `${g.kapasitasKva} kVA` : "50 kVA"),
        };
      });
    }
    return {
      id: l.id,
      label: l.label,
      poles: l.poles,
      line: l.line,
      jenisJaringan: l.jenisJaringan,
      statusJaringan: l.statusJaringan,
      tinggiTiang: l.tinggiTiang,
      materialTiang: l.materialTiang,
      kekuatanTiang: l.kekuatanTiang,
      posisiTiang: l.posisiTiang,
      konduktorJenis: l.konduktorJenis,
      kondukturUkuran: l.kondukturUkuran,
      gardus: normalizedGardus,
      schoors: l.schoors,
      konstruksiOverrides: l.konstruksiOverrides,
      poleData: (l as any).poleData,
    };
  });

  const mapRab = calculateRabVolumes(mapInputLayers);
  const schematicRabInput = convertSchematicToRabLayers(candidateSchematic);
  const schematicRab = calculateRabVolumes(schematicRabInput);

  const mapRabTotal = mapRab.grandTotal;
  const schematicRabTotal = schematicRab.grandTotal;
  const rabDiff = Math.abs(mapRabTotal - schematicRabTotal);

  return {
    projectName: mapData.projectName || "Project Peta",
    hasDraft,
    draftPolesCount,
    draftEdgesCount,
    toAddNodes,
    toUpdateNodes,
    toDeleteNodes,
    toAddEdges,
    toUpdateEdges,
    toDeleteEdges,
    unsyncedItems,
    mapRabTotal,
    schematicRabTotal,
    rabDiff,
    candidateSchematic,
  };
}
