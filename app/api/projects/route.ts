import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// GET: List semua project milik user yang login
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      mapCenter: true,
      mapZoom: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(projects);
}

// POST: Buat project baru
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const { name, description, data, mapCenter, mapZoom } = await req.json();

  if (!name) {
    return NextResponse.json(
      { error: "Nama project wajib diisi" },
      { status: 400 }
    );
  }

  const project = await prisma.project.create({
    data: {
      name,
      description: description || "",
      data: data ? JSON.stringify(data) : "{}",
      mapCenter: mapCenter ? JSON.stringify(mapCenter) : "[-0.7893, 113.9213]",
      mapZoom: mapZoom || 13,
      userId,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
