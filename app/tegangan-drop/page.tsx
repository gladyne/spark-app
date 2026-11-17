import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/route";
import TeganganDropDashboard from "@/components/tegangan-drop/TeganganDropDashboard";

export const metadata: Metadata = {
  title: "Tegangan Drop · ULP Kupang — SPARK",
  description:
    "Dashboard rekap laporan tegangan drop ULP Kupang dipadukan dengan data jaringan JTR, JTM, gardu, usulan penanganan, dan kebutuhan material.",
};

export const dynamic = "force-dynamic";

export default async function TeganganDropPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return <TeganganDropDashboard />;
}
