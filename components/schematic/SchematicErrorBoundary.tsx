"use client";

import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

const STORAGE_KEY = "spark_schematic_v1";

export default class SchematicErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("SchematicErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      if (this.props.onReset) {
        this.props.onReset();
      } else {
        window.location.reload();
      }
    } catch (e) {
      console.warn("Gagal mereset data dari localStorage:", e);
      window.location.reload();
    }
  };

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "Kesalahan client-side tidak diketahui";

      return (
        <div className="flex h-full w-full min-h-[480px] items-center justify-center bg-slate-950 p-6 text-slate-100 select-none">
          <div className="max-w-lg w-full bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            {/* Icon Peringatan */}
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 text-3xl mb-4 shadow-inner">
              ⚠️
            </div>

            <h2 className="text-lg font-black text-white tracking-tight mb-2">
              {this.props.fallbackTitle || "Terjadi Kendala pada Mode Skematik"}
            </h2>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Komponen skematik mengalami error saat memproses data. Anda dapat mencoba memuat ulang halaman, atau mereset data proyek jika data lokal lama tidak kompatibel.
            </p>

            {/* Kotak Pesan Error Teknis */}
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-left mb-5 max-h-32 overflow-auto font-mono text-[11px] text-red-300/90 break-words">
              <span className="font-bold text-red-400 block mb-1">Pesan Error:</span>
              {errorMsg}
            </div>

            {/* Tombol Aksi Pemulihan */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                🔄 Muat Ulang Halaman
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-md transition cursor-pointer"
              >
                🗑️ Reset Data Project Ini
              </button>
            </div>
            <span className="text-[10px] text-slate-500 mt-3">
              Catatan: &ldquo;Reset Data&rdquo; akan mengosongkan cache skematik lokal yang bermasalah agar kanvas kembali normal.
            </span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
