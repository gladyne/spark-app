"use client";
import dynamic from "next/dynamic";


// Trik Next.js: Mematikan Server-Side Rendering (SSR) khusus untuk komponen Peta
const SparkMap = dynamic(() => import("../components/SparkMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100">
      <div className="text-xl font-bold text-blue-600 animate-pulse">
        Memuat Peta SPARK...
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main>
      <SparkMap />
    </main>
  );
}