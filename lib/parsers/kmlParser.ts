import { Asset } from "../offlineDb";

export function parseKML(kmlText: string): Asset[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, "text/xml");
  const placemarks = xmlDoc.getElementsByTagName("Placemark");
  const assets: Asset[] = [];

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];

    // Extract Name / ID
    const nameNode = pm.getElementsByTagName("name")[0];
    const rawName = nameNode?.textContent?.trim() || "";
    const id = rawName || `kml-${i}-${Date.now()}`;

    // Extract Description / Properties
    const descNode = pm.getElementsByTagName("description")[0];
    const description = descNode?.textContent?.trim() || "";

    const properties: Record<string, any> = {
      name: rawName,
      description,
    };

    // Extract ExtendedData if available
    const extendedData = pm.getElementsByTagName("ExtendedData")[0];
    if (extendedData) {
      const dataNodes = extendedData.getElementsByTagName("Data");
      for (let j = 0; j < dataNodes.length; j++) {
        const nameAttr = dataNodes[j].getAttribute("name");
        const valueNode = dataNodes[j].getElementsByTagName("value")[0];
        if (nameAttr && valueNode?.textContent) {
          properties[nameAttr.toLowerCase()] = valueNode.textContent.trim();
        }
      }
      const simpleDataNodes = extendedData.getElementsByTagName("SimpleData");
      for (let j = 0; j < simpleDataNodes.length; j++) {
        const nameAttr = simpleDataNodes[j].getAttribute("name");
        if (nameAttr && simpleDataNodes[j].textContent) {
          properties[nameAttr.toLowerCase()] = simpleDataNodes[j].textContent!.trim();
        }
      }
    }

    // Try parsing tables in HTML description if ExtendedData was empty
    if (description.includes("<table") || description.includes("<tr")) {
      try {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = description;
        const rows = tempDiv.getElementsByTagName("tr");
        for (let r = 0; r < rows.length; r++) {
          const cells = rows[r].getElementsByTagName("td");
          if (cells.length >= 2) {
            const key = cells[0].textContent?.trim().toLowerCase().replace(/:/g, "") || "";
            const val = cells[1].textContent?.trim() || "";
            if (key) {
              properties[key] = val;
            }
          }
        }
      } catch (e) {
        // Ignored
      }
    }

    // Determine geometry type and coordinates
    let geometry: Asset["geometry"] = undefined;
    let lat = 0;
    let lng = 0;

    // Check for Point
    const pointNode = pm.getElementsByTagName("Point")[0];
    if (pointNode) {
      const coordNode = pointNode.getElementsByTagName("coordinates")[0];
      if (coordNode && coordNode.textContent) {
        const coords = coordNode.textContent.trim().split(",");
        if (coords.length >= 2) {
          lng = parseFloat(coords[0]);
          lat = parseFloat(coords[1]);
          geometry = {
            type: "Point",
            coordinates: [lng, lat],
          };
        }
      }
    }

    // Check for LineString (cables)
    const lineNode = pm.getElementsByTagName("LineString")[0];
    if (lineNode) {
      const coordNode = lineNode.getElementsByTagName("coordinates")[0];
      if (coordNode && coordNode.textContent) {
        const coordPairs = coordNode.textContent
          .trim()
          .split(/\s+/)
          .filter((pair) => pair.length > 0);

        const lineCoords: [number, number][] = [];
        let latSum = 0;
        let lngSum = 0;

        coordPairs.forEach((pair) => {
          const parts = pair.split(",");
          if (parts.length >= 2) {
            const pLng = parseFloat(parts[0]);
            const pLat = parseFloat(parts[1]);
            if (!isNaN(pLng) && !isNaN(pLat)) {
              lineCoords.push([pLng, pLat]);
              latSum += pLat;
              lngSum += pLng;
            }
          }
        });

        if (lineCoords.length > 0) {
          geometry = {
            type: "LineString",
            coordinates: lineCoords,
          };
          // Midpoint representation
          lat = latSum / lineCoords.length;
          lng = lngSum / lineCoords.length;
        }
      }
    }

    // Ignore placemarks without geometries
    if (lat === 0 && lng === 0) continue;

    // Guess Asset Type based on tags, description, name or geometry type
    let asset_type = "tiang TM"; // default
    const combinedText = `${id} ${description} ${properties.asset_type || ""} ${properties.jenis || ""}`.toLowerCase();

    if (combinedText.includes("gardu") || combinedText.includes("trafo") || combinedText.includes("substation")) {
      asset_type = "gardu";
    } else if (geometry?.type === "LineString") {
      if (combinedText.includes("tr") || combinedText.includes("rendah") || combinedText.includes("sktr") || combinedText.includes("skutr")) {
        asset_type = "kabel TR";
      } else {
        asset_type = "kabel TM";
      }
    } else {
      // Points
      if (combinedText.includes("tr") || combinedText.includes("rendah") || combinedText.includes("skutr") || combinedText.includes("tiang tr")) {
        asset_type = "tiang TR";
      } else {
        asset_type = "tiang TM";
      }
    }

    // Guess Status
    let status = "Existing";
    if (combinedText.includes("perluasan") || combinedText.includes("rencana") || combinedText.includes("plan")) {
      status = "Perluasan";
    }

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
