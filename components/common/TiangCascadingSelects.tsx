"use client";

import React, { useId } from "react";
import {
  type MaterialTiang,
  getValidMaterials,
  getValidTinggiTiang,
  getValidKekuatanTiang,
  handleTiangMaterialChange,
  handleTiangTinggiChange,
} from "../../lib/assetStyles";

export interface TiangCascadingValues {
  material: MaterialTiang;
  tinggi: number;
  kekuatan: number;
}

export interface TiangCascadingSelectsProps {
  material: string;
  tinggi: number;
  kekuatan?: number;
  onChange: (values: TiangCascadingValues) => void;
  layout?: "inline" | "stacked";
  containerClassName?: string;
  selectClassName?: string;
  labelClassName?: string;
  idPrefix?: string;
  showLabels?: boolean;
}

/**
 * Reusable cascading dropdown component for Tiang:
 * Step 1: Material (Beton / Baja)
 * Step 2: Tinggi (Filtered exclusively to heights valid for selected material)
 * Step 3: Kekuatan daN (Filtered exclusively to daN valid for selected material + tinggi)
 * Single source of truth: rab_katalog_dengan_harga.json (via assetStyles.tsx)
 */
export default function TiangCascadingSelects({
  material,
  tinggi,
  kekuatan = 200,
  onChange,
  layout = "inline",
  containerClassName,
  selectClassName,
  labelClassName,
  idPrefix = "tiang",
  showLabels = true,
}: TiangCascadingSelectsProps) {
  const uid = useId();
  const prefix = `${idPrefix}-${uid}`;

  const currentMat: MaterialTiang =
    material.toLowerCase().includes("baja") || material.toLowerCase().includes("besi")
      ? "Baja"
      : "Beton";

  const validHeights = getValidTinggiTiang(currentMat);
  const safeTinggi = validHeights.includes(tinggi)
    ? tinggi
    : (validHeights.includes(12) ? 12 : validHeights[0]);

  const validDans = getValidKekuatanTiang(currentMat, safeTinggi);
  const safeDan = validDans.includes(kekuatan) ? kekuatan : validDans[0];

  const onMatChange = (newMat: string) => {
    const updated = handleTiangMaterialChange(newMat, safeTinggi, safeDan);
    onChange(updated);
  };

  const onHChange = (newH: number) => {
    const updated = handleTiangTinggiChange(newH, currentMat, safeDan);
    onChange({
      material: currentMat,
      tinggi: updated.tinggi,
      kekuatan: updated.kekuatan,
    });
  };

  const onDanChange = (newDan: number) => {
    onChange({
      material: currentMat,
      tinggi: safeTinggi,
      kekuatan: newDan,
    });
  };

  // Default class styling according to layout
  const defaultSelectCls =
    selectClassName ||
    (layout === "inline"
      ? "px-2 py-1 border border-slate-300 rounded font-semibold text-xs outline-none bg-white text-slate-800 focus:border-blue-500"
      : "w-full text-xs font-semibold py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500");

  const defaultLabelCls =
    labelClassName ||
    (layout === "inline"
      ? "text-slate-500 font-bold text-xs"
      : "text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 block");

  if (layout === "inline") {
    return (
      <div className={`flex items-center gap-3 flex-wrap ${containerClassName || ""}`}>
        {/* Step 1: Material */}
        <div className="flex items-center gap-1.5">
          {showLabels && <label htmlFor={`${prefix}-mat`} className={defaultLabelCls}>Material:</label>}
          <select
            id={`${prefix}-mat`}
            value={currentMat}
            onChange={(e) => onMatChange(e.target.value)}
            className={defaultSelectCls}
          >
            <option value="Beton">Tiang Beton</option>
            <option value="Baja">Tiang Baja</option>
          </select>
        </div>

        {/* Step 2: Tinggi */}
        <div className="flex items-center gap-1.5">
          {showLabels && <label htmlFor={`${prefix}-h`} className={defaultLabelCls}>Tinggi:</label>}
          <select
            id={`${prefix}-h`}
            value={safeTinggi}
            onChange={(e) => onHChange(Number(e.target.value))}
            className={defaultSelectCls}
          >
            {validHeights.map((h) => (
              <option key={h} value={h}>
                {h} Meter
              </option>
            ))}
          </select>
        </div>

        {/* Step 3: Kekuatan daN */}
        <div className="flex items-center gap-1.5">
          {showLabels && <label htmlFor={`${prefix}-dan`} className={defaultLabelCls}>Kekuatan:</label>}
          <select
            id={`${prefix}-dan`}
            value={safeDan}
            onChange={(e) => onDanChange(Number(e.target.value))}
            className={defaultSelectCls}
          >
            {validDans.map((dan) => (
              <option key={dan} value={dan}>
                {dan} daN
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  // layout === "stacked"
  return (
    <div className={`space-y-2.5 ${containerClassName || ""}`}>
      {/* Material & Tinggi */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          {showLabels && <label htmlFor={`${prefix}-mat`} className={defaultLabelCls}>Material Tiang</label>}
          <select
            id={`${prefix}-mat`}
            value={currentMat}
            onChange={(e) => onMatChange(e.target.value)}
            className={defaultSelectCls}
          >
            <option value="Beton">Tiang Beton</option>
            <option value="Baja">Tiang Baja</option>
          </select>
        </div>

        <div>
          {showLabels && <label htmlFor={`${prefix}-h`} className={defaultLabelCls}>Tinggi Tiang</label>}
          <select
            id={`${prefix}-h`}
            value={safeTinggi}
            onChange={(e) => onHChange(Number(e.target.value))}
            className={defaultSelectCls}
          >
            {validHeights.map((h) => (
              <option key={h} value={h}>
                {h} meter
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Kekuatan daN */}
      <div>
        {showLabels && <label htmlFor={`${prefix}-dan`} className={defaultLabelCls}>Kekuatan (daN)</label>}
        <select
          id={`${prefix}-dan`}
          value={safeDan}
          onChange={(e) => onDanChange(Number(e.target.value))}
          className={defaultSelectCls}
        >
          {validDans.map((dan) => (
            <option key={dan} value={dan}>
              {dan} daN
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
