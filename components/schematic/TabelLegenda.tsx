"use client";

import React, { useMemo } from "react";
import type { SchematicData, LegendaItem } from "../../types/schematic";

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
        uraian: "Tiang JTM Existing",
        vol: existingPoles.length,
        sat: "btg",
      });
    }

    // 2. Rencana Tiang JTM (○)
    const rencanaPoles = nodes.filter(n => n.type === "tiang-rencana");
    if (rencanaPoles.length > 0) {
      // Kelompokkan per spesifikasi tiang
      const specs = new Map<string, number>();
      rencanaPoles.forEach(p => {
        const mat = p.materialTiang || "Beton";
        const h = p.tinggiTiang || 12;
        const dan = p.kekuatanTiang || 200;
        const key = `Rencana Tiang ${mat} ${h}m / ${dan} daN`;
        specs.set(key, (specs.get(key) || 0) + 1);
      });

      specs.forEach((count, desc) => {
        list.push({
          id: `tiang-rencana-${desc}`,
          simbolType: "tiang-rencana",
          uraian: desc,
          vol: count,
          sat: "btg",
        });
      });
    }

    // 3. Gardu Distribusi
    const gardus = nodes.filter(n => n.type === "gardu");
    if (gardus.length > 0) {
      const gSpecs = new Map<string, number>();
      gardus.forEach(g => {
        const jenis = g.garduJenis || "Portal";
        const kva = g.trafoKva || 100;
        const fasa = g.fasa || "3 phs";
        const key = `Gardu ${jenis} Trafo ${kva} kVA (${fasa})`;
        gSpecs.set(key, (gSpecs.get(key) || 0) + 1);
      });
      gSpecs.forEach((count, desc) => {
        list.push({
          id: `gardu-${desc}`,
          simbolType: "gardu",
          uraian: desc,
          vol: count,
          sat: "set",
        });
      });
    }

    // 4. Box APP (kWh Meter)
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

    // 5. Kontramast
    const kontramasts = nodes.filter(n => n.type === "kontramast");
    if (kontramasts.length > 0) {
      list.push({
        id: "kontramast",
        simbolType: "kontramast",
        uraian: "Kontramast Standar JTM",
        vol: kontramasts.length,
        sat: "set",
      });
    }

    // 6. Kabel Existing (Garis solid)
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

    // 7. Rencana Kabel (Garis putus-putus)
    const rencanaCables = edges.filter(e => e.type === "kabel-rencana");
    if (rencanaCables.length > 0) {
      const cSpecs = new Map<string, number>();
      rencanaCables.forEach(c => {
        const jj = c.jenisJaringan || "SUTM";
        const kj = c.konduktorJenis || "AAAC/S";
        const ku = c.kondukturUkuran || 70;
        const key = `Rencana ${jj} ${kj} 3x${ku} mm²`;
        cSpecs.set(key, (cSpecs.get(key) || 0) + (c.lengthM || 0));
      });
      cSpecs.forEach((totalLen, desc) => {
        list.push({
          id: `kabel-rencana-${desc}`,
          simbolType: "kabel-rencana",
          uraian: desc,
          vol: totalLen,
          sat: "ms",
        });
      });
    }

    return list;
  }, [nodes, edges]);

  // Render thumbnail icon mini untuk tiap jenis simbol
  const renderIcon = (type: string) => {
    switch (type) {
      case "tiang-existing":
        return (
          <div className="w-4 h-4 rounded-full bg-slate-900 border border-slate-900 flex-shrink-0" />
        );
      case "tiang-rencana":
        return (
          <div className="w-4 h-4 rounded-full bg-white border-2 border-slate-900 flex-shrink-0" />
        );
      case "gardu":
        return (
          <div className="w-5 h-4 border-2 border-amber-600 bg-amber-50 rounded-xs flex items-center justify-center font-bold text-[8px] text-amber-800 flex-shrink-0">
            TR
          </div>
        );
      case "box-app":
        return (
          <div className="w-4 h-4 border-2 border-blue-600 bg-blue-50 rounded-xs flex items-center justify-center font-bold text-[7px] text-blue-800 flex-shrink-0">
            APP
          </div>
        );
      case "kontramast":
        return (
          <div className="w-5 h-3 flex items-center justify-center">
            <svg viewBox="0 0 24 12" className="w-full h-full text-slate-800 stroke-current" fill="none" strokeWidth="2.5">
              <path d="M2,6 L22,6 M16,2 L22,6 L16,10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        );
      case "kabel-existing":
        return (
          <div className="w-6 h-0.5 bg-slate-900 rounded-full" />
        );
      case "kabel-rencana":
        return (
          <div className="w-6 border-b-2 border-dashed border-red-600" />
        );
      default:
        return <div className="w-3 h-3 bg-slate-400 rounded-full" />;
    }
  };

  return (
    <div className="bg-white/95 border-2 border-slate-800 text-slate-900 shadow-md rounded-xs overflow-hidden max-w-[320px] text-[10px] select-none">
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
