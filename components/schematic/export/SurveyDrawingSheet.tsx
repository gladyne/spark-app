"use client";

import React, { useMemo } from "react";
import type { SchematicData, SurveyFormData } from "../../../types/schematic";
import type { PageBoundary, ContinuationCallout } from "../../../lib/schematic/paginationEngine";
import SurveyHeaderLogo from "./SurveyHeaderLogo";
import SurveyLegend from "./SurveyLegend";
import SurveyDrawingCanvas from "./SurveyDrawingCanvas";
import SurveyNetworkData from "./SurveyNetworkData";
import SurveyMeasurementsTable from "./SurveyMeasurementsTable";
import SurveyKop from "./SurveyKop";

interface Props {
  schematic: SchematicData;
  surveyData: SurveyFormData;
  orientation?: "portrait" | "landscape";
  pageBoundary?: PageBoundary;
  continuationCallouts?: ContinuationCallout[];
  pageIndex?: number;
  totalPages?: number;
  repeatDataBlocksOnAllPages?: boolean;
}

/**
 * Lembar Gambar Survei UP3 Kupang Standar A2 dengan dukungan Paginasi Multi-Halaman.
 * Menghasilkan layout presisi tinggi sesuai:
 * - Ref Halaman 1 (Portrait A2)
 * - Ref Halaman 2 (Landscape A2)
 */
export default function SurveyDrawingSheet({
  schematic,
  surveyData,
  orientation = "portrait",
  pageBoundary,
  continuationCallouts = [],
  pageIndex = 1,
  totalPages = 1,
  repeatDataBlocksOnAllPages = false,
}: Props) {
  const isLandscape = orientation === "landscape";
  const customLogo = surveyData?.customLogoUrl;
  const showDataBlocks = pageIndex === 1 || repeatDataBlocksOnAllPages;

  // Filter simbol yang benar-benar muncul di halaman ini untuk legenda per halaman
  const pageSchematic = useMemo(() => {
    if (!pageBoundary) return schematic;
    return {
      ...schematic,
      nodes: schematic.nodes.filter(
        (n) => pageBoundary.nodeIds.includes(n.id) || pageBoundary.referenceNodeIds.includes(n.id)
      ),
      edges: schematic.edges.filter((e) => pageBoundary.edgeIds.includes(e.id)),
      obstacles: (schematic.obstacles || []).filter((o) => pageBoundary.obstacleIds.includes(o.id)),
    };
  }, [schematic, pageBoundary]);

  // Daftar nama tiang di halaman ini untuk catatan sambungan
  const pageNodeLabels = useMemo(() => {
    if (!pageBoundary) return [];
    return schematic.nodes
      .filter((n) => pageBoundary.nodeIds.includes(n.id))
      .map((n) => n.label || n.id);
  }, [schematic.nodes, pageBoundary]);

  if (isLandscape) {
    // ═══════════════════════════════════════════════════════════════════
    // LANDSCAPE A2 (1980px x 1400px, Rasio 1.414 : 1) - Ref Halaman 2
    // ═══════════════════════════════════════════════════════════════════
    return (
      <div
        id={`survey-drawing-sheet-landscape-p${pageIndex}`}
        className="w-[1980px] h-[1400px] bg-white text-slate-900 font-sans p-6 box-border flex flex-col justify-between select-none relative overflow-hidden"
        style={{ width: "1980px", height: "1400px" }}
      >
        {/* Double Engineering Border Luar */}
        <div className="absolute inset-4 border-[2.5px] border-slate-950 pointer-events-none" />
        <div className="absolute inset-6 border border-slate-950 pointer-events-none" />

        <div className="w-full h-full p-2 flex flex-col justify-between relative z-10">
          {/* ─── Baris Atas & Area Gambar Tengah ─── */}
          <div className="flex-1 flex flex-col mb-3">
            {/* Header Mini: Logo di Kiri Atas */}
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <SurveyHeaderLogo customLogoUrl={customLogo} size={76} />
                <div className="flex flex-col">
                  <span className="font-extrabold text-[12px] tracking-tight uppercase text-slate-950">
                    PT PLN (PERSERO) UP3 KUPANG
                  </span>
                  <span className="text-[10px] font-bold text-slate-700 uppercase">
                    SINGLE LINE DIAGRAM &amp; GAMBAR SURVEI DISTRIBUSI
                  </span>
                </div>
              </div>

              {/* Status Halaman di Header */}
              {totalPages > 1 && (
                <div className="px-3 py-1 bg-slate-100 border border-slate-400 rounded-md text-[11px] font-bold text-slate-800">
                  LEMBAR {pageIndex} DARI {totalPages}
                </div>
              )}
            </div>

            {/* Area Gambar (Canvas Vektor) dengan Bingkai Tebal */}
            <div className="flex-1 w-full border-[2.5px] border-slate-950 bg-white relative overflow-hidden flex items-center justify-center min-h-[760px]">
              <SurveyDrawingCanvas
                schematic={schematic}
                pageBoundary={pageBoundary}
                continuationCallouts={continuationCallouts}
                className="w-full h-full"
              />
            </div>
          </div>

          {/* ─── Bagian Bawah Halaman 2 (Landscape) ─── */}
          <div className="h-[460px] grid grid-cols-12 gap-3 items-stretch">
            {/* Sisi Kiri (Kolom 1 - 7): Legenda, Pengukuran, & Data Jaringan */}
            <div className="col-span-7 flex flex-col justify-between gap-2">
              {/* Row 1: Legenda Simbol (Hanya simbol aktif di lembar ini) */}
              <div className="h-[120px] overflow-hidden">
                <SurveyLegend schematic={pageSchematic} columns={4} />
              </div>

              {/* Row 2: Tabel Pengukuran & Data Jaringan (Halaman 1) ATAU Catatan Sambungan (Halaman 2+) */}
              {showDataBlocks ? (
                <div className="flex-1 grid grid-cols-12 gap-2">
                  {/* 3. DATA PENGUKURAN JTR & GARDU */}
                  <div className="col-span-7 flex flex-col">
                    <SurveyMeasurementsTable
                      pengukuran={surveyData?.pengukuran}
                      isLandscape={true}
                      className="h-full"
                    />
                  </div>

                  {/* BLOK DATA JARINGAN (JTM, Gardu, JTR) */}
                  <div className="col-span-5 flex flex-col">
                    <SurveyNetworkData
                      jtm={surveyData?.jtm}
                      gardu={surveyData?.gardu}
                      jtr={surveyData?.jtr}
                      isLandscape={true}
                      className="h-full"
                    />
                  </div>
                </div>
              ) : (
                /* Panel Catatan & Referensi Sambungan Halaman untuk Halaman 2+ */
                <div className="flex-1 border border-slate-900 bg-white p-3 flex flex-col justify-between text-[11px] leading-tight">
                  <div>
                    <div className="font-extrabold text-[12px] uppercase tracking-wide text-slate-950 border-b border-slate-900 pb-1 mb-2">
                      CATATAN SAMBUNGAN LEMBAR GAMBAR (HALAMAN {pageIndex} DARI {totalPages})
                    </div>
                    <div className="space-y-1.5 text-slate-800">
                      <div className="flex gap-2">
                        <span className="font-bold text-slate-900 w-36">Cakupan Aset Lembar Ini:</span>
                        <span>
                          {pageNodeLabels.length > 0 ? pageNodeLabels.join(", ") : "Jalur Konduktor / Obstacle"}
                        </span>
                      </div>
                      {continuationCallouts.length > 0 && (
                        <div className="flex gap-2">
                          <span className="font-bold text-slate-900 w-36">Titik Sambungan:</span>
                          <span className="font-semibold text-blue-700">
                            {continuationCallouts.map((c) => c.label).join("; ")}
                          </span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="font-bold text-slate-900 w-36">Data Jaringan Lengkap:</span>
                        <span>Lihat lembar Halaman 1 untuk Tabel Pengukuran Beban &amp; Data Teknis JTM/Gardu/JTR.</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-300 p-2 text-[10px] text-slate-600 italic">
                    * Gambar survei ini terbagi menjadi {totalPages} lembar skala standar A2 agar simbol &amp; dimensi jaringan terbaca presisi tanpa distorsi.
                  </div>
                </div>
              )}
            </div>

            {/* Sisi Kanan (Kolom 8 - 12): Kop Gambar Resmi dengan 3 Kolom Persetujuan */}
            <div className="col-span-5 flex flex-col">
              <SurveyKop
                kop={surveyData?.kop}
                pageIndex={pageIndex}
                totalPages={totalPages}
                className="h-full"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PORTRAIT A2 (1400px x 1980px, Rasio 1 : 1.414) - Ref Halaman 1
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div
      id={`survey-drawing-sheet-portrait-p${pageIndex}`}
      className="w-[1400px] h-[1980px] bg-white text-slate-900 font-sans p-6 box-border flex flex-col justify-between select-none relative overflow-hidden"
      style={{ width: "1400px", height: "1980px" }}
    >
      {/* Double Engineering Border Luar */}
      <div className="absolute inset-4 border-[2.5px] border-slate-950 pointer-events-none" />
      <div className="absolute inset-6 border border-slate-950 pointer-events-none" />

      <div className="w-full h-full p-2 flex flex-col justify-between relative z-10">
        {/* ─── 1. Header Atas: Legenda (Kiri) & Logo (Kanan) ─── */}
        <div className="h-[155px] flex items-stretch justify-between gap-4 mb-3">
          {/* Kiri Atas: Kotak Keterangan Simbol (Legenda Lembar Ini) */}
          <div className="flex-1 overflow-hidden">
            <SurveyLegend schematic={pageSchematic} columns={4} />
          </div>

          {/* Kanan Atas: Logo Area */}
          <div className="w-[155px] flex-shrink-0 flex items-center justify-center">
            <SurveyHeaderLogo customLogoUrl={customLogo} size={115} />
          </div>
        </div>

        {/* ─── 2. Tengah: Area Gambar (Canvas) dengan Border Tebal ─── */}
        <div className="flex-1 w-full border-[2.5px] border-slate-950 bg-white relative overflow-hidden flex items-center justify-center my-1 min-h-[1180px]">
          <SurveyDrawingCanvas
            schematic={schematic}
            pageBoundary={pageBoundary}
            continuationCallouts={continuationCallouts}
            className="w-full h-full"
          />
        </div>

        {/* ─── 3. Bawah: Pengukuran (Kiri), Data Jaringan (Tengah), Kop (Kanan) ─── */}
        <div className="h-[520px] grid grid-cols-12 gap-3 items-stretch mt-3">
          {showDataBlocks ? (
            <>
              {/* Kolom 1 (Kiri - 4 cols): Tabel Pengukuran Gardu & JTR */}
              <div className="col-span-4 flex flex-col">
                <SurveyMeasurementsTable
                  pengukuran={surveyData?.pengukuran}
                  isLandscape={false}
                  className="h-full"
                />
              </div>

              {/* Kolom 2 (Tengah - 4 cols): Blok Data Jaringan */}
              <div className="col-span-4 flex flex-col">
                <SurveyNetworkData
                  jtm={surveyData?.jtm}
                  gardu={surveyData?.gardu}
                  jtr={surveyData?.jtr}
                  isLandscape={false}
                  className="h-full"
                />
              </div>
            </>
          ) : (
            /* Kolom 1 & 2 (Kiri - 8 cols): Catatan Sambungan Lembar */
            <div className="col-span-8 border border-slate-900 bg-white p-4 flex flex-col justify-between text-[11px] leading-tight">
              <div>
                <div className="font-extrabold text-[13px] uppercase tracking-wide text-slate-950 border-b border-slate-900 pb-1.5 mb-2">
                  CATATAN SAMBUNGAN LEMBAR GAMBAR (HALAMAN {pageIndex} DARI {totalPages})
                </div>
                <div className="space-y-2 text-slate-800">
                  <div className="flex gap-2">
                    <span className="font-bold text-slate-900 w-44">Cakupan Aset Lembar Ini:</span>
                    <span>
                      {pageNodeLabels.length > 0 ? pageNodeLabels.join(", ") : "Jalur Konduktor / Obstacle"}
                    </span>
                  </div>
                  {continuationCallouts.length > 0 && (
                    <div className="flex gap-2">
                      <span className="font-bold text-slate-900 w-44">Titik Sambungan:</span>
                      <span className="font-semibold text-blue-700">
                        {continuationCallouts.map((c) => c.label).join("; ")}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="font-bold text-slate-900 w-44">Data Jaringan Lengkap:</span>
                    <span>Lihat Halaman 1 untuk Data Pengukuran Beban &amp; Spesifikasi JTM/Gardu/JTR.</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-300 p-2.5 text-[10.5px] text-slate-600 italic">
                * Gambar survei ini terbagi menjadi {totalPages} lembar skala standar A2 agar simbol &amp; dimensi jaringan terbaca presisi tanpa distorsi.
              </div>
            </div>
          )}

          {/* Kolom 3 (Kanan - 4 cols): Kop Gambar Resmi */}
          <div className="col-span-4 flex flex-col">
            <SurveyKop
              kop={surveyData?.kop}
              pageIndex={pageIndex}
              totalPages={totalPages}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
