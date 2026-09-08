export type TiangMaterial = "Beton" | "Baja";
export type TiangTinggi = 7 | 9 | 11 | 12 | 13 | 14;
export type TiangKekuatan = 100 | 200 | 350; // daN
export type TiangPosisi = "Tumpu" | "Topang-Sudut" | "Ujung";

export type KonduktorSutmJenis = "AAAC" | "AAAC/S";
export type KonduktorSutmUkuran = 35 | 50 | 70 | 95 | 120 | 150 | 240;

export type KabelJenis =
  | "NFA2XSY-T"   // SKUTM
  | "NA2XSEYBY"  // SKTM
  | "NYY"        // Kabel NYY
  | "NFA2X-T"    // SKUTR LVTC
  | "NFA2X"      // Saluran Rumah
  | "NYFGbY";    // SKTR Tanah

export type TrafoFasa = "1 phs" | "3 phs";
export type TrafoKapasitas = 25 | 50 | 100 | 160 | 200 | 250 | 400 | 630 | 1000;

export type IsolatorJenis = "Porcelin" | "Polimer";
export type RabCategory = "JTM" | "GARDU" | "JTR";

export interface RabCatalogItem {
  row: number;
  section: string;
  subsection?: string;
  description: string;
  satuan: string;
}

export interface RabItemResult {
  row: number;
  section: string;
  subsection?: string;
  description: string;
  satuan: string;
  volJtm: number;    // Kolom F
  volGardu: number;  // Kolom G
  volJtr: number;    // Kolom H
  details: string[];
}

export interface RabWarning {
  id: string;
  assetType: string;
  message: string;
  layerLabel?: string;
  poleIdx?: number;
  recommendation?: string;
}

export interface RabSummary {
  items: RabItemResult[];
  warnings: RabWarning[];
  totalJtmItems: number;
  totalGarduItems: number;
  totalJtrItems: number;
  totalVolumeJtm: number;
  totalVolumeGardu: number;
  totalVolumeJtr: number;
}
