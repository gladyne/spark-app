"use client";
import { useState } from "react";
import type { HistoryState } from "../types/spark";

export function useHistory(
  getPoles: () => [number, number][],
  getLine: () => [number, number][],
  getGardus: () => HistoryState["gardus"],
  getSchoors: () => HistoryState["schoors"],
  setPoles: (v: [number, number][]) => void,
  setLine: (v: [number, number][]) => void,
  setGardus: (v: HistoryState["gardus"]) => void,
  setSchoors: (v: HistoryState["schoors"]) => void,
) {
  const [history, setHistory] = useState<HistoryState[]>([]);

  const commitHistory = () => {
    setHistory(prev => [...prev, {
      poles: [...getPoles()],
      line: [...getLine()],
      gardus: { ...getGardus() },
      schoors: { ...getSchoors() },
    }].slice(-20));
  };

  const handleUndo = () => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setPoles(last.poles);
      setLine(last.line);
      setGardus(last.gardus);
      setSchoors(last.schoors);
      return prev.slice(0, -1);
    });
  };

  return { history, setHistory, commitHistory, handleUndo };
}
