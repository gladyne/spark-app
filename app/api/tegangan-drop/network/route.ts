import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const baseDir = path.join(process.cwd(), "data", "tegangan-drop");
    const [jtrRaw, garduRaw, jtmRaw] = await Promise.all([
      readFile(path.join(baseDir, "jtr.json"), "utf-8"),
      readFile(path.join(baseDir, "gardu.json"), "utf-8"),
      readFile(path.join(baseDir, "jtm.json"), "utf-8"),
    ]);

    return NextResponse.json(
      {
        jtr: JSON.parse(jtrRaw),
        gardu: JSON.parse(garduRaw),
        jtm: JSON.parse(jtmRaw),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  } catch (err) {
    console.error("Gagal memuat data jaringan tegangan drop:", err);
    return NextResponse.json(
      { error: "Gagal memuat data layer jaringan GIS" },
      { status: 500 }
    );
  }
}
