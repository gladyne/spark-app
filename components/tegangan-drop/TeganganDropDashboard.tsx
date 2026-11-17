"use client";

import dynamic from "next/dynamic";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  LaporanDatasetRaw,
  NetworkDataset,
  PreparedPoint,
  PreparedReport,
} from "@/types/tegangan-drop";
import {
  buildGarduRekap,
  buildPenyulangRekap,
  computeKpiSummary,
  computeMaterialTotals,
  fmtId,
  fmtInt,
  fmtShortDate,
  prepLaporan,
  proposeActions,
  SEVERITY_HEX,
} from "@/lib/tegangan-drop/calculations";
import type { MapFocusRequest } from "./TeganganDropMap";
import {
  DailyStackedColumns,
  PriorityBadge,
  StackedHorizontalBars,
  VoltageChip,
} from "./TeganganDropCharts";

const TeganganDropMap = dynamic(() => import("./TeganganDropMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[620px] max-[900px]:h-[440px] w-full items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900 text-sky-300">
      <div className="text-sm font-semibold animate-pulse">
        Memuat komponen peta jaringan...
      </div>
    </div>
  ),
});

type SortColumn =
  | "id"
  | "tgl"
  | "wilayah"
  | "penyulang"
  | "gardu"
  | "v"
  | "drop"
  | "status"
  | "geo";

type SortDirection = "asc" | "desc";

const NAV_ITEMS = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "peta", label: "Peta" },
  { id: "rekap", label: "Gardu & penyulang" },
  { id: "usulan", label: "Usulan penanganan" },
  { id: "material", label: "Kebutuhan material" },
  { id: "data", label: "Daftar laporan" },
  { id: "catatan", label: "Catatan data" },
] as const;

function reportStatusText(r: PreparedReport): string {
  if (r.v != null) {
    if (r.v < 180) return "Kritis";
    if (r.v < 198) return "Di bawah batas";
    return "Normal";
  }
  if (!r.geo && r.status === "keluhan") return "Keluhan pelanggan";
  return "Belum ada nilai";
}

export default function TeganganDropDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [rawLaporan, setRawLaporan] = useState<LaporanDatasetRaw | null>(null);
  const [laporanLoading, setLaporanLoading] = useState(true);
  const [laporanError, setLaporanError] = useState<string | null>(null);

  const [network, setNetwork] = useState<NetworkDataset | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const [spanInput, setSpanInput] = useState(50);
  const [gminInput, setGminInput] = useState(300);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedNonId, setExpandedNonId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest | null>(
    null
  );

  const [sortCol, setSortCol] = useState<SortColumn>("id");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const petaSectionRef = useRef<HTMLElement | null>(null);

  const loadLaporan = useCallback(async () => {
    setLaporanLoading(true);
    setLaporanError(null);
    try {
      const res = await fetch("/api/tegangan-drop/laporan");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as LaporanDatasetRaw;
      setRawLaporan(data);
    } catch (err) {
      setLaporanError(
        err instanceof Error ? err.message : "Gagal memuat data laporan"
      );
    } finally {
      setLaporanLoading(false);
    }
  }, [router]);

  const loadNetwork = useCallback(async () => {
    setNetworkLoading(true);
    setNetworkError(null);
    try {
      const res = await fetch("/api/tegangan-drop/network");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as NetworkDataset;
      setNetwork(data);
    } catch (err) {
      setNetworkError(
        err instanceof Error ? err.message : "Gagal memuat layer GIS"
      );
    } finally {
      setNetworkLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      loadLaporan();
      loadNetwork();
    }
  }, [status, router, loadLaporan, loadNetwork]);

  const prepared = useMemo(
    () => (rawLaporan ? prepLaporan(rawLaporan) : null),
    [rawLaporan]
  );

  const kpi = useMemo(
    () =>
      prepared ? computeKpiSummary(prepared.pts, prepared.all) : null,
    [prepared]
  );

  const proposals = useMemo(() => {
    if (!prepared) return [];
    return proposeActions(prepared.pts, prepared.non, {
      span: spanInput,
      gmin: gminInput,
    });
  }, [prepared, spanInput, gminInput]);

  const sortedProposals = useMemo(() => {
    return [...proposals].sort(
      (a, b) => (a.prio || 9) - (b.prio || 9) || (a.v ?? 999) - (b.v ?? 999)
    );
  }, [proposals]);

  const materialTotals = useMemo(
    () =>
      computeMaterialTotals(proposals, {
        span: spanInput,
        gmin: gminInput,
      }),
    [proposals, spanInput, gminInput]
  );

  const penyulangRekap = useMemo(
    () => (prepared ? buildPenyulangRekap(prepared.pts) : []),
    [prepared]
  );

  const garduRekap = useMemo(
    () => (prepared ? buildGarduRekap(prepared.pts) : []),
    [prepared]
  );

  const sidebarReports = useMemo(() => {
    if (!prepared) return { geo: [], non: [] };
    const geo = [...prepared.pts].sort((a, b) => (a.v ?? 999) - (b.v ?? 999));
    const non = [...prepared.non].sort((a, b) => (a.v ?? 999) - (b.v ?? 999));
    return { geo, non };
  }, [prepared]);

  const sortedAllReports = useMemo(() => {
    if (!prepared) return [];
    const list = [...prepared.all];
    const dir = sortDir === "asc" ? 1 : -1;

    list.sort((a, b) => {
      switch (sortCol) {
        case "id":
          return a.id.localeCompare(b.id, "id", { numeric: true }) * dir;
        case "tgl":
          return a.tgl.localeCompare(b.tgl) * dir;
        case "wilayah":
          return a.wilayah.localeCompare(b.wilayah, "id") * dir;
        case "penyulang":
          return (
            (a.penyulang || "zzz").localeCompare(b.penyulang || "zzz", "id") *
            dir
          );
        case "gardu": {
          const ga = a.geo ? `${a.gardu} ${a.jur}` : "zzz";
          const gb = b.geo ? `${b.gardu} ${b.jur}` : "zzz";
          return ga.localeCompare(gb, "id") * dir;
        }
        case "v":
          return ((a.v ?? 999) - (b.v ?? 999)) * dir;
        case "drop":
          return ((a.drop ?? 999) - (b.drop ?? 999)) * dir;
        case "status":
          return reportStatusText(a).localeCompare(reportStatusText(b), "id") * dir;
        case "geo":
          return (Number(b.geo) - Number(a.geo)) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [prepared, sortCol, sortDir]);

  const focusPointsOnMap = useCallback((points: PreparedPoint[]) => {
    if (points.length === 0) return;
    petaSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    if (points.length === 1) {
      setSelectedId(points[0].id);
    }
    setFocusRequest({ points, nonce: Date.now() + Math.random() });
  }, []);

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  if (status === "loading" || (status === "authenticated" && laporanLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sky-400">
        <div className="text-base font-semibold animate-pulse">
          Memuat Dashboard Tegangan Drop...
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  if (laporanError || !prepared || !kpi || !rawLaporan) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-slate-200">
        <p className="text-sm text-red-300">
          Gagal memuat data laporan: {laporanError || "Data kosong"}
        </p>
        <button
          type="button"
          onClick={loadLaporan}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 cursor-pointer"
        >
          Muat Ulang
        </button>
      </div>
    );
  }

  const daysCount = new Set(prepared.all.map((r) => r.tgl)).size;
  const cab = (gawang: number) =>
    Math.ceil(gawang * materialTotals.span * 1.05);
  const totalGawang = materialTotals.gawLap + materialTotals.gawDat;
  const totalGarsip = materialTotals.garLap + materialTotals.garDat;

  const dataNotes = [
    "Satu segmen JTR berlabel KT067 jurusan D (±1,3 km) berada ±15 km dari titik lainnya (sekitar −10,2300; 123,5078). Segmen JTR yang jaraknya > 2.000 m dari titik laporan dikeluarkan dari peta dan tidak dihitung pada panjang jurusan; label segmen ini perlu dikoreksi di GIS.",
    "Penyulang di layer gardu berbeda dengan layer JTR pada KT404 (OEBELO vs OESAPA), KT067 (OEBUFU vs BANDARA), dan KU053 (WALIKOTA vs tiang TM OESAPA). Belum diverifikasi lapangan. Gardu KT171 juga belum ditemukan pada layer gardu.",
    "Ambang 50 m (jarak titik ke JTR GIS), 300 m (jarak minimum gardu sisip), dan 1 km (panjang jurusan) adalah penyaring awal untuk prioritas survei, bukan standar PLN.",
    "Nilai tegangan dibaca dari foto kWh meter atau tang ampere. Dua angka agak silau: Jl Flobamora (±173,9 V) dan Liliba Lakbanu (±181,5 V); mohon konfirmasi petugas.",
    "Laporan Jl Hans Kapitan adalah keluhan pelanggan ±180 V berstatus APKT batal dan tidak terukur, sehingga tidak masuk hitungan terukur di bawah 198 V. Laporan Kayu Putih (215 V, biasanya 232 V) berasal dari chat tanpa foto.",
    "Batas bawah tegangan 198 V = −10% dari nominal 220 V (SPLN). Kategori kritis < 180 V adalah penanda internal dashboard ini. Foto E04 (Bello) bertanggal 22 Okt dan dicatat pada rekap 30 Okt.",
    "Titik berjarak > 50 m dari JTR di GIS umumnya mengindikasikan tarikan SR deret atau perluasan JTR yang belum tercatat di GIS; jarak garis lurus lebih pendek daripada panjang riil tarikan kabel.",
  ];

  const sortArrow = (col: SortColumn) => {
    if (sortCol !== col) return "⇅";
    return sortDir === "asc" ? "▲" : "▼";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Bar matching SPARK */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2.5 cursor-pointer text-left"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-amber-500 text-base shadow">
                ⚡
              </span>
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-blue-300 to-amber-200 bg-clip-text text-transparent">
                SPARK
              </span>
            </button>
            <nav aria-label="Navigasi aplikasi" className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-blue-500/50 hover:text-white cursor-pointer"
              >
                📁 Dashboard
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-lg border border-blue-500/30 bg-blue-500/15 px-2.5 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/25 cursor-pointer"
              >
                🗺️ Peta GIS
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300">
              👤 {session?.user?.name}
            </span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/25 cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b-4 border-amber-500 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="mx-auto max-w-[1280px] px-5 py-6">
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-white">
            Dashboard Tegangan Drop · ULP Kupang
          </h1>
          <p className="mt-1.5 max-w-[70ch] text-sm text-slate-300">
            Rekap laporan tegangan drop dari grup lapangan, disandingkan dengan
            jaringan gardu, JTM, dan JTR, beserta usulan penanganan dan
            kebutuhan material.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/25 bg-white/5 px-3 py-0.5 text-xs text-slate-100">
              Periode laporan {rawLaporan.meta.periode}
            </span>
            <span className="rounded-full border border-white/25 bg-white/5 px-3 py-0.5 text-xs text-slate-100">
              Sumber: grup WA eviden + GIS ULP Kupang
            </span>
            <span className="rounded-full border border-amber-400 bg-amber-500 px-3 py-0.5 text-xs font-semibold text-slate-950">
              Draf untuk review · belum diverifikasi lapangan
            </span>
          </div>
        </div>
      </div>

      {/* Sticky Anchor Navigation */}
      <nav
        aria-label="Bagian halaman"
        className="sticky top-0 z-[900] border-b border-slate-800 bg-slate-900/95 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-5">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="whitespace-nowrap border-b-[3px] border-transparent px-3.5 py-2.5 text-[13px] font-semibold text-slate-300 transition-colors hover:border-sky-400 hover:text-sky-300 focus-visible:border-sky-400 focus-visible:text-sky-300 focus-visible:outline-none"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 pt-6 pb-14">
        {/* 1. KPI Tiles */}
        <section id="ringkasan" className="scroll-mt-14">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-slate-800 border-t-[3px] border-t-slate-600 bg-slate-900 p-4">
              <strong className="block font-mono text-[28px] leading-tight font-semibold text-white tabular-nums">
                {kpi.totalReports}
              </strong>
              <span className="text-xs text-slate-400">laporan masuk</span>
            </div>

            <div className="rounded-xl border border-slate-800 border-t-[3px] border-t-red-500 bg-slate-900 p-4">
              <strong className="block font-mono text-[28px] leading-tight font-semibold text-red-400 tabular-nums">
                {kpi.below198Count}/{kpi.measuredCount}
              </strong>
              <span className="text-xs text-slate-400">
                terukur di bawah 198 V
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 border-t-[3px] border-t-sky-500 bg-slate-900 p-4">
              <strong className="block font-mono text-[28px] leading-tight font-semibold text-sky-300 tabular-nums">
                {kpi.geoCount}
              </strong>
              <span className="text-xs text-slate-400">titik berkoordinat</span>
            </div>

            <div className="rounded-xl border border-slate-800 border-t-[3px] border-t-slate-600 bg-slate-900 p-4">
              <strong className="block font-mono text-[28px] leading-tight font-semibold text-white tabular-nums">
                {kpi.affectedGarduCount}
              </strong>
              <span className="text-xs text-slate-400">gardu terdampak</span>
            </div>

            <div className="rounded-xl border border-slate-800 border-t-[3px] border-t-slate-600 bg-slate-900 p-4">
              <strong className="block font-mono text-[28px] leading-tight font-semibold text-white tabular-nums">
                {kpi.affectedPenyulangCount}
              </strong>
              <span className="text-xs text-slate-400">
                penyulang terdampak
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 border-t-[3px] border-t-red-500 bg-slate-900 p-4">
              <strong className="block font-mono text-[28px] leading-tight font-semibold text-red-400 tabular-nums">
                {fmtId(kpi.minVoltage)}
              </strong>
              <span className="text-xs text-slate-400">
                V terendah (−{fmtId(kpi.minDropPct)}%)
              </span>
            </div>
          </div>
        </section>

        {/* 2. Peta + Daftar Samping */}
        <section id="peta" ref={petaSectionRef} className="scroll-mt-14">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold text-white">
              Peta sebaran dan jurusan terdampak
            </h2>
            <p className="max-w-[80ch] text-[13px] text-slate-400">
              Jurusan JTR yang melayani titik laporan diberi warna sesuai
              tegangan terendah. Klik titik atau daftar di samping untuk detail.
            </p>
          </div>

          <div className="grid grid-cols-1 min-[901px]:grid-cols-[minmax(0,1fr)_360px] gap-3.5 items-start">
            <TeganganDropMap
              pts={prepared.pts}
              network={network}
              networkLoading={networkLoading}
              networkError={networkError}
              onRetryNetwork={loadNetwork}
              proposals={proposals}
              selectedId={selectedId}
              onSelectPoint={setSelectedId}
              focusRequest={focusRequest}
            />

            <div>
              <div className="mb-2.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5">
                <p className="text-xs text-slate-300">
                  Warna titik:{" "}
                  <strong className="text-red-400">&lt;180 V</strong> ·{" "}
                  <strong className="text-amber-400">180–197 V</strong> ·{" "}
                  <strong className="text-emerald-400">≥198 V</strong> ·{" "}
                  <strong className="text-slate-400">belum ada nilai</strong>.
                  Heatmap berbobot besar drop. {prepared.non.length} laporan
                  lain belum berkoordinat dan tidak tampil di peta.
                </p>
                <div
                  className="mt-2 mb-1 h-2 rounded"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(255,224,138,0.25), #ffe08a 25%, #e07b00 60%, #c62828)",
                  }}
                />
                <div className="flex justify-between font-mono text-[11px] text-slate-400">
                  <span>drop kecil</span>
                  <span>−20%</span>
                  <span>≥ −27% (60 V)</span>
                </div>
              </div>

              <div
                aria-label="Daftar laporan"
                className="flex max-h-[520px] max-[900px]:max-h-none flex-col gap-2 overflow-y-auto pr-0.5"
              >
                {sidebarReports.geo.map((p) => {
                  const isSelected = selectedId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => focusPointsOnMap([p])}
                      className={`grid w-full grid-cols-[6px_1fr_auto] items-stretch gap-2.5 rounded-lg border bg-slate-900 py-2 pr-3 text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400 ${
                        isSelected
                          ? "border-sky-400 ring-1 ring-sky-400"
                          : "border-slate-800 hover:border-sky-500/70"
                      }`}
                    >
                      <span
                        className="-my-2 rounded-l-lg"
                        style={{ backgroundColor: SEVERITY_HEX[p.sev] }}
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-slate-100">
                          {p.id} · {p.wilayah}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {p.patokan || p.kec} · {p.gardu} jur. {p.jur}
                        </span>
                      </span>
                      <span className="text-right font-mono text-base font-semibold text-white whitespace-nowrap">
                        {p.v == null ? "–" : fmtId(p.v)}
                        <small className="block text-[11px] font-normal text-slate-400">
                          {p.drop == null ? "belum ada nilai" : `${fmtId(p.drop)}%`}
                        </small>
                      </span>
                    </button>
                  );
                })}

                <div className="mt-1 pt-2 border-t border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Belum berkoordinat ({sidebarReports.non.length} laporan · tidak di peta)
                </div>

                {sidebarReports.non.map((n) => {
                  const isExpanded = expandedNonId === n.id;
                  return (
                    <div
                      key={n.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden"
                    >
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedNonId((prev) =>
                            prev === n.id ? null : n.id
                          )
                        }
                        className="grid w-full grid-cols-[6px_1fr_auto] items-stretch gap-2.5 py-2 pr-3 text-left hover:bg-slate-800/60 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
                      >
                        <span
                          className="-my-2"
                          style={{ backgroundColor: SEVERITY_HEX[n.sev] }}
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-slate-200">
                            <span>
                              {n.id} · {n.wilayah}
                            </span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                              Tanpa koordinat
                            </span>
                          </span>
                          <span className="block truncate text-xs text-slate-400">
                            {n.patokan || (n.kec !== "-" ? n.kec : "Lokasi perlu dilengkapi")}
                          </span>
                        </span>
                        <span className="text-right font-mono text-base font-semibold text-white whitespace-nowrap">
                          {n.v == null ? "–" : fmtId(n.v)}
                          <small className="block text-[11px] font-normal text-slate-400">
                            {n.drop == null ? n.status : `${fmtId(n.drop)}%`}
                          </small>
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300 space-y-1">
                          {n.penyulang && (
                            <div>
                              <span className="text-slate-400">Penyulang: </span>
                              {n.penyulang}
                            </div>
                          )}
                          {n.aduan && (
                            <div>
                              <span className="text-slate-400">No. aduan: </span>
                              <span className="font-mono">{n.aduan}</span>
                            </div>
                          )}
                          {n.vnote && (
                            <div>
                              <span className="text-slate-400">Catatan: </span>
                              {n.vnote}
                            </div>
                          )}
                          {n.need && (
                            <div>
                              <span className="text-slate-400">Usulan lapangan: </span>
                              {n.need.text}
                            </div>
                          )}
                          <div>
                            <span className="text-slate-400">Tindak lanjut data: </span>
                            {n.butuh}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Grafik Rekap Wilayah & Harian */}
        <section id="grafik">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Laporan per wilayah
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Seluruh {prepared.all.length} laporan, termasuk yang belum
                berkoordinat.
              </p>
              <StackedHorizontalBars
                rows={prepared.all}
                keyFn={(r) =>
                  r.wilayah + (r.kec && r.kec !== "-" ? ` · ${r.kec}` : "")
                }
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Laporan per hari
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Kumulatif {prepared.all.length} laporan dalam {daysCount} hari
                aktif.
              </p>
              <DailyStackedColumns rows={prepared.all} />
            </div>
          </div>
        </section>

        {/* 4. Rekap Gardu & Penyulang + Per Kecamatan */}
        <section id="rekap" className="scroll-mt-14">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold text-white">
              Rekap gardu dan penyulang terdampak
            </h2>
            <p className="max-w-[80ch] text-[13px] text-slate-400">
              Hanya titik berkoordinat yang bisa dipetakan ke gardu. Klik baris
              untuk menyorot jurusannya di peta.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Per penyulang
              </h3>
              <div className="mt-2.5 overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-[12.5px]">
                  <thead>
                    <tr className="border-b-2 border-slate-800 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="px-2.5 py-2">Penyulang</th>
                      <th className="px-2.5 py-2 text-right">Lap.</th>
                      <th className="px-2.5 py-2">Gardu</th>
                      <th className="px-2.5 py-2 text-right">V min</th>
                      <th className="px-2.5 py-2 text-right">V rata²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {penyulangRekap.map((row) => (
                      <tr
                        key={row.penyulang}
                        tabIndex={0}
                        role="button"
                        title="Lihat di peta"
                        onClick={() => focusPointsOnMap(row.points)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            focusPointsOnMap(row.points);
                          }
                        }}
                        className="border-b border-slate-800/80 hover:bg-slate-800/60 focus-visible:outline-2 focus-visible:outline-sky-400 cursor-pointer"
                      >
                        <td className="px-2.5 py-2 font-semibold text-white">
                          {row.penyulang}
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                          {row.count}
                        </td>
                        <td className="px-2.5 py-2 text-slate-300">
                          {row.gardus.join(", ")}
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <VoltageChip v={row.vmin} />
                        </td>
                        <td className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-300">
                          {row.vavg == null ? "–" : fmtId(row.vavg)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Per kecamatan
              </h3>
              <StackedHorizontalBars
                rows={prepared.all}
                keyFn={(r) => (r.kec && r.kec !== "-" ? r.kec : null)}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Gardu terdampak
            </h3>
            <div className="mt-2.5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-2.5 py-2">Gardu</th>
                    <th className="px-2.5 py-2">Penyulang</th>
                    <th className="px-2.5 py-2">Jurusan</th>
                    <th className="px-2.5 py-2 text-right">Lap.</th>
                    <th className="px-2.5 py-2 text-right">V min</th>
                    <th className="px-2.5 py-2 text-right">Titik–gardu (m)</th>
                    <th className="px-2.5 py-2 text-right">Panjang jurusan (m)</th>
                    <th className="px-2.5 py-2">Indikasi</th>
                    <th className="px-2.5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {garduRekap.map((row) => (
                    <tr
                      key={row.key}
                      tabIndex={0}
                      role="button"
                      onClick={() => focusPointsOnMap(row.points)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          focusPointsOnMap(row.points);
                        }
                      }}
                      className="border-b border-slate-800/80 hover:bg-slate-800/60 focus-visible:outline-2 focus-visible:outline-sky-400 cursor-pointer"
                    >
                      <td className="px-2.5 py-2">
                        <strong className="text-white">{row.gardu}</strong>
                        <div className="text-xs text-slate-400">
                          {row.ids.join(", ")}
                        </div>
                      </td>
                      <td className="px-2.5 py-2 text-slate-300">
                        {row.penyulang}
                      </td>
                      <td className="px-2.5 py-2 font-mono text-slate-200">
                        {row.jur}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                        {row.count}
                      </td>
                      <td className="px-2.5 py-2 text-right">
                        <VoltageChip v={row.vmin} />
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-300">
                        {row.maxDistGardu == null
                          ? "–"
                          : fmtInt(row.maxDistGardu)}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-300">
                        {fmtInt(row.jurM)}
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="flex flex-wrap gap-1">
                          {row.indikasi.map((ind) => (
                            <span
                              key={ind.text}
                              className={`inline-block rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap ${
                                ind.tone === "c"
                                  ? "border-red-500/60 text-red-300"
                                  : ind.tone === "w"
                                    ? "border-amber-500/60 text-amber-300"
                                    : "border-slate-700 text-slate-300"
                              }`}
                            >
                              {ind.text}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2.5 py-2 font-semibold text-sky-400 whitespace-nowrap">
                        Peta →
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 5. Usulan Penanganan */}
        <section id="usulan" className="scroll-mt-14">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold text-white">
              Usulan penanganan per lokasi
            </h2>
            <p className="max-w-[80ch] text-[13px] text-slate-400">
              Usulan awal untuk bahan survei, bukan keputusan desain.{" "}
              <span className="inline-block rounded bg-sky-600 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">
                Lapangan
              </span>{" "}
              = disebut tim di chat.{" "}
              <span className="inline-block rounded border border-slate-500 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-300">
                Data
              </span>{" "}
              = indikasi dari perbandingan titik dengan GIS.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-2.5 py-2">Prior.</th>
                    <th className="px-2.5 py-2">Lokasi</th>
                    <th className="px-2.5 py-2 text-right">V</th>
                    <th className="px-2.5 py-2">Usulan dan dasar</th>
                    <th className="px-2.5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {sortedProposals.map((u) => {
                    const subParts = [
                      u.p.kec && u.p.kec !== "-" ? `Kec. ${u.p.kec}` : "",
                      u.p.patokan,
                      u.p.geo
                        ? `${u.p.gardu} jur. ${u.p.jur} · ${u.p.penyulang}`
                        : "belum berkoordinat",
                    ].filter(Boolean);

                    return (
                      <tr
                        key={u.id}
                        tabIndex={u.geo ? 0 : undefined}
                        role={u.geo ? "button" : undefined}
                        onClick={() => {
                          if (u.p.geo) focusPointsOnMap([u.p]);
                        }}
                        onKeyDown={(e) => {
                          if (u.p.geo && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            focusPointsOnMap([u.p]);
                          }
                        }}
                        className={`border-b border-slate-800/80 align-top ${
                          u.geo
                            ? "hover:bg-slate-800/60 focus-visible:outline-2 focus-visible:outline-sky-400 cursor-pointer"
                            : ""
                        }`}
                      >
                        <td className="px-2.5 py-2.5">
                          <PriorityBadge prio={u.prio} />
                        </td>
                        <td className="px-2.5 py-2.5">
                          <strong className="text-white">
                            {u.id} · {u.loc}
                          </strong>
                          <div className="text-xs text-slate-400">
                            {subParts.join(" · ")}
                          </div>
                        </td>
                        <td className="px-2.5 py-2.5 text-right">
                          <VoltageChip v={u.v} />
                        </td>
                        <td className="px-2.5 py-2.5 space-y-1.5">
                          {u.items.map((item, idx) => (
                            <div key={`${u.id}-${idx}`}>
                              <strong className="text-slate-100">
                                {item.jenis}
                              </strong>
                              <span
                                className={`ml-1.5 inline-block rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${
                                  item.basis === "lap"
                                    ? "bg-sky-600 text-white"
                                    : "border border-slate-600 text-slate-300"
                                }`}
                              >
                                {item.basis === "lap" ? "Lapangan" : "Data"}
                              </span>
                              <div className="text-xs text-slate-400">
                                {item.detail}
                              </div>
                            </div>
                          ))}
                        </td>
                        <td className="px-2.5 py-2.5 font-semibold text-sky-400 whitespace-nowrap">
                          {u.geo ? "Peta →" : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 6. Kebutuhan Material */}
        <section id="material" className="scroll-mt-14">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold text-white">
              Rekap kebutuhan material (indikatif)
            </h2>
            <p className="max-w-[80ch] text-[13px] text-slate-400">
              Total merupakan batas atas jika seluruh usulan dilaksanakan.
              Perluasan JTR dan gardu sisip dapat saling menggantikan pada
              beberapa titik, sehingga angka akhir ditentukan setelah survei.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <div className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-800 bg-slate-950/60 px-3.5 py-3">
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                <span>Panjang gawang (m)</span>
                <input
                  type="number"
                  min={20}
                  max={100}
                  step={5}
                  value={spanInput}
                  onChange={(e) => setSpanInput(Number(e.target.value) || 50)}
                  className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-sky-400"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-slate-300">
                <span>Jarak titik–gardu minimum untuk usulan gardu sisip (m)</span>
                <input
                  type="number"
                  min={100}
                  max={1000}
                  step={50}
                  value={gminInput}
                  onChange={(e) => setGminInput(Number(e.target.value) || 300)}
                  className="w-28 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-sky-400"
                />
              </label>

              <span className="text-xs text-slate-400">
                Ubah angka, tabel usulan dan kebutuhan material ikut dihitung
                ulang.
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="px-2.5 py-2">Material / pekerjaan</th>
                    <th className="px-2.5 py-2">Satuan</th>
                    <th className="px-2.5 py-2 text-right">Usulan lapangan</th>
                    <th className="px-2.5 py-2 text-right">
                      Tambahan indikasi data
                    </th>
                    <th className="px-2.5 py-2 text-right">Total maksimum</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-800/80">
                    <td className="px-2.5 py-2.5">
                      <strong className="text-white">Tiang beton JTR</strong>
                      <div className="text-xs text-slate-400">
                        Satu tiang per gawang perluasan
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5">buah</td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {fmtInt(materialTotals.gawLap)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {fmtInt(materialTotals.gawDat)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono font-bold text-white tabular-nums">
                      {fmtInt(totalGawang)}
                    </td>
                  </tr>

                  <tr className="border-b border-slate-800/80">
                    <td className="px-2.5 py-2.5">
                      <strong className="text-white">Kabel twisted JTR</strong>
                      <div className="text-xs text-slate-400">
                        Gawang × {materialTotals.span} m + 5%
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5">m</td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {fmtInt(cab(materialTotals.gawLap))}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {fmtInt(cab(materialTotals.gawDat))}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono font-bold text-white tabular-nums">
                      {fmtInt(cab(totalGawang))}
                    </td>
                  </tr>

                  <tr className="border-b border-slate-800/80">
                    <td className="px-2.5 py-2.5">
                      <strong className="text-white">
                        Set aksesori konstruksi JTR
                      </strong>
                      <div className="text-xs text-slate-400">
                        Klem, strap, lengkapan tiang, grounding
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5">set</td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {fmtInt(materialTotals.gawLap)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {fmtInt(materialTotals.gawDat)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono font-bold text-white tabular-nums">
                      {fmtInt(totalGawang)}
                    </td>
                  </tr>

                  <tr className="border-b border-slate-800/80">
                    <td className="px-2.5 py-2.5">
                      <strong className="text-white">
                        Gardu sisip (trafo distribusi + paket konstruksi)
                      </strong>
                      <div className="text-xs text-slate-400">
                        Kapasitas trafo ditentukan survei beban
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5">unit</td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {fmtInt(materialTotals.garLap)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {fmtInt(materialTotals.garDat)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono font-bold text-white tabular-nums">
                      {fmtInt(totalGarsip)}
                    </td>
                  </tr>

                  <tr className="border-b border-slate-800/80">
                    <td className="px-2.5 py-2.5">
                      <strong className="text-white">
                        Uprating JTR (35 → 70 mm² dan evaluasi jurusan panjang)
                      </strong>
                      <div className="text-xs text-slate-400">
                        Batas atas = seluruh panjang jurusan di GIS; umumnya
                        hanya sebagian
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5">m</td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {materialTotals.upLap ? "35→70 mm² (ukur survei)" : "–"}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {materialTotals.upDat
                        ? `≤ ${fmtInt(materialTotals.upDat)}`
                        : "–"}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono font-bold text-white tabular-nums">
                      {materialTotals.upDat
                        ? `≤ ${fmtInt(materialTotals.upDat)}${materialTotals.upLap ? " + 35→70 mm² lap." : ""}`
                        : materialTotals.upLap
                          ? "ukur survei"
                          : "–"}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-2.5 py-2.5">
                      <strong className="text-white">
                        Penyeimbangan beban fasa
                      </strong>
                      <div className="text-xs text-slate-400">
                        Pekerjaan pindah sambungan antar fasa, tanpa material
                        utama
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5">jurusan</td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      –
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                      {fmtInt(materialTotals.balDat)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-mono font-bold text-white tabular-nums">
                      {fmtInt(materialTotals.balDat)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              Kabel dihitung gawang × panjang gawang × 1,05 (cadangan 5%). Satu
              gawang = satu tiang baru. Penampang kabel, jenis tiang, kapasitas
              trafo, dan harga mengikuti standar konstruksi PLN dan hasil
              survei; harga dan RAB tidak dihitung di halaman ini.
            </p>
          </div>
        </section>

        {/* 7. Daftar Laporan Lengkap (bisa diurutkan) */}
        <section id="data" className="scroll-mt-14">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold text-white">
              Daftar seluruh laporan
            </h2>
            <p className="max-w-[80ch] text-[13px] text-slate-400">
              {prepared.all.length} laporan, termasuk {prepared.non.length} yang
              belum punya koordinat. Klik judul kolom untuk mengurutkan.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b-2 border-slate-800 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {(
                      [
                        ["id", "ID", false],
                        ["tgl", "Tanggal", false],
                        ["wilayah", "Wilayah", false],
                        ["penyulang", "Penyulang", false],
                        ["gardu", "Gardu", false],
                        ["v", "V", true],
                        ["drop", "Drop", true],
                        ["status", "Status", false],
                      ] as Array<[SortColumn, string, boolean]>
                    ).map(([col, label, numeric]) => (
                      <th
                        key={col}
                        aria-sort={
                          sortCol === col
                            ? sortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className={`px-2.5 py-2 ${numeric ? "text-right" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort(col)}
                          className="inline-flex items-center gap-1 uppercase hover:text-sky-300 focus-visible:text-sky-300 focus-visible:outline-none cursor-pointer"
                        >
                          <span>{label}</span>
                          <span className="text-[10px] opacity-75">
                            {sortArrow(col)}
                          </span>
                        </button>
                      </th>
                    ))}
                    <th className="px-2.5 py-2 text-right">No. aduan</th>
                    <th
                      aria-sort={
                        sortCol === "geo"
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="px-2.5 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("geo")}
                        className="inline-flex items-center gap-1 uppercase hover:text-sky-300 focus-visible:text-sky-300 focus-visible:outline-none cursor-pointer"
                      >
                        <span>Lokasi</span>
                        <span className="text-[10px] opacity-75">
                          {sortArrow("geo")}
                        </span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAllReports.map((r) => (
                    <tr
                      key={r.id}
                      tabIndex={r.geo ? 0 : undefined}
                      role={r.geo ? "button" : undefined}
                      onClick={() => {
                        if (r.geo) focusPointsOnMap([r]);
                      }}
                      onKeyDown={(e) => {
                        if (r.geo && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          focusPointsOnMap([r]);
                        }
                      }}
                      className={`border-b border-slate-800/80 ${
                        r.geo
                          ? "hover:bg-slate-800/60 focus-visible:outline-2 focus-visible:outline-sky-400 cursor-pointer"
                          : ""
                      }`}
                    >
                      <td className="px-2.5 py-2 font-mono font-bold text-white">
                        {r.id}
                      </td>
                      <td className="px-2.5 py-2 font-mono text-slate-300">
                        {fmtShortDate(r.tgl)}
                      </td>
                      <td className="px-2.5 py-2 text-slate-200">
                        {r.wilayah}
                        {r.patokan ? ` · ${r.patokan}` : ""}
                      </td>
                      <td className="px-2.5 py-2 text-slate-300">
                        {r.penyulang || "–"}
                      </td>
                      <td className="px-2.5 py-2 font-mono text-slate-300">
                        {r.geo ? `${r.gardu} ${r.jur}` : "–"}
                      </td>
                      <td className="px-2.5 py-2 text-right">
                        <VoltageChip v={r.v} />
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums text-slate-300">
                        {r.drop == null ? "–" : `${fmtId(r.drop)}%`}
                      </td>
                      <td className="px-2.5 py-2 text-slate-300">
                        {reportStatusText(r)}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono text-slate-400">
                        {r.aduan || "–"}
                      </td>
                      <td className="px-2.5 py-2">
                        {r.geo ? (
                          <span className="text-sky-400 font-semibold">
                            Berkoordinat
                          </span>
                        ) : (
                          <span className="text-slate-400">Belum</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 8. Catatan Data */}
        <section id="catatan" className="scroll-mt-14">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Catatan data dan metode
            </h3>
            <ul className="mt-2.5 space-y-2 text-[12.5px] text-slate-300">
              {dataNotes.map((note) => (
                <li key={note} className="leading-relaxed">
                  • {note}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="text-xs text-slate-400">
          Dibuat dari export chat grup eviden dan GIS gardu/JTM/JTR ULP Kupang.
          Foto, nomor HP, nama pelapor, dan ID pelanggan tidak disertakan.
        </footer>
      </main>
    </div>
  );
}
