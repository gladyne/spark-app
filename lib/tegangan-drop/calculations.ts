import type {
  KpiSummary,
  LaporanDatasetRaw,
  MaterialTotals,
  PreparedNon,
  PreparedPoint,
  PreparedReport,
  PriorityLevel,
  ProposalItem,
  ProposalParams,
  ReportProposal,
  SeverityLevel,
} from "@/types/tegangan-drop";

export const NOMINAL_VOLTAGE = 220;
export const SPLN_LIMIT = 198;
export const CRIT_LIMIT = 180;
export const P1_LIMIT = 170;

const KX = 111320 * Math.cos((10.18 * Math.PI) / 180);
const KY = 110574;
const MAX_SEGMENT_DIST_M = 2000;

export const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  crit: "<180 V",
  warn: "180–197 V",
  ok: "≥198 V",
  na: "tidak ada nilai terukur",
};

export const SEVERITY_HEX: Record<SeverityLevel, string> = {
  crit: "#ef4444",
  warn: "#f59e0b",
  ok: "#22c55e",
  na: "#64748b",
};

export const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  0: "–",
  1: "P1",
  2: "P2",
  3: "P3",
};

export function sevOf(v: number | null | undefined): SeverityLevel {
  if (v == null) return "na";
  if (v < CRIT_LIMIT) return "crit";
  if (v < SPLN_LIMIT) return "warn";
  return "ok";
}

export function normCode(s: string | null | undefined): string {
  return String(s || "")
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/^([A-Z]+)0*(\d+)/, "$1$2");
}

export function fmtId(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "–";
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "–";
  return Math.round(n).toLocaleString("id-ID");
}

export function fmtShortDate(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate;
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}

export function prepLaporan(raw: LaporanDatasetRaw): {
  pts: PreparedPoint[];
  non: PreparedNon[];
  all: PreparedReport[];
} {
  const pts: PreparedPoint[] = raw.pts.map((p) => ({
    ...p,
    geo: true as const,
    sev: sevOf(p.v),
    drop: p.v == null ? null : ((p.v - NOMINAL_VOLTAGE) / NOMINAL_VOLTAGE) * 100,
    key: `${normCode(p.gardu)}|${p.jur}`,
  }));

  const non: PreparedNon[] = raw.non.map((n) => ({
    ...n,
    geo: false as const,
    sev: sevOf(n.v),
    drop: n.v == null ? null : ((n.v - NOMINAL_VOLTAGE) / NOMINAL_VOLTAGE) * 100,
  }));

  return { pts, non, all: [...pts, ...non] };
}

export function computeKpiSummary(
  pts: PreparedPoint[],
  all: PreparedReport[]
): KpiSummary {
  const measured = all.filter((r): r is PreparedReport & { v: number } => r.v != null);
  const below198 = measured.filter((r) => r.v < SPLN_LIMIT);
  const minVoltage = measured.length
    ? Math.min(...measured.map((r) => r.v))
    : null;
  const minDropPct =
    minVoltage == null
      ? null
      : ((NOMINAL_VOLTAGE - minVoltage) / NOMINAL_VOLTAGE) * 100;

  const garduSet = new Set(pts.map((p) => p.key.split("|")[0]).filter(Boolean));
  const penyulangSet = new Set(pts.map((p) => p.penyulang).filter(Boolean));

  return {
    totalReports: all.length,
    measuredCount: measured.length,
    below198Count: below198.length,
    geoCount: pts.length,
    affectedGarduCount: garduSet.size,
    affectedPenyulangCount: penyulangSet.size,
    minVoltage,
    minDropPct,
  };
}

export function sanitizeParams(params: ProposalParams): ProposalParams {
  return {
    span: Math.max(20, Number.isFinite(params.span) && params.span > 0 ? params.span : 50),
    gmin: Math.max(50, Number.isFinite(params.gmin) && params.gmin > 0 ? params.gmin : 300),
  };
}

export function proposeActions(
  pts: PreparedPoint[],
  non: PreparedNon[],
  rawParams: ProposalParams
): ReportProposal[] {
  const { span, gmin } = sanitizeParams(rawParams);
  const out: ReportProposal[] = [];

  const perKey = new Map<string, PreparedPoint[]>();
  for (const p of pts) {
    const arr = perKey.get(p.key);
    if (arr) arr.push(p);
    else perKey.set(p.key, [p]);
  }

  for (const p of pts) {
    const items: ProposalItem[] = [];
    const v = p.v;
    const need = p.need;

    if (need && need.type === "garsip") {
      items.push({
        k: "garsip",
        basis: "lap",
        unit: 1,
        jenis: "Gardu sisip",
        detail: need.text,
      });
    }
    if (need && need.type === "perluasan") {
      items.push({
        k: "perluasan",
        basis: "lap",
        gawang: need.gawang,
        jenis: "Perluasan JTR",
        detail: `±${need.gawang ?? 0} gawang (dari chat)`,
      });
    }

    const srDeret = /SR deret/i.test(p.catatan || "");
    if (
      !(need && need.type === "perluasan") &&
      p.dJtr > 50 &&
      ((v != null && v < SPLN_LIMIT) || srDeret)
    ) {
      const gawang = Math.ceil(p.dJtr / span);
      items.push({
        k: "perluasan",
        basis: "dat",
        gawang,
        jenis: "Perluasan JTR / ganti SR deret",
        detail:
          `${fmtInt(p.dJtr)} m dari JTR di GIS → ±${gawang} gawang` +
          (srDeret ? "; chat menyebut SR deret" : ""),
      });
    }

    if (
      !(need && need.type === "garsip") &&
      v != null &&
      v < CRIT_LIMIT &&
      p.dGardu != null &&
      p.dGardu >= gmin
    ) {
      items.push({
        k: "garsip",
        basis: "dat",
        unit: 1,
        jenis: "Evaluasi gardu sisip",
        detail: `${fmtInt(p.dGardu)} m dari gardu ${p.gardu}`,
      });
    }

    if (p.v3) {
      const phases: Array<[string, number]> = [
        ["R-N", p.v3.RN],
        ["S-N", p.v3.SN],
        ["T-N", p.v3.TN],
      ];
      phases.sort((a, b) => a[1] - b[1]);
      const lowest = phases[0];
      const highest = phases[phases.length - 1];
      items.push({
        k: "balancing",
        basis: "dat",
        key: p.key,
        jenis: "Penyeimbangan beban fasa",
        detail: `${lowest[0]} ${fmtId(lowest[1])} V vs ${highest[0]} ${fmtId(highest[1])} V; cek beban dan sambungan netral`,
      });
    }

    if (v != null && v < SPLN_LIMIT && p.jurM > 1000) {
      items.push({
        k: "uprating",
        basis: "dat",
        key: p.key,
        m: p.jurM,
        jenis: "Evaluasi uprating / pecah jurusan",
        detail: `jurusan ${p.gardu}-${p.jur} sepanjang ${fmtInt(p.jurM)} m menurut GIS`,
      });
    }

    const same = (perKey.get(p.key) || []).filter((x) => x.v != null).length;
    let prio: PriorityLevel =
      v == null ? 0 : v < P1_LIMIT ? 1 : v < SPLN_LIMIT ? 2 : 3;
    if (prio > 1 && same >= 2) prio = 1;

    if (items.length === 0) {
      items.push({
        k: "pantau",
        basis: "dat",
        jenis:
          v == null
            ? "Menunggu nilai tegangan"
            : "Pantau dan ukur ulang saat beban puncak",
        detail:
          v == null
            ? "Foto tidak ikut ter-export"
            : "Di atas ambang 180 V dan dekat JTR di GIS",
      });
    }

    out.push({
      p,
      id: p.id,
      loc: p.wilayah,
      v,
      prio,
      items,
      geo: true,
      sejurusan: same,
    });
  }

  for (const n of non) {
    const items: ProposalItem[] = [];
    if (n.need) {
      const t = n.need.type;
      items.push({
        k:
          t === "uprating"
            ? "uprating"
            : t === "perluasan"
              ? "perluasan"
              : "evaluasi",
        basis: "lap",
        gawang: n.need.gawang,
        jenis:
          t === "uprating"
            ? "Uprating JTR"
            : t === "perluasan"
              ? "Perluasan JTR"
              : "Evaluasi lanjutan",
        detail: n.need.text,
      });
    } else {
      items.push({
        k: "lengkapi",
        basis: "dat",
        jenis: "Lengkapi lokasi",
        detail: `Perlu: ${n.butuh}`,
      });
    }

    const v = n.v;
    const prio: PriorityLevel =
      v == null ? 0 : v < P1_LIMIT ? 1 : v < SPLN_LIMIT ? 2 : 3;
    out.push({
      p: n,
      id: n.id,
      loc: n.wilayah,
      v,
      prio,
      items,
      geo: false,
    });
  }

  return out;
}

export function computeMaterialTotals(
  proposals: ReportProposal[],
  rawParams: ProposalParams
): MaterialTotals {
  const { span } = sanitizeParams(rawParams);
  const T: MaterialTotals = {
    gawLap: 0,
    gawDat: 0,
    garLap: 0,
    garDat: 0,
    upDat: 0,
    upLap: false,
    balDat: 0,
    span,
  };

  const seenUp = new Set<string>();
  const seenBal = new Set<string>();

  for (const u of proposals) {
    for (const item of u.items) {
      if (item.k === "perluasan") {
        if (item.basis === "lap") T.gawLap += item.gawang || 0;
        else T.gawDat += item.gawang || 0;
      }
      if (item.k === "garsip") {
        if (item.basis === "lap") T.garLap += 1;
        else T.garDat += 1;
      }
      if (item.k === "uprating") {
        if (item.basis === "lap") {
          T.upLap = true;
        } else if (item.key && !seenUp.has(item.key)) {
          seenUp.add(item.key);
          T.upDat += item.m || 0;
        }
      }
      if (item.k === "balancing" && item.key && !seenBal.has(item.key)) {
        seenBal.add(item.key);
        T.balDat += 1;
      }
    }
  }

  return T;
}

export function nearKey(
  pts: PreparedPoint[],
  key: string,
  coords: [number, number][]
): boolean {
  if (coords.length === 0) return false;
  const mid = coords[Math.floor(coords.length / 2)];
  return pts.some(
    (p) =>
      p.key === key &&
      Math.hypot((mid[0] - p.lon) * KX, (mid[1] - p.lat) * KY) <=
        MAX_SEGMENT_DIST_M
  );
}

export interface StackedGroup {
  label: string;
  n: number;
  crit: number;
  warn: number;
  ok: number;
  na: number;
  vmin: number | null;
  rows: PreparedReport[];
}

export function groupStackedReports(
  rows: PreparedReport[],
  keyFn: (r: PreparedReport) => string | null
): StackedGroup[] {
  const map = new Map<string, StackedGroup>();
  for (const r of rows) {
    const label = keyFn(r);
    if (!label) continue;
    let group = map.get(label);
    if (!group) {
      group = {
        label,
        n: 0,
        crit: 0,
        warn: 0,
        ok: 0,
        na: 0,
        vmin: null,
        rows: [],
      };
      map.set(label, group);
    }
    group.n += 1;
    group[r.sev] += 1;
    group.rows.push(r);
    if (r.v != null) {
      group.vmin = group.vmin == null ? r.v : Math.min(group.vmin, r.v);
    }
  }

  return [...map.values()].sort(
    (a, b) => b.n - a.n || (a.vmin ?? 999) - (b.vmin ?? 999)
  );
}

export interface PenyulangRekapRow {
  penyulang: string;
  count: number;
  gardus: string[];
  vmin: number | null;
  vavg: number | null;
  points: PreparedPoint[];
}

export function buildPenyulangRekap(pts: PreparedPoint[]): PenyulangRekapRow[] {
  const map = new Map<
    string,
    { gardus: Set<string>; vs: number[]; points: PreparedPoint[] }
  >();
  for (const p of pts) {
    if (!p.penyulang) continue;
    let entry = map.get(p.penyulang);
    if (!entry) {
      entry = { gardus: new Set(), vs: [], points: [] };
      map.set(p.penyulang, entry);
    }
    entry.gardus.add(p.gardu);
    entry.points.push(p);
    if (p.v != null) entry.vs.push(p.v);
  }

  return [...map.entries()]
    .map(([penyulang, entry]) => {
      const vmin = entry.vs.length ? Math.min(...entry.vs) : null;
      const vavg = entry.vs.length
        ? entry.vs.reduce((acc, val) => acc + val, 0) / entry.vs.length
        : null;
      return {
        penyulang,
        count: entry.points.length,
        gardus: [...entry.gardus],
        vmin,
        vavg,
        points: entry.points,
      };
    })
    .sort(
      (a, b) =>
        b.count - a.count || (a.vmin ?? 999) - (b.vmin ?? 999)
    );
}

export interface GarduIndikasi {
  text: string;
  tone: "w" | "c" | "n";
}

export interface GarduRekapRow {
  key: string;
  gardu: string;
  penyulang: string;
  jur: string;
  ids: string[];
  count: number;
  vmin: number | null;
  maxDistGardu: number | null;
  jurM: number;
  indikasi: GarduIndikasi[];
  points: PreparedPoint[];
}

export function buildGarduRekap(pts: PreparedPoint[]): GarduRekapRow[] {
  const map = new Map<string, PreparedPoint[]>();
  for (const p of pts) {
    const arr = map.get(p.key);
    if (arr) arr.push(p);
    else map.set(p.key, [p]);
  }

  return [...map.entries()]
    .map(([key, es]) => {
      const e0 = es[0];
      const vs = es.filter((e) => e.v != null).map((e) => e.v as number);
      const indikasi: GarduIndikasi[] = [];
      if (e0.jurM > 1000) indikasi.push({ text: "Jurusan >1 km", tone: "w" });
      if (es.some((e) => e.dJtr > 50)) {
        indikasi.push({ text: "Titik >50 m dari JTR GIS", tone: "w" });
      }
      if (es.some((e) => e.v3 != null)) {
        indikasi.push({ text: "Fasa tidak seimbang", tone: "c" });
      }
      if (es.length > 1) {
        indikasi.push({ text: `${es.length} laporan satu jurusan`, tone: "c" });
      }
      if (es.some((e) => e.dGardu == null)) {
        indikasi.push({ text: "Gardu tidak ada di layer", tone: "n" });
      }

      const dGarduValues = es
        .map((e) => e.dGardu)
        .filter((d): d is number => d != null);

      return {
        key,
        gardu: e0.gardu,
        penyulang: e0.penyulang || "–",
        jur: e0.jur,
        ids: es.map((e) => e.id),
        count: es.length,
        vmin: vs.length ? Math.min(...vs) : null,
        maxDistGardu: dGarduValues.length ? Math.max(...dGarduValues) : null,
        jurM: e0.jurM,
        indikasi,
        points: es,
      };
    })
    .sort((a, b) => (a.vmin ?? 999) - (b.vmin ?? 999));
}
