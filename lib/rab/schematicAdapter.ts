import type { SchematicData } from "../../types/schematic";
import type { LayerInputData } from "./rabMapper";
import type { GarduConfig, SchoorConfig, PoleData } from "../../types/spark";

/**
 * Mengonversi seluruh data kanvas skematik (simbol, kabel, gardu, APP, kontramast)
 * menjadi LayerInputData[] yang kompatibel 100% dengan calculateRabVolumes() di rabMapper.ts.
 * 
 * JAMINAN:
 * - Tidak menduplikasi logic perhitungan RAB.
 * - Menggunakan panjang kabel meteran yang di-input manual oleh pengguna (manualLengthM).
 * - Menghasilkan estimasi real-time dan output Excel yang identik.
 */
export function convertSchematicToRabLayers(schematic: SchematicData): LayerInputData[] {
  const { nodes, edges, kop } = schematic;

  // Pisahkan nodes
  const rencanaPoles = nodes.filter(n => n.type === "tiang-rencana");
  const existingPoles = nodes.filter(n => n.type === "tiang-existing");
  const garduNodes = nodes.filter(n => n.type === "gardu");
  const boxAppNodes = nodes.filter(n => n.type === "box-app");
  const kontramastNodes = nodes.filter(n => n.type === "kontramast");

  // Pisahkan edges
  const rencanaEdges = edges.filter(e => e.type === "kabel-rencana");

  // Jika kanvas masih kosong tanpa rencana aset
  if (rencanaPoles.length === 0 && rencanaEdges.length === 0 && garduNodes.length === 0 && boxAppNodes.length === 0) {
    return [];
  }

  // Siapkan poleData untuk tiang-tiang rencana (jika diperlukan untuk inspeksi)
  const poleData: PoleData[] = rencanaPoles.map(() => ({
    jtrTypeShort: "S",
    jtrTypeLong: "Suspension",
    jtmTypeShort: "A1",
    jtmTypeLong: "A1",
    kabelTypeShort: "",
    kabelTypeLong: "",
    skutmTypeShort: "",
    skutmTypeLong: "",
    isGrounded: false,
    angle: 0,
    turnSign: 0,
  }));

  // Koordinat virtual untuk poles
  const fakePoles: [number, number][] = rencanaPoles.map(p => [
    p.y / 100000,
    p.x / 100000,
  ]);

  // Siapkan gardu konfigurasi
  const gardus: Record<number, GarduConfig> = {};
  garduNodes.forEach((g, idx) => {
    gardus[idx] = {
      jenis: g.garduJenis || "Portal",
      trafo: `${g.trafoKva || 100} kVA`,
      orientasi: "Horizontal",
      fasa: g.fasa || "3 phs",
    };
  });

  // Siapkan kontramast / schoors
  const schoors: Record<number, SchoorConfig> = {};
  kontramastNodes.forEach((_, idx) => {
    schoors[idx] = {
      jenis: "Kontramast",
    };
  });

  // Kelompokkan kabel rencana berdasarkan kombinasi (jenisJaringan + konduktorJenis + kondukturUkuran)
  const cableGroups = new Map<string, {
    jenisJaringan: string;
    konduktorJenis: "AAAC" | "AAAC/S";
    kondukturUkuran: number;
    totalLenM: number;
  }>();

  for (const edge of rencanaEdges) {
    const jJenis = edge.jenisJaringan || "SUTM";
    const kJenis = (edge.konduktorJenis === "AAAC" ? "AAAC" : "AAAC/S") as "AAAC" | "AAAC/S";
    const kUkuran = edge.kondukturUkuran || 70;
    const key = `${jJenis}__${kJenis}__${kUkuran}`;

    if (!cableGroups.has(key)) {
      cableGroups.set(key, {
        jenisJaringan: jJenis,
        konduktorJenis: kJenis,
        kondukturUkuran: kUkuran,
        totalLenM: 0,
      });
    }
    cableGroups.get(key)!.totalLenM += (edge.lengthM || 0);
  }

  const layers: LayerInputData[] = [];

  if (cableGroups.size === 0) {
    // Ada tiang / gardu / APP tapi belum ada garis kabel terhubung
    layers.push({
      id: 1,
      label: kop.namaPekerjaan || "Skematik Rencana",
      poles: fakePoles,
      line: fakePoles,
      jenisJaringan: "SUTM",
      statusJaringan: "Rencana",
      tinggiTiang: rencanaPoles[0]?.tinggiTiang || 12,
      materialTiang: rencanaPoles[0]?.materialTiang || "Beton",
      kekuatanTiang: rencanaPoles[0]?.kekuatanTiang || 200,
      posisiTiang: rencanaPoles[0]?.posisiTiang || "Tumpu",
      konduktorJenis: "AAAC/S",
      kondukturUkuran: 70,
      manualLengthM: 0,
      poleData,
      gardus,
      schoors,
      boxAppCount: boxAppNodes.length,
      boxAppKva: boxAppNodes[0]?.boxKva || 197,
    });
  } else {
    // Terdapat segmen kabel rencana: buat layer per kelompok kabel
    let layerIdx = 0;
    cableGroups.forEach((cg) => {
      layerIdx++;
      // Lampirkan poles, gardus, schoors, APP ke layer pertama agar tidak terduplikasi
      const isFirst = layerIdx === 1;

      layers.push({
        id: layerIdx,
        label: `${kop.namaPekerjaan || "Skematik"} - ${cg.jenisJaringan} ${cg.konduktorJenis} ${cg.kondukturUkuran}mm²`,
        poles: isFirst ? fakePoles : [],
        line: isFirst ? fakePoles : [],
        jenisJaringan: cg.jenisJaringan,
        statusJaringan: "Rencana",
        tinggiTiang: rencanaPoles[0]?.tinggiTiang || 12,
        materialTiang: rencanaPoles[0]?.materialTiang || "Beton",
        kekuatanTiang: rencanaPoles[0]?.kekuatanTiang || 200,
        posisiTiang: rencanaPoles[0]?.posisiTiang || "Tumpu",
        konduktorJenis: cg.konduktorJenis,
        kondukturUkuran: cg.kondukturUkuran,
        manualLengthM: cg.totalLenM,
        poleData: isFirst ? poleData : undefined,
        gardus: isFirst ? gardus : undefined,
        schoors: isFirst ? schoors : undefined,
        boxAppCount: isFirst ? boxAppNodes.length : undefined,
        boxAppKva: isFirst ? (boxAppNodes[0]?.boxKva || 197) : undefined,
      });
    });
  }

  return layers;
}
