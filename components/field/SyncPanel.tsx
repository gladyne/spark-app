"use client";

import React, { useState } from "react";
import { useOfflineStore } from "../../hooks/useOfflineStore";

interface SyncPanelProps {
  onImportClick: () => void;
  onRecenterClick: () => void;
}

export default function SyncPanel({ onImportClick, onRecenterClick }: SyncPanelProps) {
  const { assets, isOffline, isSyncing, loadAssets, clearAssets } = useOfflineStore();
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const handleSync = async () => {
    try {
      await loadAssets();
      triggerToast("Data ter-sinkronisasi dengan IndexedDB!");
    } catch (e) {
      triggerToast("Gagal melakukan sinkronisasi");
    }
  };

  const handleClear = async () => {
    try {
      await clearAssets();
      setShowConfirmClear(false);
      triggerToast("Database offline berhasil dibersihkan!");
    } catch (e) {
      triggerToast("Gagal membersihkan database");
    }
  };

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  return (
    <>
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-[999] flex flex-col gap-2">
        <div className="w-full bg-white/95 backdrop-blur-md shadow-lg rounded-2xl border border-gray-100 p-3 flex items-center justify-between transition-all">
          {/* Brand & Connection State */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold text-slate-800 tracking-tight">SPARK Field</h1>
              <span className={`w-2 h-2 rounded-full ${isOffline ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
            </div>
            <div className="text-[10px] text-gray-500 font-semibold mt-0.5">
              {assets.length} aset disimpan offline
            </div>
          </div>

          {/* Quick Actions (min touch size 44px achieved through padding/margins) */}
          <div className="flex items-center gap-1">
            {/* Sync Button */}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="w-10 h-10 rounded-xl bg-gray-50 active:bg-gray-100 hover:bg-gray-100 text-slate-600 flex items-center justify-center transition-colors disabled:opacity-50 touch-manipulation focus:outline-none"
              title="Sinkronisasi Data"
            >
              <svg className={`w-5 h-5 ${isSyncing ? "animate-spin text-sky-600" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>

            {/* Import Button */}
            <button
              onClick={onImportClick}
              className="w-10 h-10 rounded-xl bg-sky-50 active:bg-sky-100 hover:bg-sky-100 text-sky-600 flex items-center justify-center transition-colors touch-manipulation focus:outline-none"
              title="Import Data File"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>

            {/* Delete/Clear Button */}
            <button
              onClick={() => setShowConfirmClear(true)}
              className="w-10 h-10 rounded-xl bg-red-50 active:bg-red-100 hover:bg-red-100 text-red-600 flex items-center justify-center transition-colors touch-manipulation focus:outline-none"
              title="Hapus Database Lokal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </div>

        {/* Offline Warning Notice */}
        {isOffline && (
          <div className="w-full bg-red-500 text-white text-xs font-semibold py-1.5 px-3 rounded-xl shadow-md flex items-center justify-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Mode Offline Aktif — Menggunakan data lokal
          </div>
        )}
      </div>

      {/* Floating GPS Recenter Button (placed in bottom right, above details sheet) */}
      <button
        onClick={onRecenterClick}
        className="absolute bottom-6 right-6 z-[999] w-12 h-12 bg-white active:bg-gray-100 hover:bg-gray-100 text-sky-600 rounded-full shadow-lg flex items-center justify-center border border-gray-100 touch-manipulation focus:outline-none"
        title="Centang Posisi GPS"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      </button>

      {/* Confirmation Modal for Clearing Database */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-[1001] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Hapus Data Offline?</h3>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              Tindakan ini akan menghapus seluruh data aset kelistrikan yang tersimpan di IndexedDB perangkat ini secara permanen. Anda perlu melakukan import ulang.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="flex-1 h-11 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs touch-manipulation"
              >
                Batal
              </button>
              <button
                onClick={handleClear}
                className="flex-1 h-11 bg-red-600 active:bg-red-700 hover:bg-red-700 text-white font-semibold rounded-xl text-xs touch-manipulation"
              >
                Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Toast Notification */}
      {showToast && (
        <div className="fixed bottom-28 left-4 right-4 z-[1001] bg-slate-800 text-white text-xs font-semibold py-3 px-4 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {toastMsg}
        </div>
      )}
    </>
  );
}
