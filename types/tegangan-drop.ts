export type SeverityLevel = "crit" | "warn" | "ok" | "na";

export interface PhaseVoltages {
  RN: number;
  SN: number;
  TN: number;
  RS: number;
  RT: number;
  ST: number;
}

export interface FieldNeed {
  type: "garsip" | "perluasan" | "uprating" | "evaluasi";
  gawang?: number;
  text: string;
}

export interface ReportPointRaw {
  id: string;
  tgl: string;
  jam: string;
  wilayah: string;
  kec: string;
  patokan: string;
  aduan: string | null;
  v: number | null;
  fasa: string;
  v3: PhaseVoltages | null;
  lat: number;
  lon: number;
  koord: string;
  penyulang: string;
  gardu: string;
  jur: string;
  kawat: string;
  dJtr: number;
  dGardu: number | null;
  jurM: number;
  garduTerdekat: string;
  dGT: number | null;
  catatan: string;
  need: FieldNeed | null;
}

export interface ReportNonRaw {
  id: string;
  tgl: string;
  wilayah: string;
  kec: string;
  patokan: string;
  aduan: string | null;
  v: number | null;
  vnote: string;
  status: string;
  penyulang: string | null;
  need: FieldNeed | null;
  butuh: string;
}

export interface LaporanDatasetRaw {
  meta: {
    periode: string;
    sumber: string;
  };
  pts: ReportPointRaw[];
  non: ReportNonRaw[];
}

export interface PreparedPoint extends ReportPointRaw {
  geo: true;
  sev: SeverityLevel;
  drop: number | null;
  key: string;
}

export interface PreparedNon extends ReportNonRaw {
  geo: false;
  sev: SeverityLevel;
  drop: number | null;
}

export type PreparedReport = PreparedPoint | PreparedNon;

// [coords [lon, lat][], gardu, kawat, jurusan, penyulang, panjang_m]
export type JtrSegment = [
  [number, number][],
  string,
  string,
  string,
  string,
  number,
];

// [lon, lat, kode, nama]
export type GarduPoint = [number, number, string, string];

export interface JtmDataset {
  penyulang: string[];
  // [lon, lat, kode, idxPenyulang]
  tiang: [number, number, string, number][];
}

export interface NetworkDataset {
  jtr: JtrSegment[];
  gardu: GarduPoint[];
  jtm: JtmDataset;
}

export type ProposalKind =
  | "garsip"
  | "perluasan"
  | "balancing"
  | "uprating"
  | "pantau"
  | "evaluasi"
  | "lengkapi";

export type ProposalBasis = "lap" | "dat";

export interface ProposalItem {
  k: ProposalKind;
  basis: ProposalBasis;
  jenis: string;
  detail: string;
  gawang?: number;
  unit?: number;
  key?: string;
  m?: number;
}

export type PriorityLevel = 0 | 1 | 2 | 3;

export interface ReportProposal {
  p: PreparedReport;
  id: string;
  loc: string;
  v: number | null;
  prio: PriorityLevel;
  items: ProposalItem[];
  geo: boolean;
  sejurusan?: number;
}

export interface ProposalParams {
  span: number;
  gmin: number;
}

export interface MaterialTotals {
  gawLap: number;
  gawDat: number;
  garLap: number;
  garDat: number;
  upDat: number;
  upLap: boolean;
  balDat: number;
  span: number;
}

export interface KpiSummary {
  totalReports: number;
  measuredCount: number;
  below198Count: number;
  geoCount: number;
  affectedGarduCount: number;
  affectedPenyulangCount: number;
  minVoltage: number | null;
  minDropPct: number | null;
}
