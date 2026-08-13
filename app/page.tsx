"use client";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

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

function HomeContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <div className="text-xl font-bold text-blue-600 animate-pulse">
          Memuat...
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <main>
      <SparkMap projectId={projectId || undefined} />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <div className="text-xl font-bold text-blue-600 animate-pulse">
          Memuat SPARK...
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}