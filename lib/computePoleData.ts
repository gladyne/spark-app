import * as turf from "@turf/turf";
import { haversineMeters } from "./geo";

export interface PoleTypeResult {
  short: string;
  long: string;
}

/** Menghitung tipe konstruksi per tiang untuk satu layer jaringan. */
export function computePoleTypes(
  poles: [number, number][],
  jenisJaringan: string,
  konstruksiOverrides: Record<number, string>,
  junctionBranchIdxs: Set<number>  // indeks tiang di layer INI yang merupakan titik sambung ke layer lain
): PoleTypeResult[] {
  const n = poles.length;

  // Kumulatif jarak untuk SKUTM
  const skutmCumDists: number[] = [];
  if (jenisJaringan === "SKUTM" && n > 0) {
    skutmCumDists[0] = 0;
    for (let i = 1; i < n; i++) {
      skutmCumDists[i] = skutmCumDists[i - 1] + haversineMeters(poles[i-1][0], poles[i-1][1], poles[i][0], poles[i][1]);
    }
  }

  return poles.map((pos, idx) => {
    const isLast = idx === n - 1;
    const ptCurrent = turf.point([pos[1], pos[0]]);

    let maxSpan = 0;
    if (idx < n - 1) maxSpan = Math.max(maxSpan, turf.distance(ptCurrent, turf.point([poles[idx + 1][1], poles[idx + 1][0]]), { units: "meters" }));
    if (idx > 0) maxSpan = Math.max(maxSpan, turf.distance(ptCurrent, turf.point([poles[idx - 1][1], poles[idx - 1][0]]), { units: "meters" }));

    let angle = 0;
    if (idx > 0 && idx < n - 1) {
      const b1 = turf.bearing(turf.point([poles[idx - 1][1], poles[idx - 1][0]]), ptCurrent);
      const b2 = turf.bearing(ptCurrent, turf.point([poles[idx + 1][1], poles[idx + 1][0]]));
      let raw = b2 - b1;
      if (raw > 180) raw -= 360;
      else if (raw <= -180) raw += 360;
      angle = Math.abs(raw);
    }

    let short = ""; let long = "";

    if (jenisJaringan.includes("SKUTR") || jenisJaringan.includes("Underbuild")) {
      long = "Suspension Assy (S)"; short = "S";
      if (idx === 0) { long = "Fix Dead End (FDE)"; short = "FDE"; }
      else if (isLast) { long = "Bundle End Protect + FDE (BDL+DE)"; short = "BDL+DE"; }
      else if (angle > 15) { long = `Large Angle Assy (LA) - Belok ${angle.toFixed(1)}°`; short = "LA"; }
    } else if (jenisJaringan.includes("SUTM")) {
      long = "A1 (Lurus)"; short = "A1";
      // Titik sambung (branch) mendapat A3 Branch — lebih prioritas dari A3 Pole endpoint
      if (junctionBranchIdxs.has(idx)) { long = "A3 Branch (Tiang Cabang)"; short = "A3 Branch"; }
      else if (idx === 0 || isLast) { long = "A3 Pole (Tiang Ujung)"; short = "A3 Pole"; }
      else {
        if (angle > 30) { long = `2xA3 (Belok ${angle.toFixed(1)}°)`; short = "2xA3"; }
        else if (angle >= 10 && angle <= 30) { long = `A2 (Belok ${angle.toFixed(1)}°)`; short = "A2"; }
        if ((idx + 1) % 10 === 0) { long = "A3 (Tiang Tarik)"; short = "A3"; }
      }
      if (maxSpan >= 70) { long = "B3 (Span >= 70m)"; short = "B3"; }
    } else if (jenisJaringan === "SKTM" || jenisJaringan === "SKTR") {
      if (idx === 0 || isLast) { short = "TRM"; long = "Terminasi"; }
      else { short = "JNT"; long = "Jointing"; }
    } else if (jenisJaringan === "SKUTM") {
      if (idx === 0 || isLast) { short = "Trm"; long = "Terminasi"; }
      else {
        const cumDist = skutmCumDists[idx] ?? 0;
        const mod1000 = cumDist % 1000;
        const mod500 = cumDist % 500;
        if (mod1000 < 25 || mod1000 > 975) { short = "2xTrm"; long = "2× Terminasi"; }
        else if (mod500 < 25 || mod500 > 475) { short = "Trm"; long = "Terminasi"; }
        else if (angle > 75) { short = "2xTrm"; long = `2× Terminasi (Belok ${angle.toFixed(1)}°)`; }
        else if (angle > 5) { short = "LA"; long = `LA (Belok ${angle.toFixed(1)}°)`; }
        else { short = "S"; long = "Suspension (S)"; }
      }
    }

    const override = konstruksiOverrides[idx];
    if (override) { short = override; long = override; }

    return { short, long };
  });
}

/** Menghitung rekap tipe konstruksi (count per tipe) dari array poles. */
export function countPoleTypes(
  poles: [number, number][],
  jenisJaringan: string,
  konstruksiOverrides: Record<number, string>,
  junctionBranchIdxs: Set<number>
): Record<string, { long: string; count: number }> {
  const types = computePoleTypes(poles, jenisJaringan, konstruksiOverrides, junctionBranchIdxs);
  const map: Record<string, { long: string; count: number }> = {};
  types.forEach(({ short, long }) => {
    const key = short || "—";
    if (!map[key]) map[key] = { long: long || "—", count: 0 };
    map[key].count++;
  });
  return map;
}
