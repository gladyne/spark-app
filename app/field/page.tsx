"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { OfflineStoreProvider } from "../../hooks/useOfflineStore";
import SyncPanel from "../../components/field/SyncPanel";
import ImportModal from "../../components/field/ImportModal";
import AssetBottomSheet from "../../components/field/AssetBottomSheet";

// Dynamic import of the map component to prevent SSR execution (required for Leaflet)
const FieldMap = dynamic(() => import("../../components/field/FieldMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 text-sky-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        <span className="text-sm font-bold tracking-wider text-sky-400 animate-pulse">MEMUAT PETA LAPANGAN...</span>
      </div>
    </div>
  ),
});

function FieldAppContent() {
  const [importOpen, setImportOpen] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  return (
    <main className="w-screen h-screen relative overflow-hidden bg-slate-900">
      {/* Map Area */}
      <FieldMap recenterTrigger={recenterTrigger} />

      {/* Top Floating Control Bar & GPS Button */}
      <SyncPanel
        onImportClick={() => setImportOpen(true)}
        onRecenterClick={() => setRecenterTrigger((prev) => prev + 1)}
      />

      {/* Import Modal */}
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />

      {/* Selected Asset Details bottom sheet */}
      <AssetBottomSheet />
    </main>
  );
}

export default function FieldPage() {
  return (
    <OfflineStoreProvider>
      <FieldAppContent />
    </OfflineStoreProvider>
  );
}
