import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(
      process.cwd(),
      "data",
      "tegangan-drop",
      "laporan.json"
    );
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Gagal memuat laporan tegangan drop:", err);
    return NextResponse.json(
      { error: "Gagal memuat data laporan tegangan drop" },
      { status: 500 }
    );
  }
}
