export type GarduConfig = {
  jenis: "Cantol" | "Portal";
  orientasi: "Horizontal" | "Vertikal";
  trafo: string;
};

export type SchoorConfig = {
  jenis: "Treck" | "Druck" | "Kontramast";
  rotation?: number; // override arah 0-359°, undefined = auto bisector
};

export type NetworkLayer = {
  id: number;
  label: string;
  poles: [number, number][];
  line: [number, number][];
  jenisJaringan: string;
  statusJaringan: string;
  offsetSide: number;
  jarakGawang: number;
  tinggiTiang: number;
  materialTiang: string;
  gardus: Record<number, GarduConfig>;
  schoors: Record<number, SchoorConfig>;
  konstruksiOverrides: Record<number, string>;
  autoSchoor: boolean;
  autoSchoorThreshold: number;
  autoSchoorJenis: SchoorConfig["jenis"];
};

export type HistoryState = {
  poles: [number, number][];
  line: [number, number][];
  gardus: Record<number, GarduConfig>;
  schoors: Record<number, SchoorConfig>;
};

export type Connection = {
  id: number;
  from: [number, number];
  to: [number, number];
};

export type PoleData = {
  jtrTypeShort: string;
  jtrTypeLong: string;
  jtmTypeShort: string;
  jtmTypeLong: string;
  kabelTypeShort: string;
  kabelTypeLong: string;
  skutmTypeShort: string;
  skutmTypeLong: string;
  isGrounded: boolean;
  angle: number;
};

// Informasi snap titik awal/akhir ke jaringan tersimpan.
// isMidLine membedakan apakah snap ke endpoint tiang (false/undefined)
// atau ke titik tengah di atas segmen garis (true = tee-off / cabang).
// poleIdx: index ke layer.poles[] untuk vertex snap (undefined jika mid-line).
export type SnapInfo = {
  layerId: number;
  label: string;
  isMidLine?: boolean;
  poleIdx?: number;
};

// State "klik pertama" dalam mode connect (tiang BRANCH).
export type ConnectFirstState = {
  layerId: number;
  poleIdx: number;
  coord: [number, number];
} | null;

// Junction topologis: dua tiang dari layer berbeda melebur ke satu koordinat.
// Tiang branch (branchPoleIdx) di-suppress dari render; tiang host (hostPoleIdx)
// mendapat indikator A3 ungu.
export type JunctionInfo = {
  id: number;
  hostLayerId: number;
  hostPoleIdx: number;
  branchLayerId: number;
  branchPoleIdx: number;
  hostCoord: [number, number];
};

// ─── Tipe data drag-to-connect ────────────────────────────────────────────────
export interface DragSource {
  layerId: number;      // ID layer (bisa ACTIVE_LAYER_ID atau savedLayer.id)
  label: string;
  pos: [number, number];
  poleIdx: number;
  isFromActiveLayer?: boolean;
}

export interface DragTarget {
  layerId: number;
  label: string;
  pos: [number, number];
  poleIdx: number;
  isFromActiveLayer?: boolean;
}
