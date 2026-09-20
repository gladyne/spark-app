"use client";

import React, { useMemo } from "react";
import type { SchematicData, LegendaItem } from "../../types/schematic";
import { SPARK_ASSET_COLORS } from "../../lib/assetStyles";

interface Props {
  schematic: SchematicData;
}

export default function TabelLegenda({ schematic }: Props) {
  const { nodes, edges } = schematic;

  // Auto-generate item legenda dari isi kanvas
  const legendaItems: LegendaItem[] = useMemo(() => {
    const list: LegendaItem[] = [];

    // 1. Tiang Existing (●)
    const existingPoles = nodes.filter(n => n.type === "tiang-existing");
    if (existingPoles.length > 0) {
      list.push({
        id: "tiang-exist",
        simbolType: "tiang-existing",
        uraian: "Tiang Existing",
        vol: existingPoles.length,
        sat: "btg",
      });
    }

    // 2. Rencana Tiang (Beton / Baja)
    const rencanaPoles = nodes.filter(n =>
      n.type === "tiang-rencana" || n.type === "tiang-tm" || n.type === "tiang-tr"
    );
    if (rencanaPoles.length > 0) {
      const specs = new Map<string, { count: number; isBaja: boolean }>();
      rencanaPoles.forEach(p => {
        const isBaja = (p.materialTiang || "Beton").toLowerCase().includes("baja");
        const mat = isBaja ? "Baja" : "Beton";
        const h = p.tinggiTiang || 12;
        const dan = p.kekuatanTiang || 200;
        const key = `Rencana Tiang ${mat} ${h}m / ${dan} daN`;
        
        const cur = specs.get(key);
        if (cur) cur.count += 1;
        else specs.set(key, { count: 1, isBaja });
      });

      specs.forEach((val, desc) => {
        list.push({
          id: `tiang-${desc}`,
          simbolType: val.isBaja ? "tiang-baja" : "tiang-beton",
          uraian: desc,
          vol: val.count,
          sat: "btg",
        });
      });
    }

    // 3. Gardu Distribusi (Cantol / Portal)
    const gardus = nodes.filter(n => n.type === "gardu");
    if (gardus.length > 0) {
      const gSpecs = new Map<string, { count: number; jenis: string }>();
      gardus.forEach(g => {
        const jenis = g.garduJenis || "Portal";
        const kva = g.trafoKva || 100;
        const fasa = g.fasa || "3 phs";
        const key = `Gardu ${jenis} Trafo ${kva} kVA (${fasa})`;
        const cur = gSpecs.get(key);
        if (cur) cur.count += 1;
        else gSpecs.set(key, { count: 1, jenis });
      });
      gSpecs.forEach((val, desc) => {
        list.push({
          id: `gardu-${desc}`,
          simbolType: val.jenis === "Cantol" ? "gardu-cantol" : "gardu-portal",
          uraian: desc,
          vol: val.count,
          sat: "set",
        });
      });
    }

    // 4. Penopang Tiang (Schoor): Treck, Druck, Kontramast
    const schoorCounts: Record<string, number> = {
      "treck-standar": 0,
      "treck-tolak-pinggang": 0,
      "druck": 0,
      "kontramast": 0,
    };

    // Hitung dari atribut node
    nodes.forEach(n => {
      if (n.schoor) {
        if (n.schoor.jenis === "Treck") {
          if (n.schoor.tipe === "Tolak Pinggang") schoorCounts["treck-tolak-pinggang"]++;
          else schoorCounts["treck-standar"]++;
        } else if (n.schoor.jenis === "Druck") {
          schoorCounts["druck"]++;
        } else if (n.schoor.jenis === "Kontramast") {
          schoorCounts["kontramast"]++;
        }
      }
      if (n.type === "treck-schoor") schoorCounts["treck-standar"]++;
      if (n.type === "druck-schoor") schoorCounts["druck"]++;
      if (n.type === "kontramast") {
        if (n.kontramastTipe === "Tolak Pinggang") schoorCounts["treck-tolak-pinggang"]++;
        else schoorCounts["kontramast"]++;
      }
    });

    if (schoorCounts["treck-standar"] > 0) {
      list.push({
        id: "sch-treck-std",
        simbolType: "treck-standar",
        uraian: "Treckschoor Standar",
        vol: schoorCounts["treck-standar"],
        sat: "set",
      });
    }
    if (schoorCounts["treck-tolak-pinggang"] > 0) {
      list.push({
        id: "sch-treck-tp",
        simbolType: "treck-tolak-pinggang",
        uraian: "Treckschoor Tolak Pinggang",
        vol: schoorCounts["treck-tolak-pinggang"],
        sat: "set",
      });
    }
    if (schoorCounts["druck"] > 0) {
      list.push({
        id: "sch-druck",
        simbolType: "druck",
        uraian: "Drukschoor (Dorong)",
        vol: schoorCounts["druck"],
        sat: "set",
      });
    }
    if (schoorCounts["kontramast"] > 0) {
      list.push({
        id: "sch-kontramast",
        simbolType: "kontramast",
        uraian: "Kontramast Standar",
        vol: schoorCounts["kontramast"],
        sat: "set",
      });
    }

    // 5. Box APP (kWh Meter)
    const boxApps = nodes.filter(n => n.type === "box-app");
    if (boxApps.length > 0) {
      const appSpecs = new Map<string, number>();
      boxApps.forEach(b => {
        const kva = b.boxKva || 197;
        const key = `Box APP Pengukuran (${kva} kVA)`;
        appSpecs.set(key, (appSpecs.get(key) || 0) + 1);
      });
      appSpecs.forEach((count, desc) => {
        list.push({
          id: `box-app-${desc}`,
          simbolType: "box-app",
          uraian: desc,
          vol: count,
          sat: "set",
        });
      });
    }

    // 6. Kabel Existing (Garis solid gelap)
    const existingCables = edges.filter(e => e.type === "kabel-existing");
    if (existingCables.length > 0) {
      const totalLen = existingCables.reduce((acc, c) => acc + (c.lengthM || 0), 0);
      list.push({
        id: "kabel-existing",
        simbolType: "kabel-existing",
        uraian: "Jaringan Kabel JTM Existing",
        vol: totalLen,
        sat: "ms",
      });
    }

    // 7. Rencana Kabel TM / TR
    const rencanaCables = edges.filter(e => e.type !== "kabel-existing");
    if (rencanaCables.length > 0) {
      const cSpecs = new Map<string, { totalLen: number; simbolType: string }>();
      rencanaCables.forEach(c => {
        const isTR = c.type === "kabel-tr" || (c.jenisJaringan && (c.jenisJaringan.includes("TR") || c.jenisJaringan.includes("SKUTR")));
        const jj = c.jenisJaringan || (isTR ? "SKUTR" : "SUTM");
        const kj = c.konduktorJenis || "AAAC/S";
        const ku = c.kondukturUkuran || 70;
        const key = `Rencana ${jj} ${kj} 3x${ku} mm²`;
        
        const existing = cSpecs.get(key);
        if (existing) {
          existing.totalLen += (c.lengthM || 0);
        } else {
          cSpecs.set(key, {
            totalLen: (c.lengthM || 0),
            simbolType: isTR ? "kabel-tr" : "kabel-tm",
          });
        }
      });
      cSpecs.forEach((val, desc) => {
        list.push({
          id: `kabel-${desc}`,
          simbolType: val.simbolType,
          uraian: desc,
          vol: val.totalLen,
          sat: "ms",
        });
      });
    }

    return list;
  }, [nodes, edges]);

  // Render thumbnail icon mini persis bentuk SVG SparkMap.tsx & svgUtils.ts
  const renderIcon = (type: string) => {
    switch (type) {
      case "tiang-existing":
        return (
          <svg width="16" height="16" viewBox="-10 -10 20 20" className="flex-shrink-0">
            <circle r="8" fill="#000000" stroke="#ffffff" strokeWidth="2" />
          </svg>
        );

      case "tiang-beton":
        return (
          <svg width="16" height="16" viewBox="-10 -10 20 20" className="flex-shrink-0">
            <circle r="8" fill="#ffeb3b" stroke="#000000" strokeWidth="2" />
          </svg>
        );

      case "tiang-baja":
        return (
          <svg width="16" height="16" viewBox="-10 -10 20 20" className="flex-shrink-0">
            <circle r="8" fill="#ffeb3b" stroke="#000000" strokeWidth="2" />
          </svg>
        );

      case "gardu-cantol":
        return (
          <svg width="18" height="20" viewBox="-10 -20 20 28" className="flex-shrink-0">
            <circle cx="0" cy="0" r="4" fill="white" stroke="#000000" strokeWidth="1.5" />
            <polygon points="0,-16 7,-4 -7,-4" fill={SPARK_ASSET_COLORS.GARDU.fill} stroke={SPARK_ASSET_COLORS.GARDU.stroke} strokeWidth="2" strokeLinejoin="round" />
          </svg>
        );

      case "gardu-portal":
        return (
          <svg width="24" height="20" viewBox="-14 -20 28 28" className="flex-shrink-0">
            <circle cx="-6" cy="0" r="4" fill="white" stroke="#000000" strokeWidth="1.5" />
            <circle cx="6" cy="0" r="4" fill="white" stroke="#000000" strokeWidth="1.5" />
            <polygon points="0,-16 10,-4 -10,-4" fill={SPARK_ASSET_COLORS.GARDU.fill} stroke={SPARK_ASSET_COLORS.GARDU.stroke} strokeWidth="2" strokeLinejoin="round" />
          </svg>
        );

      case "treck-standar":
        return (
          <svg width="18" height="18" viewBox="-25 -25 50 50" className="flex-shrink-0">
            <circle cx="0" cy="0" r="4" fill="#ffeb3b" stroke="#000" strokeWidth="1.5" />
            <line x1="0" y1="-4" x2="0" y2="-22" stroke={SPARK_ASSET_COLORS.SCHOOR.treck} strokeWidth="2.5" strokeLinecap="round" />
            <polygon points="-4,-14 0,-22 4,-14" fill={SPARK_ASSET_COLORS.SCHOOR.treck} />
          </svg>
        );

      case "treck-tolak-pinggang":
        return (
          <svg width="20" height="20" viewBox="-25 -25 50 50" className="flex-shrink-0">
            <circle cx="0" cy="0" r="4" fill="#ffeb3b" stroke="#000" strokeWidth="1.5" />
            <line x1="0" y1="-10" x2="8" y2="-10" stroke={SPARK_ASSET_COLORS.SCHOOR.treck} strokeWidth="2" />
            <line x1="0" y1="-4" x2="8" y2="-10" stroke={SPARK_ASSET_COLORS.SCHOOR.treck} strokeWidth="2" />
            <line x1="8" y1="-10" x2="0" y2="-22" stroke={SPARK_ASSET_COLORS.SCHOOR.treck} strokeWidth="2" />
            <polygon points="-4,-15 0,-22 4,-15" fill={SPARK_ASSET_COLORS.SCHOOR.treck} />
          </svg>
        );

      case "druck":
        return (
          <svg width="18" height="18" viewBox="-25 -25 50 50" className="flex-shrink-0">
            <circle cx="0" cy="0" r="4" fill="#ffeb3b" stroke="#000" strokeWidth="1.5" />
            <line x1="0" y1="-20" x2="0" y2="-4" stroke={SPARK_ASSET_COLORS.SCHOOR.druck} strokeWidth="2.5" strokeLinecap="round" />
            <polygon points="-4,-12 0,-4 4,-12" fill={SPARK_ASSET_COLORS.SCHOOR.druck} />
          </svg>
        );

      case "kontramast":
        return (
          <svg width="20" height="20" viewBox="-15 -35 30 50" className="flex-shrink-0">
            <circle cx="0" cy="0" r="3.5" fill="#ffeb3b" stroke="#000" strokeWidth="1.5" />
            <line x1="0" y1="-4" x2="0" y2="-18" stroke={SPARK_ASSET_COLORS.SCHOOR.kontramast} strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx="0" cy="-21" r="3.5" fill="white" stroke={SPARK_ASSET_COLORS.SCHOOR.kontramast} strokeWidth="2" />
            <line x1="0" y1="-25" x2="0" y2="-34" stroke={SPARK_ASSET_COLORS.SCHOOR.kontramast} strokeWidth="2" />
            <polygon points="-3,-29 0,-34 3,-29" fill={SPARK_ASSET_COLORS.SCHOOR.kontramast} />
          </svg>
        );

      case "box-app":
        return (
          <svg width="18" height="18" viewBox="-12 -12 24 24" className="flex-shrink-0">
            <rect x="-10" y="-10" width="20" height="20" fill={SPARK_ASSET_COLORS.BOX_APP.bg} stroke={SPARK_ASSET_COLORS.BOX_APP.border} strokeWidth="2" rx="2" />
            <rect x="-6" y="-7" width="12" height="5" fill={SPARK_ASSET_COLORS.BOX_APP.accent} />
            <text x="0" y="6" textAnchor="middle" fontSize="6.5" fontWeight="900" fill={SPARK_ASSET_COLORS.BOX_APP.text}>APP</text>
          </svg>
        );

      case "kabel-existing":
        return (
          <div className="w-6 h-0.5 bg-black rounded-full" />
        );

      case "kabel-tm":
        return (
          <div className="w-6 h-1 bg-blue-600 rounded-full" />
        );

      case "kabel-tr":
        return (
          <div className="w-6 border-b-2 border-dashed border-green-600" />
        );

      default:
        return <div className="w-3 h-3 bg-slate-400 rounded-full" />;
    }
  };

  return (
    <div className="bg-white/95 border-2 border-slate-800 text-slate-900 shadow-md rounded-xs overflow-hidden max-w-[340px] text-[10px] select-none">
      {/* Legenda Header */}
      <div className="bg-slate-900 text-white px-2.5 py-1 font-extrabold text-[10px] uppercase tracking-wider text-center border-b border-slate-800">
        TABEL LEGENDA &amp; VOLUME
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-800 text-[9px] uppercase">
            <th className="py-1 px-1.5 text-center w-8 border-r border-slate-300">Simb.</th>
            <th className="py-1 px-2 text-left border-r border-slate-300">Uraian</th>
            <th className="py-1 px-1.5 text-right w-12 border-r border-slate-300">Vol</th>
            <th className="py-1 px-1 text-center w-8">Sat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {legendaItems.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-3 px-2 text-center text-slate-400 italic text-[9px]">
                Belum ada simbol di kanvas
              </td>
            </tr>
          ) : (
            legendaItems.map((item, idx) => (
              <tr key={item.id || idx} className="hover:bg-slate-50 transition">
                <td className="py-1 px-1.5 text-center border-r border-slate-200">
                  <div className="flex items-center justify-center">
                    {renderIcon(item.simbolType)}
                  </div>
                </td>
                <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-800 leading-tight">
                  {item.uraian}
                </td>
                <td className="py-1 px-1.5 text-right font-mono font-bold text-slate-950 border-r border-slate-200">
                  {item.vol}
                </td>
                <td className="py-1 px-1 text-center font-bold text-slate-600">
                  {item.sat}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
