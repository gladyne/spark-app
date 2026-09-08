import { RAB_CATALOG_BY_ROW } from "./rabCatalogData";
import type {
  RabItemResult,
  RabWarning,
  RabSummary,
  RabCategory,
  TiangMaterial,
} from "./types";
import type { NetworkLayer, PoleData, GarduConfig, SchoorConfig } from "../../types/spark";
import { haversineMeters } from "../geo";

export interface LayerInputData {
  id: number;
  label: string;
  poles: [number, number][];
  line: [number, number][];
  jenisJaringan: string;
  statusJaringan: string;
  offsetSide?: number;
  jarakGawang?: number;
  tinggiTiang?: number;
  materialTiang?: string;
  kekuatanTiang?: number;
  posisiTiang?: "Tumpu" | "Topang-Sudut" | "Ujung";
  konduktorJenis?: "AAAC" | "AAAC/S";
  kabelTipe?: string;
  rabCategory?: "JTM" | "GARDU" | "JTR";
  gardus?: Record<number, GarduConfig>;
  schoors?: Record<number, SchoorConfig>;
  konstruksiOverrides?: Record<number, string>;
  kondukturUkuran?: number;
  poleData?: PoleData[];
}

export interface RabMapperOptions {
  includeCommissioning?: boolean;
  includeTestingDocs?: boolean;
  defaultIsolator?: "Porcelin" | "Polimer";
}

function normalizeMaterial(m?: string): TiangMaterial {
  if (!m) return "Beton";
  const lower = m.toLowerCase();
  if (lower.includes("baja") || lower.includes("besi") || lower.includes("steel")) return "Baja";
  return "Beton";
}

function calculatePolylineLengthM(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  }
  return total;
}

export function calculateRabVolumes(
  layers: LayerInputData[],
  options: RabMapperOptions = { includeCommissioning: true, includeTestingDocs: true, defaultIsolator: "Porcelin" }
): RabSummary {
  // Map of row -> { volJtm, volGardu, volJtr, details }
  const rowVolumes = new Map<number, { volJtm: number; volGardu: number; volJtr: number; details: string[] }>();
  const warnings: RabWarning[] = [];

  const addVolume = (
    row: number,
    qty: number,
    cat: RabCategory,
    detail: string
  ) => {
    if (qty <= 0) return;
    const catItem = RAB_CATALOG_BY_ROW.get(row);
    if (!catItem) {
      warnings.push({
        id: `unknown-row-${row}`,
        assetType: "Katalog",
        message: `Row ${row} tidak ditemukan dalam katalog referensi.`,
      });
      return;
    }

    if (!rowVolumes.has(row)) {
      rowVolumes.set(row, { volJtm: 0, volGardu: 0, volJtr: 0, details: [] });
    }
    const entry = rowVolumes.get(row)!;
    if (cat === "JTM") entry.volJtm += qty;
    else if (cat === "GARDU") entry.volGardu += qty;
    else if (cat === "JTR") entry.volJtr += qty;

    entry.details.push(`${detail} (+${qty} ${catItem.satuan})`);
  };

  let totalJtmLengthM = 0;
  let totalJtrLengthM = 0;
  let totalPolesCount = 0;
  let totalGarduCount = 0;

  for (const layer of layers) {
    const isOverhead = !layer.jenisJaringan.startsWith("SKTM") && !layer.jenisJaringan.startsWith("SKTR");
    const isJtmBase =
      layer.jenisJaringan.includes("SUTM") ||
      layer.jenisJaringan === "SKUTM" ||
      layer.jenisJaringan === "SKTM";
    const isJtrBase =
      layer.jenisJaringan.includes("SKUTR") ||
      layer.jenisJaringan === "SKTR";

    const defaultLayerCat: RabCategory = layer.rabCategory || (isJtrBase && !isJtmBase ? "JTR" : "JTM");

    const lineLenM = calculatePolylineLengthM(layer.line && layer.line.length > 1 ? layer.line : layer.poles);
    if (isJtmBase) totalJtmLengthM += lineLenM;
    if (isJtrBase) totalJtrLengthM += lineLenM;

    const layerMaterial = normalizeMaterial(layer.materialTiang);
    const layerHeight = layer.tinggiTiang || (isJtrBase && !isJtmBase ? 9 : 12);
    const layerDaN = layer.kekuatanTiang || (layerHeight >= 12 ? 350 : 200);

    // ─── 1. TIANG (Mendirikan Tiang) ──────────────────────────────────────────
    if (isOverhead && layer.poles && layer.poles.length > 0) {
      totalPolesCount += layer.poles.length;
      let tiangRow: number | null = null;

      if (layerMaterial === "Beton") {
        if (layerHeight === 9 && layerDaN === 200) tiangRow = 19;
        else if (layerHeight === 12 && layerDaN === 200) tiangRow = 20;
        else if (layerHeight === 12 && layerDaN === 350) tiangRow = 21;
        else if (layerHeight === 13 && layerDaN === 350) tiangRow = 22;
        else if (layerHeight === 14 && layerDaN === 350) tiangRow = 23;
        else {
          // Fallback matching to closest standard
          if (layerHeight <= 9) tiangRow = 19;
          else if (layerHeight === 12) tiangRow = 21;
          else if (layerHeight === 13) tiangRow = 22;
          else tiangRow = 23;
          warnings.push({
            id: `tiang-beton-warn-${layer.id}`,
            assetType: "Tiang Beton",
            layerLabel: layer.label,
            message: `Tiang Beton ${layerHeight}m ${layerDaN} daN disesuaikan ke standar terdekat di KHS (Row ${tiangRow}).`,
            recommendation: "Gunakan kombinasi standar: 9m 200daN, 12m 200/350daN, 13m 350daN, atau 14m 350daN.",
          });
        }
      } else {
        // Tiang Baja
        if (layerHeight === 7 && layerDaN === 100) tiangRow = 24;
        else if (layerHeight === 9 && layerDaN === 100) tiangRow = 25;
        else if (layerHeight === 9 && layerDaN === 200) tiangRow = 26;
        else if (layerHeight === 11 && layerDaN === 200) tiangRow = 27;
        else if (layerHeight === 12 && layerDaN === 200) tiangRow = 28;
        else if (layerHeight === 12 && layerDaN === 350) tiangRow = 29;
        else if (layerHeight === 13 && layerDaN === 350) tiangRow = 30;
        else if (layerHeight === 14 && layerDaN === 350) tiangRow = 31;
        else {
          if (layerHeight <= 7) tiangRow = 24;
          else if (layerHeight <= 9) tiangRow = 26;
          else if (layerHeight <= 11) tiangRow = 27;
          else if (layerHeight === 12) tiangRow = 29;
          else if (layerHeight === 13) tiangRow = 30;
          else tiangRow = 31;
          warnings.push({
            id: `tiang-baja-warn-${layer.id}`,
            assetType: "Tiang Baja",
            layerLabel: layer.label,
            message: `Tiang Baja ${layerHeight}m ${layerDaN} daN disesuaikan ke standar terdekat di KHS (Row ${tiangRow}).`,
            recommendation: "Gunakan kombinasi standar: 7m 100daN, 9m 100/200daN, 11m 200daN, 12m 200/350daN, 13m 350daN, 14m 350daN.",
          });
        }
      }

      if (tiangRow) {
        addVolume(
          tiangRow,
          layer.poles.length,
          defaultLayerCat,
          `Layer "${layer.label}" (${layer.poles.length} tiang ${layerMaterial} ${layerHeight}m)`
        );

        // Penomoran tiang
        addVolume(
          1042,
          layer.poles.length,
          defaultLayerCat,
          `Penomoran tiang "${layer.label}"`
        );

        // Penanda tiang ESDM
        addVolume(
          1054,
          layer.poles.length,
          defaultLayerCat,
          `Penanda stiker ESDM tiang "${layer.label}"`
        );
      }
    }

    // ─── 2. KONDUKTOR & KABEL ────────────────────────────────────────────────
    const roundedMeters = Math.round(lineLenM);
    if (roundedMeters > 0) {
      const konduktorSize = layer.kondukturUkuran || (isJtmBase ? 70 : 70);
      const isAaacs = layer.konduktorJenis === "AAAC/S" || (!layer.konduktorJenis && layer.jenisJaringan.includes("SUTM"));

      // 2a. SUTM Konduktor
      if (layer.jenisJaringan.includes("SUTM")) {
        let condRow = 55; // Default AAAC/S 3x70 mm²
        if (isAaacs) {
          if (konduktorSize <= 50) condRow = 54;
          else if (konduktorSize <= 70) condRow = 55;
          else if (konduktorSize <= 95) condRow = 56;
          else if (konduktorSize <= 120) condRow = 57;
          else if (konduktorSize <= 150) condRow = 58;
          else condRow = 59;
        } else {
          // AAAC polos
          if (konduktorSize <= 35) condRow = 47;
          else if (konduktorSize <= 50) condRow = 48;
          else if (konduktorSize <= 70) condRow = 49;
          else if (konduktorSize <= 95) condRow = 50;
          else if (konduktorSize <= 120) condRow = 51;
          else if (konduktorSize <= 150) condRow = 52;
          else condRow = 53;
        }
        addVolume(condRow, roundedMeters, "JTM", `Panjang SUTM "${layer.label}"`);
      }

      // 2b. SKUTM (MVTIC NFA2XSY-T)
      if (layer.jenisJaringan === "SKUTM") {
        let skutRow = 60; // 3x70+50mm²
        if (konduktorSize <= 70) skutRow = 60;
        else if (konduktorSize <= 95) skutRow = 61;
        else if (konduktorSize <= 150) skutRow = 62;
        else skutRow = 63;
        addVolume(skutRow, roundedMeters, "JTM", `Panjang SKUTM "${layer.label}"`);
      }

      // 2c. SKTM (NA2XSEYBY Kabel Tanah TM)
      if (layer.jenisJaringan === "SKTM") {
        let sktmRow = 64; // 3 x 70mm²
        if (konduktorSize <= 70) sktmRow = 64;
        else if (konduktorSize <= 95) sktmRow = 65;
        else if (konduktorSize <= 150) sktmRow = 66;
        else if (konduktorSize <= 240) sktmRow = 67;
        else sktmRow = 68;
        addVolume(sktmRow, roundedMeters, "JTM", `Panjang SKTM "${layer.label}"`);

        // Galian tanah & pasir kabel tanah SKTM estimasi (panjang * 0.4m lebar * 0.8m kedalaman = 0.32 m3/m)
        const galianM3 = Math.round(roundedMeters * 0.32);
        if (galianM3 > 0) {
          addVolume(761, galianM3, "JTM", `Penggalian tanah SKTM "${layer.label}"`);
          addVolume(764, Math.round(roundedMeters * 0.08), "JTM", `Pengurugan pasir SKTM "${layer.label}"`);
          addVolume(765, Math.round(roundedMeters * 0.24), "JTM", `Penimbunan tanah SKTM "${layer.label}"`);
        }
      }

      // 2d. SKUTR (LVTC NFA2X-T Kabel Udara TR)
      if (layer.jenisJaringan.includes("SKUTR") || layer.jenisJaringan.includes("Underbuild")) {
        let skutrRow = 83; // 3x70+70mm²
        if (konduktorSize <= 35) skutrRow = 81;
        else if (konduktorSize <= 50) skutrRow = 82;
        else if (konduktorSize <= 70) skutrRow = 83;
        else skutrRow = 84;
        addVolume(skutrRow, roundedMeters, "JTR", `Panjang SKUTR "${layer.label}"`);
      }

      // 2e. SKTR (NYFGbY Kabel Tanah TR)
      if (layer.jenisJaringan === "SKTR") {
        let sktrRow = 90; // 4x70 mm²
        if (konduktorSize <= 70) sktrRow = 90;
        else if (konduktorSize <= 95) sktrRow = 91;
        else sktrRow = 92;
        addVolume(sktrRow, roundedMeters, "JTR", `Panjang SKTR "${layer.label}"`);
      }
    }

    // ─── 3. PENOPANG TIANG (SCHOOR) ──────────────────────────────────────────
    if (layer.schoors) {
      for (const [poleIdxStr, sch] of Object.entries(layer.schoors)) {
        const poleIdx = Number(poleIdxStr);
        let schRow: number | null = null;
        const isJtrSchoor = defaultLayerCat === "JTR";

        if (sch.jenis === "Druck") {
          if (isJtrSchoor) {
            if (layerMaterial === "Beton") schRow = 543; // JTR Beton 9/200
            else {
              if (layerHeight <= 7) schRow = 548;
              else if (layerHeight <= 9 && layerDaN <= 100) schRow = 549;
              else if (layerHeight <= 9) schRow = 550;
              else schRow = 551;
            }
          } else {
            // JTM Druck
            if (layerMaterial === "Beton") {
              if (layerHeight <= 12 && layerDaN <= 200) schRow = 544;
              else if (layerHeight <= 12) schRow = 545;
              else if (layerHeight === 13) schRow = 546;
              else schRow = 547;
            } else {
              // Baja
              if (layerHeight <= 12 && layerDaN <= 200) schRow = 552;
              else if (layerHeight <= 12) schRow = 553;
              else if (layerHeight === 13) schRow = 554;
              else schRow = 555;
            }
          }
        } else if (sch.jenis === "Treck") {
          if (isJtrSchoor) {
            if (layerMaterial === "Beton") schRow = 560; // JTR Beton 9/200
            else {
              if (layerHeight <= 7) schRow = 568;
              else if (layerHeight <= 9 && layerDaN <= 100) schRow = 567;
              else if (layerHeight <= 9) schRow = 566;
              else schRow = 565;
            }
          } else {
            // JTM Treckschoor Standar
            if (layerMaterial === "Beton") {
              if (layerHeight >= 14) schRow = 556;
              else if (layerHeight === 13) schRow = 557;
              else if (layerDaN >= 350) schRow = 558;
              else schRow = 559;
            } else {
              // Baja
              if (layerHeight >= 14) schRow = 561;
              else if (layerHeight === 13) schRow = 562;
              else if (layerDaN >= 350) schRow = 563;
              else schRow = 564;
            }
          }
        } else if (sch.jenis === "Kontramast") {
          if (isJtrSchoor) {
            if (layerMaterial === "Beton") schRow = 586;
            else {
              if (layerHeight <= 7) schRow = 594;
              else if (layerHeight <= 9 && layerDaN <= 100) schRow = 593;
              else if (layerHeight <= 9) schRow = 592;
              else schRow = 591;
            }
          } else {
            // JTM Kontramast
            if (layerMaterial === "Beton") {
              if (layerHeight >= 14) schRow = 582;
              else if (layerHeight === 13) schRow = 583;
              else if (layerDaN >= 350) schRow = 584;
              else schRow = 585;
            } else {
              if (layerHeight >= 14) schRow = 587;
              else if (layerHeight === 13) schRow = 588;
              else if (layerDaN >= 350) schRow = 589;
              else schRow = 590;
            }
          }
        }

        if (schRow) {
          addVolume(schRow, 1, defaultLayerCat, `Schoor ${sch.jenis} pada Tiang #${poleIdx + 1} (${layer.label})`);
        }
      }
    }

    // ─── 4. TRAFO & GARDU DISTRIBUSI ──────────────────────────────────────────
    if (layer.gardus) {
      for (const [poleIdxStr, grd] of Object.entries(layer.gardus)) {
        const poleIdx = Number(poleIdxStr);
        totalGarduCount++;

        // 4a. Pasang Trafo (Row 38-46)
        const capNum = parseInt(grd.trafo.replace(/\D/g, "")) || 50;
        let trafoRow = 39; // 50 kVA
        if (capNum <= 25) trafoRow = 38;
        else if (capNum <= 50) trafoRow = 39;
        else if (capNum <= 100) trafoRow = 40;
        else if (capNum <= 160) trafoRow = 41;
        else if (capNum <= 200) trafoRow = 42;
        else if (capNum <= 250) trafoRow = 43;
        else if (capNum <= 400) trafoRow = 44;
        else if (capNum <= 630) trafoRow = 45;
        else trafoRow = 46;

        addVolume(trafoRow, 1, "GARDU", `Trafo ${capNum} kVA pada Tiang #${poleIdx + 1}`);

        // 4b. Rangka Dudukan Trafo 3 Phasa
        const isPortal = grd.jenis === "Portal";
        let rangkaTrafoRow = 795; // 1 Tiang Standar Beton 12/350
        if (!isPortal) {
          if (layerMaterial === "Beton") {
            if (layerHeight >= 14) rangkaTrafoRow = 793;
            else if (layerHeight === 13) rangkaTrafoRow = 794;
            else if (layerDaN >= 350) rangkaTrafoRow = 795;
            else rangkaTrafoRow = 796;
          } else {
            if (layerHeight >= 14) rangkaTrafoRow = 797;
            else if (layerHeight === 13) rangkaTrafoRow = 798;
            else if (layerDaN >= 350) rangkaTrafoRow = 799;
            else rangkaTrafoRow = 800;
          }
        } else {
          // 2 Tiang Portal
          if (layerMaterial === "Beton") {
            if (layerHeight >= 14) rangkaTrafoRow = 809;
            else if (layerHeight === 13) rangkaTrafoRow = 810;
            else if (layerDaN >= 350) rangkaTrafoRow = 811;
            else rangkaTrafoRow = 812;
          } else {
            if (layerHeight >= 14) rangkaTrafoRow = 813;
            else if (layerHeight === 13) rangkaTrafoRow = 814;
            else if (layerDaN >= 350) rangkaTrafoRow = 815;
            else rangkaTrafoRow = 816;
          }
        }
        addVolume(rangkaTrafoRow, 1, "GARDU", `Rangka Dudukan Trafo (${grd.jenis}) Tiang #${poleIdx + 1}`);

        // 4c. Rangka Dudukan LV Board & Unit LV Board
        if (!isPortal) {
          // 1 Tiang (2 Jurusan)
          let rkLvRow = layerMaterial === "Beton" ? (layerHeight >= 14 ? 817 : layerHeight === 13 ? 818 : 819) : (layerHeight >= 14 ? 821 : 823);
          addVolume(rkLvRow, 1, "GARDU", `Rangka LV Board 1 Tiang`);
          addVolume(116, 1, "GARDU", `LV Board 3P 2 Jurusan`);
          addVolume(1041, 1, "GARDU", `Pengecatan LV Board 2 Jurusan`);
          addVolume(1032, 1, "GARDU", `Pondasi Lantai Kerja Gardu 1 Tiang`);

          // Pipa In/Outlet Medium B 2.5"
          let pipaRow = layerMaterial === "Beton" ? 835 : 839;
          addVolume(pipaRow, 1, "GARDU", `Pipa In/Outlet Gardu 1 Tiang 2.5"`);

          // Cross Arm Cut Out & Arrester Gardu 1 Tiang
          addVolume(layerMaterial === "Beton" ? 773 : 776, 1, "GARDU", `Cross Arm Dudukan Cut Out Gardu 1 Tiang`);
          addVolume(layerMaterial === "Beton" ? 783 : 786, 1, "GARDU", `Cross Arm Dudukan Arrester Gardu 1 Tiang`);
        } else {
          // 2 Tiang (4 Jurusan)
          let rkLvRow = layerMaterial === "Beton" ? (layerHeight >= 14 ? 825 : layerHeight === 13 ? 826 : 827) : (layerHeight >= 14 ? 829 : 831);
          addVolume(rkLvRow, 1, "GARDU", `Rangka LV Board 2 Tiang`);
          addVolume(117, 1, "GARDU", `LV Board 3P 4 Jurusan`);
          addVolume(1040, 1, "GARDU", `Pengecatan LV Board 4 Jurusan`);
          addVolume(1033, 1, "GARDU", `Pondasi Lantai Kerja Gardu 2 Tiang`);

          // Pipa In/Outlet 3"
          let pipaRow = layerMaterial === "Beton" ? 875 : 879;
          addVolume(pipaRow, 1, "GARDU", `Pipa In/Outlet Gardu 2 Tiang 3"`);

          // Cross Arm Cut Out & Arrester Gardu 2 Tiang
          addVolume(layerMaterial === "Beton" ? 778 : 781, 1, "GARDU", `Cross Arm Dudukan Cut Out Gardu 2 Tiang`);
          addVolume(layerMaterial === "Beton" ? 788 : 791, 1, "GARDU", `Cross Arm Dudukan Arrester Gardu 2 Tiang`);
        }

        // Cut Out 20 kV & Lightning Arrester unit di Gardu (masing-masing 3 buah untuk 3 fasa)
        addVolume(36, 3, "GARDU", `Cut Out 20 kV (3 buah) Gardu Tiang #${poleIdx + 1}`);
        addVolume(37, 3, "GARDU", `Lightning Arrester 24 kV (3 buah) Gardu Tiang #${poleIdx + 1}`);

        // Arde Gardu + Body Trafo + LV Board (Kopel)
        let ardeGarduRow = layerMaterial === "Beton" ? 953 : 957; // BC 50mm²
        addVolume(ardeGarduRow, 1, "GARDU", `Arde Gardu Kopel Tiang #${poleIdx + 1}`);

        // Arde Titik Netral Sekunder Trafo
        addVolume(971, 1, "GARDU", `Arde Titik Netral Sekunder Trafo Tiang #${poleIdx + 1}`);

        // Tanda Kilat Besar Gardu
        addVolume(881, 1, "GARDU", `Tanda Kilat Besar Gardu`);

        // Penomoran Gardu
        addVolume(1043, 1, "GARDU", `Penomoran Gardu`);

        // Penanda Gardu ESDM
        addVolume(1055, 1, "GARDU", `Penanda Gardu Distribusi (Plat Besi) ESDM`);
      }
    }

    // ─── 5. CROSS ARM & ISOLATOR KONSTRUKSI TIANG ─────────────────────────────
    if (isOverhead && layer.poles && layer.poles.length > 0) {
      const isolatorType = options.defaultIsolator || "Porcelin";
      const isoTumpuRow = isolatorType === "Polimer" ? 34 : 32;
      const isoTarikRow = isolatorType === "Polimer" ? 35 : 33;

      for (let i = 0; i < layer.poles.length; i++) {
        // Cek jika tiang ini ada gardu, sudah di-handle gardu di atas
        const hasGardu = layer.gardus && layer.gardus[i];
        const kOverride = layer.konstruksiOverrides?.[i];

        if (isJtmBase) {
          // Default konstruksi JTM: endpoint/ujung -> A3, belokan -> 2xA3/B3, lurus -> A1
          let kCode = kOverride;
          if (!kCode) {
            if (i === 0 || i === layer.poles.length - 1) kCode = "A3";
            else kCode = "A1";
          }

          if (kCode === "A1") {
            // Cross Arm Type A1 UNP 100
            const a1Row = layerMaterial === "Beton" ? 625 : (layerHeight >= 14 ? 626 : layerHeight === 13 ? 627 : 628);
            addVolume(a1Row, 1, "JTM", `Cross Arm Type A1 Tiang #${i + 1}`);
            // 3 Isolator Tumpu per tiang tumpu 3-fasa
            addVolume(isoTumpuRow, 3, "JTM", `Isolator Tumpu 20 kV Tiang #${i + 1}`);
          } else if (kCode === "A2") {
            const a2Row = layerMaterial === "Beton" ? 635 : (layerHeight >= 14 ? 636 : layerHeight === 13 ? 637 : 638);
            addVolume(a2Row, 1, "JTM", `Cross Arm Type A2 Tiang #${i + 1}`);
            addVolume(isoTarikRow, 3, "JTM", `Isolator Tarik 20 kV Tiang #${i + 1}`);
          } else if (kCode === "A3" || kCode.includes("A3")) {
            const a3Row = layerMaterial === "Beton" ? 640 : (layerHeight >= 14 ? 641 : layerHeight === 13 ? 642 : 643);
            const multiplier = kCode === "2xA3" ? 2 : 1;
            addVolume(a3Row, multiplier, "JTM", `Cross Arm Type ${kCode} Tiang #${i + 1}`);
            addVolume(isoTarikRow, 3 * multiplier, "JTM", `Isolator Tarik 20 kV Tiang #${i + 1}`);
          } else if (kCode.includes("B3")) {
            const b3Row = layerMaterial === "Beton" ? 645 : (layerHeight >= 14 ? 646 : layerHeight === 13 ? 647 : 648);
            addVolume(b3Row, 1, "JTM", `Cross Arm Type B3 Tiang #${i + 1}`);
            addVolume(isoTarikRow, 6, "JTM", `Isolator Tarik 20 kV Tiang #${i + 1}`);
          }

          // Jika ada cut out atau arrester tambahan pada tiang line JTM
          if (!hasGardu && (i === 0 || i === layer.poles.length - 1)) {
            // Tiang ujung biasanya ada Arrester & Cut Out JTM
            addVolume(37, 3, "JTM", `Lightning Arrester 24 kV Tiang Ujung #${i + 1}`);
            addVolume(layerMaterial === "Beton" ? 600 : 603, 1, "JTM", `Cross Arm Dudukan Arrester di JTM Tiang #${i + 1}`);
            addVolume(layerMaterial === "Beton" ? 937 : 941, 1, "JTM", `Arde Arrester JTM Tiang #${i + 1}`);
          }
        }

        // Jika SKUTR (JTR)
        if (isJtrBase && !isJtmBase) {
          const isEndpoint = i === 0 || i === layer.poles.length - 1;
          if (isEndpoint) {
            addVolume(887, 1, "JTR", `Fixed Dead End Assembly JTR Tiang #${i + 1}`);
          } else {
            addVolume(885, 1, "JTR", `Suspension Assembly JTR LVTC Tiang #${i + 1}`);
          }
          // Arde JTR setiap tiang ujung atau berkala
          if (isEndpoint) {
            addVolume(layerMaterial === "Beton" ? 973 : 974, 1, "JTR", `Arde JTR dengan BC Tiang #${i + 1}`);
          }
        }
      }
    }
  }

  // ─── 6. PEKERJAAN UMUM, TAGGING, GAMBAR & KOMISIONING ─────────────────────
  if (totalPolesCount > 0 || totalGarduCount > 0) {
    // Tagging Koordinat Jaringan
    addVolume(1047, totalPolesCount + totalGarduCount, "JTM", `Tagging Koordinat (${totalPolesCount} tiang + ${totalGarduCount} gardu)`);

    if (options.includeTestingDocs) {
      // Gambar Revisi As Built Drawing HVS A4
      addVolume(1049, 1, "JTM", `Gambar Revisi As Built Drawing`);
      // Foto Dokumentasi
      addVolume(1053, 1, "JTM", `Foto Dokumentasi Glosy A4`);
    }

    if (options.includeCommissioning) {
      // Komisioning JTM (kms)
      if (totalJtmLengthM > 0) {
        const jtmKms = Number((totalJtmLengthM / 1000).toFixed(3));
        addVolume(1050, jtmKms, "JTM", `Komisioning & Testing JTM (${jtmKms} kms)`);
      }
      // Komisioning JTR (kms)
      if (totalJtrLengthM > 0) {
        const jtrKms = Number((totalJtrLengthM / 1000).toFixed(3));
        addVolume(1051, jtrKms, "JTR", `Komisioning & Testing JTR (${jtrKms} kms)`);
      }
      // Komisioning Gardu (unit)
      if (totalGarduCount > 0) {
        addVolume(1052, totalGarduCount, "GARDU", `Komisioning Gardu (${totalGarduCount} unit)`);
      }
    }
  }

  // Build sorted results
  const items: RabItemResult[] = [];
  let totalJtmItems = 0;
  let totalGarduItems = 0;
  let totalJtrItems = 0;
  let totalVolumeJtm = 0;
  let totalVolumeGardu = 0;
  let totalVolumeJtr = 0;

  const sortedRows = Array.from(rowVolumes.keys()).sort((a, b) => a - b);
  for (const row of sortedRows) {
    const catItem = RAB_CATALOG_BY_ROW.get(row)!;
    const vol = rowVolumes.get(row)!;

    if (vol.volJtm > 0) { totalJtmItems++; totalVolumeJtm += vol.volJtm; }
    if (vol.volGardu > 0) { totalGarduItems++; totalVolumeGardu += vol.volGardu; }
    if (vol.volJtr > 0) { totalJtrItems++; totalVolumeJtr += vol.volJtr; }

    items.push({
      row,
      section: catItem.section,
      subsection: catItem.subsection,
      description: catItem.description,
      satuan: catItem.satuan,
      volJtm: vol.volJtm,
      volGardu: vol.volGardu,
      volJtr: vol.volJtr,
      details: vol.details,
    });
  }

  return {
    items,
    warnings,
    totalJtmItems,
    totalGarduItems,
    totalJtrItems,
    totalVolumeJtm,
    totalVolumeGardu,
    totalVolumeJtr,
  };
}
