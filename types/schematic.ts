export type SchematicNodeType =
  | "tiang-existing"
  | "tiang-rencana"
  | "tiang-tm"
  | "tiang-tr"
  | "gardu"
  | "box-app"
  | "kontramast"
  | "treck-schoor"
  | "druck-schoor";

export type SchematicEdgeType =
  | "kabel-existing"
  | "kabel-rencana"
  | "kabel-tm"
  | "kabel-tr";

export interface SchematicNode {
  id: string;
  type: SchematicNodeType;
  x: number;
  y: number;
  label?: string;
  kategori?: "TM" | "TR";

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
  rotationDeg?: number; // 0-360°
  offsetX?: number; // visual offset dari tiang/titik sambung (pixel)
  offsetY?: number; // visual offset dari tiang/titik sambung (pixel)

  // Atribut Box APP (kWh Meter)
  boxKva?: number; // misal 197 kVA, 41.5 kVA
  boxType?: string; // misal Pengukuran Tidak Langsung

  // Atribut Penopang Mekanis (Schoor)
  schoor?: {
    jenis: "Treck" | "Druck" | "Kontramast";
    tipe?: "Standar" | "Tolak Pinggang";
    rotation?: number; // derajat 0-360
  };
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

export type ObstacleType = "building" | "road" | "alley";

export interface SchematicObstacle {
  id: string;
  type: "obstacle";
  obstacleType: ObstacleType;
  // Posisi acuan (untuk bangunan: titik tengah / pusat rotasi; untuk jalan: offset atau titik awal)
  x: number;
  y: number;
  // Khusus Bangunan (Building / Roof):
  width?: number;        // default: 80px
  height?: number;       // default: 50px
  rotationDeg?: number;  // 0 - 360 derajat
  label?: string;        // e.g. "Ruko", "Gudang", "Rumah Warga"
  color?: string;        // preset / custom warna atap
  // Khusus Jalan (Road / Alley):
  points?: { x: number; y: number }[]; // multi-titik jalur jalan
  roadWidth?: number;    // ketebalan jalan (px)
}

export interface SchematicData {
  nodes: SchematicNode[];
  edges: SchematicEdge[];
  obstacles?: SchematicObstacle[];
  kop: SchematicKop;
  surveyData?: SurveyFormData;
}

export interface LegendaItem {
  id: string;
  simbolType: string;
  uraian: string;
  vol: number;
  sat: string;
}

// ─── Tipe Data Form Resmi Gambar Survei UP3 Kupang (A2) ───

export interface BebanJalurRow {
  id: string;
  nama: string;
  r?: string;
  s?: string;
  t?: string;
  n?: string;
}

export interface TeganganPangkalRow {
  id: string;
  nama: string;
  rn?: string;
  sn?: string;
  tn?: string;
  rs?: string;
  rt?: string;
  st?: string;
}

export interface SurveyPengukuranData {
  kodeGardu?: string;
  bebanJalurRows: BebanJalurRow[];
  teganganPangkalRows: TeganganPangkalRow[];
  kodeJtr?: string;
  jtrRn?: string;
  jtrSn?: string;
  jtrTn?: string;
  jtrJurusanRows?: BebanJalurRow[];
  teganganApp?: string;
  idpel?: string;
}

export interface SurveyDataJtm {
  namaPenyulang?: string;
  titikPengambilan?: string;
  konstruksiPengambilan?: string;
  konduktorPengambilan?: string;
  ukuranKonduktor?: string;
}

export interface SurveyDataGardu {
  kodeGardu?: string;
  kapasitasGardu?: string;
  bebanGardu?: string;
  tipePhbTr?: string;
}

export interface SurveyDataJtr {
  jurusanPengambilan?: string;
  konstruksiEksisting?: string;
  kabelPowerEksisting?: string;
  ukuranKabelPower?: string;
  jarakGarduKeLokasi?: string;
}

export interface SurveyPersetujuanCol {
  roleTitle: string; // e.g. "DISETUJUI"
  staffTitle: string; // e.g. "STAFF TEKNIK"
  nama: string;
}

export interface SurveyKopData {
  namaPekerjaan?: string;
  dataPelanggan?: string;
  alamat?: string;
  permohonan?: string;
  dayaLama?: string;
  dayaBaru?: string;
  keterangan?: string;
  titikKoordinat?: string;
  nomorGambar?: string;
  revisi?: string;
  halaman?: string;
  tanggal?: string;
  persetujuan: [SurveyPersetujuanCol, SurveyPersetujuanCol, SurveyPersetujuanCol];
}

export interface SurveyDokumentasiData {
  fotoBangunanPelanggan?: string;
  fotoTitikPengambilan?: string;
  fotoLokasiRencanaGarsip?: string;
}

export interface SurveyFormData {
  kop: SurveyKopData;
  jtm: SurveyDataJtm;
  gardu: SurveyDataGardu;
  jtr: SurveyDataJtr;
  pengukuran: SurveyPengukuranData;
  dokumentasi: SurveyDokumentasiData;
  customLogoUrl?: string;
  orientation?: "portrait" | "landscape";
  includeDokumentasi?: boolean;
}

export function getDefaultSurveyData(kop?: Partial<SchematicKop>): SurveyFormData {
  return {
    kop: {
      namaPekerjaan: kop?.namaPekerjaan || "",
      dataPelanggan: "",
      alamat: "",
      permohonan: "",
      dayaLama: "",
      dayaBaru: "",
      keterangan: "-",
      titikKoordinat: "",
      nomorGambar: kop?.nomorGambar || "",
      revisi: "",
      halaman: "1 / 1",
      tanggal: new Date().toLocaleDateString("id-ID"),
      persetujuan: [
        { roleTitle: "DISETUJUI", staffTitle: "STAFF TEKNIK", nama: "" },
        { roleTitle: "DISETUJUI", staffTitle: "STAFF TEKNIK", nama: "" },
        { roleTitle: "DISETUJUI", staffTitle: "STAFF TEKNIK", nama: "" },
      ],
    },
    jtm: {
      namaPenyulang: "",
      titikPengambilan: "",
      konstruksiPengambilan: "",
      konduktorPengambilan: "",
      ukuranKonduktor: "",
    },
    gardu: {
      kodeGardu: "",
      kapasitasGardu: "",
      bebanGardu: "",
      tipePhbTr: "",
    },
    jtr: {
      jurusanPengambilan: "",
      konstruksiEksisting: "",
      kabelPowerEksisting: "",
      ukuranKabelPower: "",
      jarakGarduKeLokasi: "",
    },
    pengukuran: {
      kodeGardu: "",
      bebanJalurRows: [
        { id: "bj_utama", nama: "BEBAN UTAMA", r: "", s: "", t: "", n: "" },
        { id: "bj_jurusan_1", nama: "JURUSAN", r: "", s: "", t: "", n: "" },
      ],
      teganganPangkalRows: [
        { id: "tp_utama", nama: "UTAMA", rn: "", sn: "", tn: "", rs: "", rt: "", st: "" },
        { id: "tp_jurusan_1", nama: "JURUSAN", rn: "", sn: "", tn: "", rs: "", rt: "", st: "" },
      ],
      kodeJtr: "",
      jtrRn: "",
      jtrSn: "",
      jtrTn: "",
      jtrJurusanRows: [
        { id: "jtr_jurusan_1", nama: "JURUSAN", r: "", s: "", t: "", n: "" },
      ],
      teganganApp: "",
      idpel: "",
    },
    dokumentasi: {
      fotoBangunanPelanggan: "",
      fotoTitikPengambilan: "",
      fotoLokasiRencanaGarsip: "",
    },
    orientation: "portrait",
    includeDokumentasi: false,
  };
}

