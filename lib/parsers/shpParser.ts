import { Asset } from "../offlineDb";

interface ShpGeometry {
  type: "Point" | "LineString";
  coordinates: [number, number] | [number, number][];
  center: [number, number];
}

// Parses DBF file buffer to extract properties records
export function parseDbf(dbfBuffer: ArrayBuffer): Record<string, any>[] {
  const view = new DataView(dbfBuffer);
  const recordsCount = view.getUint32(4, true);
  const headerLength = view.getUint16(8, true);
  const recordLength = view.getUint16(10, true);

  // Field descriptors start at byte 32. Each is 32 bytes.
  // Terminated by 0x0D.
  const fields: { name: string; type: string; length: number }[] = [];
  let offset = 32;

  while (offset < headerLength - 1) {
    if (view.getUint8(offset) === 0x0d) {
      break;
    }

    // Read field name (up to 11 bytes)
    const nameBytes: number[] = [];
    for (let i = 0; i < 11; i++) {
      const b = view.getUint8(offset + i);
      if (b === 0) break;
      nameBytes.push(b);
    }
    const name = String.fromCharCode(...nameBytes).trim().toLowerCase();
    const type = String.fromCharCode(view.getUint8(offset + 11));
    const length = view.getUint8(offset + 16);

    fields.push({ name, type, length });
    offset += 32;
  }

  const records: Record<string, any>[] = [];
  let recordOffset = headerLength;

  const decoder = new TextDecoder("utf-8"); // DBF is usually UTF-8 or Windows-1252

  for (let r = 0; r < recordsCount; r++) {
    if (recordOffset + recordLength > dbfBuffer.byteLength) break;

    // First byte is deletion flag (space ' ' or '*')
    const isDeleted = view.getUint8(recordOffset) === 0x2a; // '*'
    if (isDeleted) {
      recordOffset += recordLength;
      continue;
    }

    const properties: Record<string, any> = {};
    let fieldOffset = recordOffset + 1; // skip deletion flag

    fields.forEach((field) => {
      const fieldData = new Uint8Array(dbfBuffer, fieldOffset, field.length);
      const rawVal = decoder.decode(fieldData).trim();
      
      let val: any = rawVal;
      if (field.type === "N" || field.type === "F") {
        const parsed = parseFloat(rawVal);
        if (!isNaN(parsed)) val = parsed;
      } else if (field.type === "L") {
        val = rawVal.toLowerCase() === "t" || rawVal === "1" || rawVal.toLowerCase() === "y";
      }

      properties[field.name] = val;
      fieldOffset += field.length;
    });

    records.push(properties);
    recordOffset += recordLength;
  }

  return records;
}

// Parses SHP file buffer to extract geometries
export function parseShp(shpBuffer: ArrayBuffer): ShpGeometry[] {
  const view = new DataView(shpBuffer);

  // File Code check
  const fileCode = view.getUint32(0, false);
  if (fileCode !== 9994) {
    throw new Error("Invalid Shapefile file code (expected 9994)");
  }

  // Shape Type (e.g. 1=Point, 3=Polyline, 5=Polygon)
  const globalShapeType = view.getUint32(32, true);

  const geometries: ShpGeometry[] = [];
  let offset = 100; // records start at byte 100
  const fileLength = view.getUint32(24, false) * 2; // file length in bytes

  while (offset < fileLength && offset < shpBuffer.byteLength) {
    // Record Header:
    // 0-3: Record Number (Big Endian)
    // 4-7: Content Length (Big Endian, in 16-bit words)
    if (offset + 8 > shpBuffer.byteLength) break;
    const contentLength = view.getUint32(offset + 4, false) * 2;
    const recordContentOffset = offset + 8;

    if (recordContentOffset + contentLength > shpBuffer.byteLength) break;

    // Record Content:
    // 0-3: Shape Type (Little Endian)
    const shapeType = view.getUint32(recordContentOffset, true);

    if (shapeType === 1) {
      // Point
      // 4-11: X (double, longitude)
      // 12-19: Y (double, latitude)
      const lng = view.getFloat64(recordContentOffset + 4, true);
      const lat = view.getFloat64(recordContentOffset + 12, true);

      geometries.push({
        type: "Point",
        coordinates: [lng, lat],
        center: [lng, lat],
      });
    } else if (shapeType === 3) {
      // Polyline (LineString or MultiLineString, we parse first part as LineString for simplicity)
      // 4-35: Box (4 doubles)
      // 36-39: NumParts (Int32)
      // 40-43: NumPoints (Int32)
      // 44-47: Parts (Int32 Array)
      const numParts = view.getInt32(recordContentOffset + 36, true);
      const numPoints = view.getInt32(recordContentOffset + 40, true);

      let partsOffset = recordContentOffset + 44;
      let pointsOffset = partsOffset + numParts * 4;

      const lineCoords: [number, number][] = [];
      let latSum = 0;
      let lngSum = 0;

      for (let p = 0; p < numPoints; p++) {
        const lng = view.getFloat64(pointsOffset + p * 16, true);
        const lat = view.getFloat64(pointsOffset + p * 16 + 8, true);
        lineCoords.push([lng, lat]);
        latSum += lat;
        lngSum += lng;
      }

      if (lineCoords.length > 0) {
        geometries.push({
          type: "LineString",
          coordinates: lineCoords,
          center: [lngSum / lineCoords.length, latSum / lineCoords.length],
        });
      }
    }

    offset = recordContentOffset + contentLength;
  }

  return geometries;
}

// Main parser to merge SHP and DBF files into Asset array
export function parseShapefile(shpBuffer: ArrayBuffer, dbfBuffer?: ArrayBuffer): Asset[] {
  const geometries = parseShp(shpBuffer);
  const propertiesList = dbfBuffer ? parseDbf(dbfBuffer) : [];

  return geometries.map((geo, index) => {
    const props = propertiesList[index] || {};
    const id = props.id || props.no || props.uuid || `shp-${index}-${Date.now()}`;
    const status = props.status || props.kondisi || "Existing";
    
    // Extensible guess for asset type
    let asset_type = "tiang TM";
    const combinedText = `${id} ${props.asset_type || ""} ${props.jenis || ""} ${props.type || ""}`.toLowerCase();

    if (combinedText.includes("gardu") || combinedText.includes("trafo") || combinedText.includes("substation")) {
      asset_type = "gardu";
    } else if (geo.type === "LineString") {
      if (combinedText.includes("tr") || combinedText.includes("rendah") || combinedText.includes("sktr") || combinedText.includes("skutr")) {
        asset_type = "kabel TR";
      } else {
        asset_type = "kabel TM";
      }
    } else {
      if (combinedText.includes("tr") || combinedText.includes("rendah") || combinedText.includes("skutr") || combinedText.includes("tiang tr")) {
        asset_type = "tiang TR";
      } else {
        asset_type = "tiang TM";
      }
    }

    return {
      id: String(id),
      latitude: geo.center[1],
      longitude: geo.center[0],
      asset_type,
      status,
      properties: props,
      geometry: {
        type: geo.type,
        coordinates: geo.coordinates,
      },
    };
  });
}
