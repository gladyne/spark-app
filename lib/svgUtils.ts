import type { GarduConfig, SchoorConfig } from "../types/spark";
import { SPARK_ASSET_COLORS } from "./assetStyles";

export function buildSchoorSvg(
  schoor: SchoorConfig,
  poleSize: number,
  rot: number,
  isAutoSchoor: boolean
): string {
  const ph = poleSize / 2;
  const opacity = isAutoSchoor ? "0.75" : "1";

  let sColor: string = isAutoSchoor ? SPARK_ASSET_COLORS.SCHOOR.autoTreck : SPARK_ASSET_COLORS.SCHOOR.treck;
  if (schoor.jenis === "Druck")      sColor = isAutoSchoor ? SPARK_ASSET_COLORS.SCHOOR.autoDruck : SPARK_ASSET_COLORS.SCHOOR.druck;
  if (schoor.jenis === "Kontramast") sColor = isAutoSchoor ? SPARK_ASSET_COLORS.SCHOOR.autoKontramast : SPARK_ASSET_COLORS.SCHOOR.kontramast;

  const svgStyle = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(${rot}deg);pointer-events:auto;cursor:grab;overflow:visible;z-index:7;opacity:${opacity};`;

  if (schoor.jenis === "Treck") {
    return `<svg class="schoor-handle" width="100" height="100" viewBox="-50 -50 100 100" style="${svgStyle}">
      <line x1="0" y1="-${ph}" x2="0" y2="-44" stroke="${sColor}" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="-4.5,-35 0,-44 4.5,-35" fill="${sColor}"/>
    </svg>`;
  }

  if (schoor.jenis === "Druck") {
    const arrowBase = ph + 11;
    return `<svg class="schoor-handle" width="100" height="100" viewBox="-50 -50 100 100" style="${svgStyle}">
      <line x1="0" y1="-${arrowBase}" x2="0" y2="-44" stroke="${sColor}" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="-4.5,-${arrowBase} 0,-${ph + 1} 4.5,-${arrowBase}" fill="${sColor}"/>
    </svg>`;
  }

  // Kontramast
  const anchorDist = 65;
  const anchorR    = Math.max(6, Math.round(ph * 0.8));
  const treckBase  = anchorDist + anchorR;
  const treckTip   = treckBase + 24;
  const treckAB    = treckTip - 10;
  return `<svg class="schoor-handle" width="200" height="200" viewBox="-100 -100 200 200" style="${svgStyle}">
    <line x1="0" y1="-${ph}" x2="0" y2="-${anchorDist - anchorR}" stroke="${sColor}" stroke-width="2" stroke-dasharray="5 3"/>
    <circle cx="0" cy="-${anchorDist}" r="${anchorR}" fill="white" stroke="${sColor}" stroke-width="2.5"/>
    <line x1="0" y1="-${treckBase}" x2="0" y2="-${treckTip}" stroke="${sColor}" stroke-width="2" stroke-linecap="round"/>
    <polygon points="-4,-${treckAB} 0,-${treckTip} 4,-${treckAB}" fill="${sColor}"/>
  </svg>`;
}

export function buildGarduSvg(
  gardu: GarduConfig,
  poleSize: number,
  currentPoleBorder: string,
  isLast: boolean
): string {
  const trafoColor = SPARK_ASSET_COLORS.GARDU.stroke;
  const trafoBg = SPARK_ASSET_COLORS.GARDU.fill;
  const strokeW = isLast ? "3" : "2";
  const gap = 6;

  if (gardu.jenis === "Cantol") {
    return `<div style="position:absolute;top:-${poleSize}px;left:0px;width:${poleSize}px;height:${poleSize}px;z-index:8;">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow:visible;">
        <polygon points="50,0 100,100 0,100" fill="${trafoBg}" stroke="${trafoColor}" stroke-width="4" stroke-linejoin="round"/>
      </svg>
    </div>`;
  }

  if (gardu.jenis === "Portal" && gardu.orientasi === "Horizontal") {
    return `<div style="position:absolute;top:0px;left:-${poleSize + gap}px;width:${poleSize}px;height:${poleSize}px;border:${strokeW}px solid ${currentPoleBorder};background:white;border-radius:50%;z-index:9;box-shadow:0px 2px 4px rgba(0,0,0,0.5);"></div>
    <div style="position:absolute;top:-${poleSize}px;left:-${poleSize + gap}px;width:${poleSize * 2 + gap}px;height:${poleSize}px;z-index:8;">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow:visible;">
        <polygon points="50,0 100,100 0,100" fill="${trafoBg}" stroke="${trafoColor}" stroke-width="4" stroke-linejoin="round"/>
      </svg>
    </div>`;
  }

  // Portal Vertikal
  return `<div style="position:absolute;top:-${poleSize + gap}px;left:0px;width:${poleSize}px;height:${poleSize}px;border:${strokeW}px solid ${currentPoleBorder};background:white;border-radius:50%;z-index:9;box-shadow:0px 2px 4px rgba(0,0,0,0.5);"></div>
  <div style="position:absolute;top:-${poleSize + gap}px;left:${poleSize}px;width:${poleSize}px;height:${poleSize * 2 + gap}px;z-index:8;">
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow:visible;">
      <polygon points="0,0 100,50 0,100" fill="${trafoBg}" stroke="${trafoColor}" stroke-width="4" stroke-linejoin="round"/>
    </svg>
  </div>`;
}
