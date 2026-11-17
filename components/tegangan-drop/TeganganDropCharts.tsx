"use client";

import type {
  PreparedReport,
  PriorityLevel,
  SeverityLevel,
} from "@/types/tegangan-drop";
import {
  fmtId,
  groupStackedReports,
  PRIORITY_LABEL,
  SEVERITY_HEX,
  SEVERITY_LABEL,
  sevOf,
} from "@/lib/tegangan-drop/calculations";

const SEV_ORDER: SeverityLevel[] = ["crit", "warn", "ok", "na"];

export function VoltageChip({ v }: { v: number | null }) {
  const sev = sevOf(v);
  return (
    <span
      className="inline-block min-w-[58px] rounded px-2 py-0.5 text-center font-mono text-xs font-semibold text-white"
      style={{ backgroundColor: SEVERITY_HEX[sev] }}
    >
      {v == null ? "–" : fmtId(v)}
    </span>
  );
}

export function PriorityBadge({ prio }: { prio: PriorityLevel }) {
  const bg =
    prio === 1
      ? "bg-red-600"
      : prio === 2
        ? "bg-amber-600"
        : prio === 3
          ? "bg-emerald-600"
          : "bg-slate-600";
  return (
    <span
      className={`inline-block w-8 rounded py-0.5 text-center font-mono text-xs font-bold text-white ${bg}`}
    >
      {PRIORITY_LABEL[prio]}
    </span>
  );
}

export function SeverityLegend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400">
      {SEV_ORDER.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <i
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: SEVERITY_HEX[s] }}
          />
          {SEVERITY_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

export function StackedHorizontalBars({
  rows,
  keyFn,
}: {
  rows: PreparedReport[];
  keyFn: (r: PreparedReport) => string | null;
}) {
  const groups = groupStackedReports(rows, keyFn);
  const max = groups.length ? Math.max(...groups.map((g) => g.n)) : 1;

  return (
    <div>
      <div className="mt-2.5 flex flex-col gap-2">
        {groups.map((g) => (
          <div
            key={g.label}
            className="grid grid-cols-[minmax(100px,170px)_1fr_auto] max-[900px]:grid-cols-[100px_1fr_auto] items-center gap-2.5 text-xs"
          >
            <span className="truncate text-slate-200" title={g.label}>
              {g.label}
            </span>
            <div>
              <div
                className="flex h-4 overflow-hidden rounded bg-slate-800"
                style={{ width: `${(g.n / max) * 100}%` }}
              >
                {SEV_ORDER.filter((s) => g[s] > 0).map((s) => (
                  <i
                    key={s}
                    className="block h-full"
                    style={{
                      width: `${(g[s] / g.n) * 100}%`,
                      backgroundColor: SEVERITY_HEX[s],
                    }}
                    title={`${SEVERITY_LABEL[s]}: ${g[s]}`}
                  />
                ))}
              </div>
            </div>
            <span className="min-w-[96px] text-right font-mono text-xs text-slate-400 whitespace-nowrap">
              <strong className="text-slate-100">{g.n} lap</strong>
              {" · "}
              {g.vmin == null ? "–" : `${fmtId(g.vmin)} V`}
            </span>
          </div>
        ))}
      </div>
      <SeverityLegend />
    </div>
  );
}

export function DailyStackedColumns({ rows }: { rows: PreparedReport[] }) {
  const days = [...new Set(rows.map((r) => r.tgl))].sort();
  const max = days.length
    ? Math.max(...days.map((d) => rows.filter((r) => r.tgl === d).length))
    : 1;

  return (
    <div>
      <div className="mt-2 flex h-[170px] items-end gap-2 pt-5">
        {days.map((d) => {
          const dayRows = rows.filter((r) => r.tgl === d);
          return (
            <div
              key={d}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <span className="font-mono text-xs font-semibold text-slate-100">
                {dayRows.length}
              </span>
              <div
                className="flex w-full max-w-[48px] flex-col-reverse overflow-hidden rounded-t bg-slate-800"
                style={{ height: `${(dayRows.length / max) * 100}%` }}
              >
                {SEV_ORDER.map((s) => {
                  const count = dayRows.filter((r) => r.sev === s).length;
                  if (!count) return null;
                  return (
                    <i
                      key={s}
                      className="block"
                      style={{
                        flexGrow: count,
                        backgroundColor: SEVERITY_HEX[s],
                      }}
                      title={`${d}: ${SEVERITY_LABEL[s]} (${count})`}
                    />
                  );
                })}
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                {d.slice(8, 10)}/{d.slice(5, 7)}
              </span>
            </div>
          );
        })}
      </div>
      <SeverityLegend />
    </div>
  );
}
