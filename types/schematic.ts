export type SchematicNodeType =
  | "tiang-existing"
  | "tiang-rencana"
  | "gardu"
  | "box-app"
  | "kontramast";

export type SchematicEdgeType = "kabel-existing" | "kabel-rencana";

export interface SchematicNode {
  id: string;
  type: SchematicNodeType;
  x: number;
  y: number;
  label?: string;

  // Atribut Tiang (Existing / Rencana)
  materialTiang?: "Beton" | "Baja";
  tinggiTiang?: number; // 7, 9, 11, 12, 13, 14
  kekuatanTiang?: number; // 100, 200, 350
  posisiTiang?: "Tumpu" | "Topang-Sudut" | "Ujung";
  konstruksi?: string; // C1, C2, C3, S1, S2, dsb.

  // Atribut Gardu Distribusi
  garduJenis?: "Portal" | "Cantol";
  trafoKva?: number; // 25, 50, 100, 160, 200, 250, 400, 630, 1000
  fasa?: "1 phs" | "3 phs";

  // Atribut Box APP (kWh Meter)
  boxKva?: number; // misal 197 kVA, 41.5 kVA
  boxType?: string; // misal Pengukuran Tidak Langsung

  // Atribut Kontramast / Penopang
  kontramastTipe?: "Standar" | "Tolak Pinggang";
}

export interface SchematicEdge {
  id: string;
  type: SchematicEdgeType;
  fromNodeId: string;
  toNodeId: string;
  label?: string;

  // Atribut Kabel / Konduktor
  jenisJaringan: string; // SUTM, SKUTM, SKTM, SUTR, SKUTR
  konduktorJenis?: "AAAC" | "AAAC/S" | "MVTIC" | "NA2XSEYBY";
  kondukturUkuran?: number; // 35, 50, 70, 95, 120, 150, 240, 300
  lengthM: number; // Panjang dalam meter (input manual pengguna)
}

export interface SchematicKop {
  namaPekerjaan: string;
  unit: string;
  lokasi?: string;
  disurveyOleh: string;
  tglSurvey: string;
  diperiksaOleh: string;
  tglPeriksa: string;
  disetujuiOleh: string;
  tglSetuju: string;
  nomorGambar: string;
  skala: string;
  ukuranKertas: string;
}

export interface SchematicData {
  nodes: SchematicNode[];
  edges: SchematicEdge[];
  kop: SchematicKop;
}

export interface LegendaItem {
  id: string;
  simbolType: string;
  uraian: string;
  vol: number;
  sat: string;
}
