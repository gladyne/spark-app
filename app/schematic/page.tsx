"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Suspense } from "react";

// Dynamic import with SSR disabled for Canvas & LocalStorage
const SchematicWorkspace = dynamic(
  () => import("../../components/schematic/SchematicWorkspace"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-2xl animate-pulse">
            ⚡
          </div>
          <p className="text-sm font-bold text-amber-400">Memuat Mode Gambar Skematik...</p>
        </div>
      </div>
    ),
  }
);

function SchematicContent() {
  const router = useRouter();

  return (
    <SchematicWorkspace
      onSwitchToMap={() => router.push("/")}
    />
  );
}

export default function SchematicPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-100">
          <div className="text-sm font-bold text-slate-400">Loading...</div>
        </div>
      }
    >
      <SchematicContent />
    </Suspense>
  );
}
