import type { Metadata } from "next";
import TeganganDropDashboard from "@/components/tegangan-drop/TeganganDropDashboard";

export const metadata: Metadata = {
  title: "Tegangan Drop · ULP Kupang — SPARK",
  description:
    "Dashboard rekap laporan tegangan drop ULP Kupang dipadukan dengan data jaringan JTR, JTM, gardu, usulan penanganan, dan kebutuhan material.",
};

export default function TeganganDropPage() {
  return <TeganganDropDashboard />;
}
