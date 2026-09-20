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

  const rot =
    typeof gardu.rotationDeg === "number"
      ? gardu.rotationDeg
      : gardu.orientasi === "Vertikal"
      ? 90
      : 0;

  const offX = gardu.offsetX || 0;
  const offY = gardu.offsetY || 0;
  const hasOffset = Math.abs(offX) > 0.5 || Math.abs(offY) > 0.5;

  const leaderLineHtml = hasOffset
    ? `<svg style="position:absolute;top:0;left:0;width:${poleSize}px;height:${poleSize}px;overflow:visible;pointer-events:none;z-index:7;">
        <line x1="${poleSize / 2}" y1="${poleSize / 2}" x2="${poleSize / 2 + offX}" y2="${poleSize / 2 + offY}" stroke="${trafoColor}" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.75"/>
        <circle cx="${poleSize / 2}" cy="${poleSize / 2}" r="3" fill="${trafoColor}" opacity="0.85"/>
      </svg>`
    : "";

  if (gardu.jenis === "Cantol") {
    return `${leaderLineHtml}
    <div class="gardu-group" style="position:absolute;top:${offY}px;left:${offX}px;width:${poleSize}px;height:${poleSize}px;z-index:9;pointer-events:auto;">
      <div style="position:absolute;top:0;left:0;width:${poleSize}px;height:${poleSize}px;transform:rotate(${rot}deg);transform-origin:${poleSize / 2}px ${poleSize / 2}px;overflow:visible;">
        <!-- Trafo segitiga (Drag handle untuk geser) -->
        <div class="gardu-drag-handle" title="Drag untuk geser posisi gardu (${offX}, ${offY})" style="position:absolute;top:-${poleSize}px;left:0px;width:${poleSize}px;height:${poleSize}px;z-index:8;cursor:move;">
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow:visible;">
            <polygon points="50,0 100,100 0,100" fill="${trafoBg}" stroke="${trafoColor}" stroke-width="4" stroke-linejoin="round"/>
          </svg>
        </div>
        <!-- Handle rotasi gardu -->
        <div class="gardu-rot-handle" title="Drag untuk rotasi gardu (${Math.round(rot)}°)" style="position:absolute;top:-${poleSize + 13}px;left:${poleSize / 2 - 5}px;width:10px;height:10px;background:#9333ea;border:2px solid white;border-radius:50%;cursor:grab;box-shadow:0 1px 4px rgba(0,0,0,0.5);z-index:10;"></div>
      </div>
    </div>`;
  }

  // Portal: Tiang sekunder + balok trafo dengan rotasi bebas
  const portalCenterX = -(gap / 2);
  return `${leaderLineHtml}
  <div class="gardu-group" style="position:absolute;top:${offY}px;left:${offX}px;width:${poleSize}px;height:${poleSize}px;z-index:9;pointer-events:auto;">
    <div style="position:absolute;top:0;left:0;width:${poleSize}px;height:${poleSize}px;transform:rotate(${rot}deg);transform-origin:${poleSize / 2}px ${poleSize / 2}px;overflow:visible;">
      <!-- Tiang ke-2 (Portal) -->
      <div class="gardu-drag-handle" style="position:absolute;top:0px;left:-${poleSize + gap}px;width:${poleSize}px;height:${poleSize}px;border:${strokeW}px solid ${currentPoleBorder};background:white;border-radius:50%;z-index:9;box-shadow:0px 2px 4px rgba(0,0,0,0.5);cursor:move;" title="Drag untuk geser posisi gardu"></div>
      <!-- Balok Trafo melintang kedua tiang -->
      <div class="gardu-drag-handle" style="position:absolute;top:-${poleSize}px;left:-${poleSize + gap}px;width:${poleSize * 2 + gap}px;height:${poleSize}px;z-index:8;cursor:move;" title="Drag untuk geser posisi gardu (${offX}, ${offY})">
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow:visible;">
          <polygon points="50,0 100,100 0,100" fill="${trafoBg}" stroke="${trafoColor}" stroke-width="4" stroke-linejoin="round"/>
        </svg>
      </div>
      <!-- Handle rotasi bebas gardu portal -->
      <div class="gardu-rot-handle" title="Drag untuk rotasi bebas gardu portal (${Math.round(rot)}°)" style="position:absolute;top:-${poleSize + 14}px;left:${portalCenterX - 5}px;width:11px;height:11px;background:#9333ea;border:2px solid white;border-radius:50%;cursor:grab;box-shadow:0 1px 4px rgba(0,0,0,0.6);z-index:11;"></div>
    </div>
  </div>`;
}
