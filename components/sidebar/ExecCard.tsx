"use client";

interface Props {
  routingMode: "jalan" | "lurus";
  setRoutingMode: (v: "jalan" | "lurus") => void;
  isLoading: boolean;
  onGenerate: () => void;
  onClear: () => void;
}

export default function ExecCard({ routingMode, setRoutingMode, isLoading, onGenerate, onClear }: Props) {
  return (
    <div className="border border-gray-200 p-4 rounded-xl bg-gray-50">
      <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase">Eksekusi</h3>
      <div className="mb-3">
        <label className="text-xs text-gray-600 font-semibold mb-1.5 block">Mode Rute:</label>
        <div className="flex rounded-lg overflow-hidden border border-gray-300 text-xs font-bold">
          <button onClick={() => setRoutingMode("jalan")}
            className={`flex-1 py-2 transition-all ${routingMode === "jalan" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
            🛣️ Ikut Jalan
          </button>
          <button onClick={() => setRoutingMode("lurus")}
            className={`flex-1 py-2 transition-all border-l border-gray-300 ${routingMode === "lurus" ? "bg-orange-500 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}>
            📐 Garis Lurus
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          {routingMode === "jalan" ? "Rute mengikuti jalur jalan (OSRM)" : "Garis langsung A→B, cocok untuk area ladang / non-jalan"}
        </p>
      </div>
      <button onClick={onGenerate} disabled={isLoading}
        className={`w-full p-3 mb-2 rounded-lg text-white font-bold shadow-md transition-all ${isLoading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"}`}>
        {isLoading ? "🔄 Menghitung Rute..." : "⚡ Generate Jaringan"}
      </button>
      <button onClick={onClear} className="w-full p-2.5 rounded-lg text-sm bg-red-500 hover:bg-red-600 text-white font-bold transition-all">
        🗑️ Reset Peta
      </button>
    </div>
  );
}
