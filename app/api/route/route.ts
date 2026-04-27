import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing start or end" }, { status: 400 });
  }

  const [startLng, startLat] = start.split(",").map(Number);
  const [endLng, endLat] = end.split(",").map(Number);

  let res: Response;
  try {
    res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`,
      { cache: "no-store" }
    );
  } catch (e) {
    console.error("[OSRM] Network error:", e);
    return NextResponse.json({ error: "Network error" }, { status: 502 });
  }

  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.[0]) {
    return NextResponse.json({ error: "No route found" }, { status: 404 });
  }

  // Transform to GeoJSON FeatureCollection so client code stays the same
  return NextResponse.json({
    features: [{ geometry: data.routes[0].geometry }],
  });
}
