import { Asset } from "../offlineDb";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSV(csvText: string): Asset[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, ""));

  // Find column indexes
  const idIdx = headers.findIndex((h) => h === "id" || h === "no" || h === "uuid" || h === "kode");
  const latIdx = headers.findIndex((h) => h === "latitude" || h === "lat" || h === "y");
  const lngIdx = headers.findIndex((h) => h === "longitude" || h === "lng" || h === "lon" || h === "x");
  const typeIdx = headers.findIndex(
    (h) => h === "asset_type" || h === "type" || h === "jenis" || h === "kategori"
  );
  const statusIdx = headers.findIndex((h) => h === "status" || h === "kondisi");

  // Optional columns for simple LineString if available (e.g. start/end coords)
  const startLatIdx = headers.findIndex((h) => h === "start_latitude" || h === "start_lat");
  const startLngIdx = headers.findIndex((h) => h === "start_longitude" || h === "start_lng");
  const endLatIdx = headers.findIndex((h) => h === "end_latitude" || h === "end_lat");
  const endLngIdx = headers.findIndex((h) => h === "end_longitude" || h === "end_lng");

  const assets: Asset[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;

    const properties: Record<string, any> = {};
    headers.forEach((header, index) => {
      const val = values[index];
      // Clean up string quotes
      properties[header] = val ? val.replace(/^["']|["']$/g, "") : "";
    });

    const id = idIdx !== -1 ? properties[headers[idIdx]] : `csv-${i}-${Date.now()}`;
    const status = statusIdx !== -1 ? properties[headers[statusIdx]] : "Existing";
    let asset_type = typeIdx !== -1 ? properties[headers[typeIdx]].toLowerCase() : "tiang tm";

    // Standardize asset types to standard enums
    if (asset_type.includes("gardu") || asset_type.includes("trafo")) {
      asset_type = "gardu";
    } else if (asset_type.includes("kabel tm") || asset_type.includes("sktm") || asset_type.includes("sutm")) {
      // Check if it's cable or pole
      if (asset_type.includes("kabel") || asset_type.includes("sk")) {
        asset_type = "kabel TM";
      } else {
        asset_type = "tiang TM";
      }
    } else if (asset_type.includes("kabel tr") || asset_type.includes("skutr") || asset_type.includes("sktr")) {
      if (asset_type.includes("kabel") || asset_type.includes("sk")) {
        asset_type = "kabel TR";
      } else {
        asset_type = "tiang TR";
      }
    } else if (asset_type.includes("tiang tm") || asset_type.includes("tm")) {
      asset_type = "tiang TM";
    } else if (asset_type.includes("tiang tr") || asset_type.includes("tr")) {
      asset_type = "tiang TR";
    } else {
      // Fallback or custom user asset types (extensible)
      asset_type = properties[headers[typeIdx]] || "tiang TM";
    }

    let lat = 0;
    let lng = 0;
    let geometry: Asset["geometry"] = undefined;

    // Check if it is a LineString asset (like cables with start/end coordinates)
    if (startLatIdx !== -1 && startLngIdx !== -1 && endLatIdx !== -1 && endLngIdx !== -1) {
      const sLat = parseFloat(properties[headers[startLatIdx]]);
      const sLng = parseFloat(properties[headers[startLngIdx]]);
      const eLat = parseFloat(properties[headers[endLatIdx]]);
      const eLng = parseFloat(properties[headers[endLngIdx]]);

      if (!isNaN(sLat) && !isNaN(sLng) && !isNaN(eLat) && !isNaN(eLng)) {
        geometry = {
          type: "LineString",
          coordinates: [
            [sLng, sLat],
            [eLng, eLat],
          ],
        };
        // The midpoint represents the overall coordinate
        lat = (sLat + eLat) / 2;
        lng = (sLng + eLng) / 2;
      }
    } else if (latIdx !== -1 && lngIdx !== -1) {
      // Standard Point asset
      const rawLat = parseFloat(properties[headers[latIdx]]);
      const rawLng = parseFloat(properties[headers[lngIdx]]);

      if (!isNaN(rawLat) && !isNaN(rawLng)) {
        lat = rawLat;
        lng = rawLng;
        geometry = {
          type: "Point",
          coordinates: [lng, lat],
        };
      }
    }

    // Ignore assets with invalid coordinates
    if (lat === 0 && lng === 0) continue;

    assets.push({
      id,
      latitude: lat,
      longitude: lng,
      asset_type,
      status,
      properties,
      geometry,
    });
  }

  return assets;
}
