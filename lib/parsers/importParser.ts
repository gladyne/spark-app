import JSZip from "jszip";
import { Asset } from "../offlineDb";
import { parseCSV } from "./csvParser";
import { parseKML } from "./kmlParser";
import { parseShapefile } from "./shpParser";

export async function parseImportFile(file: File): Promise<Asset[]> {
  const fileName = file.name.toLowerCase();

  // 1. CSV
  if (fileName.endsWith(".csv")) {
    const text = await file.text();
    return parseCSV(text);
  }

  // 2. KML
  if (fileName.endsWith(".kml")) {
    const text = await file.text();
    return parseKML(text);
  }

  // 3. KMZ (zipped KML)
  if (fileName.endsWith(".kmz")) {
    const buffer = await file.arrayBuffer();
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(buffer);
    
    // Find the first .kml file inside
    const kmlFileName = Object.keys(zipContent.files).find((name) =>
      name.toLowerCase().endsWith(".kml")
    );

    if (!kmlFileName) {
      throw new Error("No KML file found inside the KMZ package");
    }

    const kmlText = await zipContent.files[kmlFileName].async("text");
    return parseKML(kmlText);
  }

  // 4. SHP directly (without DBF, limited properties)
  if (fileName.endsWith(".shp")) {
    const shpBuffer = await file.arrayBuffer();
    return parseShapefile(shpBuffer);
  }

  // 5. ZIP containing SHP & DBF (Shapefile Bundle)
  if (fileName.endsWith(".zip")) {
    const buffer = await file.arrayBuffer();
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(buffer);

    // Find .shp and .dbf files
    const shpFileName = Object.keys(zipContent.files).find((name) =>
      name.toLowerCase().endsWith(".shp")
    );
    const dbfFileName = Object.keys(zipContent.files).find((name) =>
      name.toLowerCase().endsWith(".dbf")
    );

    if (!shpFileName) {
      throw new Error("No .shp file found inside the ZIP package");
    }

    const shpBuffer = await zipContent.files[shpFileName].async("arraybuffer");
    let dbfBuffer: ArrayBuffer | undefined = undefined;

    if (dbfFileName) {
      dbfBuffer = await zipContent.files[dbfFileName].async("arraybuffer");
    }

    return parseShapefile(shpBuffer, dbfBuffer);
  }

  throw new Error("Unsupported file format. Please upload CSV, KML, KMZ, SHP, or ZIP (Shapefile).");
}
