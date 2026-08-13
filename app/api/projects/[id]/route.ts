import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// GET: Load satu project
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as any).id;
  const project = await prisma.project.findFirst({
    where: { id, userId },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project tidak ditemukan" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...project,
    data: JSON.parse(project.data),
    mapCenter: JSON.parse(project.mapCenter),
  });
}

// PUT: Update/save project
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as any).id;

  // Verify ownership
  const existing = await prisma.project.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Project tidak ditemukan" },
      { status: 404 }
    );
  }

  const body = await req.json();
  const updateData: any = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.data !== undefined) updateData.data = JSON.stringify(body.data);
  if (body.mapCenter !== undefined)
    updateData.mapCenter = JSON.stringify(body.mapCenter);
  if (body.mapZoom !== undefined) updateData.mapZoom = body.mapZoom;

  const project = await prisma.project.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({
    ...project,
    data: JSON.parse(project.data),
    mapCenter: JSON.parse(project.mapCenter),
  });
}

// DELETE: Hapus project
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as any).id;

  const existing = await prisma.project.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Project tidak ditemukan" },
      { status: 404 }
    );
  }

  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ message: "Project berhasil dihapus" });
}
