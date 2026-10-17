"use client";

import { fmtClock, fmtDate, fmtInt, fmtPct } from "@/lib/format";
import type { RetentionPoint } from "@/lib/types";
import { LineChart } from "./LineChart";

export function RelativeChart({ curve, durationSec }: { curve: RetentionPoint[]; durationSec: number }) {
  const vals = curve.map((p) => p.relativeRetentionPerformance);
  return (
    <LineChart
      height={170}
      labels={curve.map((p) => `${Math.round(p.t * 100)}%`)}
      ariaLabel="Relative retention performance compared with similar-length videos"
      yMax={1}
      yTicks={[0, 0.25, 0.5, 0.75, 1]}
      yFormat={(n) => n.toFixed(2).replace(/0$/, "")}
      valueFormat={(n) => n.toFixed(2)}
      xTick={(i) => fmtClock(curve[i]!.t * durationSec)}
      tipTitle={(i) => `${fmtClock(curve[i]!.t * durationSec)} (${Math.round(curve[i]!.t * 100)}% in)`}
      refLine={{ value: 0.5, label: "0.5 = median similar-length video" }}
      tableLabel="Position"
      series={[{ key: "rel", label: "Relative retention", color: "var(--s1)", values: vals }]}
    />
  );
}

export interface SnapPoint {
  date: string;
  ageDays: number;
  views: number | null;
  avgPct: number | null;
  avd: number | null;
}

/** Maturation: the same metric at each snapshot date. */
export function MaturationCharts({ points }: { points: SnapPoint[] }) {
  const labels = points.map((p) => p.date);
  const tip = (i: number) => `${fmtDate(points[i]!.date, true)}, day ${points[i]!.ageDays}`;
  const tick = (i: number) => fmtDate(points[i]!.date);
  return (
    <div className="grid-2">
      <div>
        <h3 className="sub" style={{ marginBottom: 6 }}>Views at each snapshot</h3>
        <LineChart height={190} labels={labels} xTick={tick} tipTitle={tip} ariaLabel="Views at each snapshot date" valueFormat={fmtInt} series={[{ key: "v", label: "Views", color: "var(--s1)", values: points.map((p) => p.views), area: true }]} xTickCount={4} tableLabel="Snapshot" />
      </div>
      <div>
        <h3 className="sub" style={{ marginBottom: 6 }}>Average % viewed at each snapshot</h3>
        <LineChart height={190} labels={labels} xTick={tick} tipTitle={tip} ariaLabel="Average percentage viewed at each snapshot date" yFormat={(n) => `${Math.round(n)}%`} valueFormat={(n) => fmtPct(n)} yMax={100} yTicks={[0, 25, 50, 75, 100]} series={[{ key: "p", label: "Avg % viewed", color: "var(--s1)", values: points.map((p) => p.avgPct) }]} xTickCount={4} tableLabel="Snapshot" />
      </div>
    </div>
  );
}
