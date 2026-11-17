import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFile } from "fs/promises";
import path from "path";
import { authOptions } from "../../auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
