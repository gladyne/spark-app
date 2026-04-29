"use client";
import { useState } from "react";

interface HistoryEntry { description: string; }

interface Props {
  history: HistoryEntry[];
  redoStack: HistoryEntry[];
  onUndo: () => void;
  onRedo: () => void;
  onJumpTo: (historyIdx: number) => void;
}

export default function UndoRedoPanel({ history, redoStack, onUndo, onRedo, onJumpTo }: Props) {
  const [showLog, setShowLog] = useState(false);

  const canUndo = history.length > 0;
  const canRedo = redoStack.length > 0;

  return (
    <div className="border-2 border-gray-200 rounded-xl bg-gray-50 overflow-hidden">

      {/* Tombol Undo / Redo — selalu terlihat */}
      <div className="flex gap-1.5 px-3 pt-3 pb-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`flex-1 py-1.5 text-xs rounded-lg font-bold border transition-all flex items-center justify-center gap-1 ${
            canUndo
              ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-100 hover:border-gray-400"
              : "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed"
          }`}
        >
          ↩ Undo
          {canUndo && (
            <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
              {history.length}
            </span>
          )}
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`flex-1 py-1.5 text-xs rounded-lg font-bold border transition-all flex items-center justify-center gap-1 ${
            canRedo
              ? "bg-white border-amber-300 text-amber-700 hover:bg-amber-50"
              : "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed"
          }`}
        >
          ↪ Redo
          {canRedo && (
            <span className="bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
              {redoStack.length}
            </span>
          )}
        </button>
        {/* Toggle log */}
        <button
          onClick={() => setShowLog(v => !v)}
          disabled={history.length === 0 && redoStack.length === 0}
          className={`px-2 py-1.5 text-xs rounded-lg border transition-all ${
            history.length > 0 || redoStack.length > 0
              ? "bg-white border-gray-300 text-gray-500 hover:bg-gray-100"
              : "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed"
          }`}
          title="Lihat riwayat"
        >
          {showLog ? "▲" : "☰"}
        </button>
      </div>

      {/* Log — hanya tampil saat showLog = true */}
      {showLog && (
        <div className="border-t border-gray-200 px-3 pb-3">
          <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mt-2 mb-1">
            Riwayat — klik untuk lompat ke state tersebut
          </p>
          <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
            {/* Redo stack — di atas (masa depan) */}
            {[...redoStack].reverse().map((h, i) => (
              <div key={`redo-${i}`}
                className="text-[10px] px-2 py-0.5 rounded text-amber-500 italic flex items-center gap-1 opacity-60">
                <span className="text-[9px]">⟳</span>
                <span>{h.description}</span>
              </div>
            ))}
            {/* Pembatas posisi saat ini */}
            <div className="flex items-center gap-1 py-0.5">
              <div className="flex-1 border-t border-blue-300" />
              <span className="text-[9px] text-blue-500 font-bold">sekarang</span>
              <div className="flex-1 border-t border-blue-300" />
            </div>
            {/* History — dari terbaru ke terlama, clickable */}
            {[...history].reverse().map((h, reversedIdx) => {
              const originalIdx = history.length - 1 - reversedIdx;
              return (
                <button
                  key={`hist-${originalIdx}`}
                  onClick={() => onJumpTo(originalIdx)}
                  className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 w-full text-left transition-colors ${
                    reversedIdx === 0
                      ? "bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200"
                      : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  {reversedIdx === 0 && <span className="text-[9px]">▶</span>}
                  <span className={reversedIdx === 0 ? "" : "ml-3"}>{h.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
