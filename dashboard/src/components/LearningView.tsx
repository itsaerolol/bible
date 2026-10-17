"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmtPct, fmtSeconds, median } from "@/lib/format";
import type { VideoRow } from "@/lib/model";
import { Icon } from "./Icon";
import { StripPlot, TimeScatter, type StripGroup, type TimePoint } from "./StripPlot";
import { Empty, NBadge } from "./ui";

interface MetricDef {
  key: string;
  label: string;
  get: (r: VideoRow) => number | null;
  fmt: (n: number) => string;
  fixed?: [number, number];
}

const METRICS: MetricDef[] = [
  { key: "pct", label: "Avg % viewed", get: (r) => r.m.averageViewPercentage, fmt: (n) => fmtPct(n, 0), fixed: [0, 100] },
  { key: "avd", label: "Avg view duration", get: (r) => r.m.averageViewDuration, fmt: (n) => fmtSeconds(n) },
  { key: "r3", label: "Held at 3s", get: (r) => (r.at3s == null ? null : r.at3s * 100), fmt: (n) => `${n.toFixed(0)}%`, fixed: [0, 100] },
  { key: "eng", label: "Engaged view rate", get: (r) => (r.engagedRate == null ? null : r.engagedRate * 100), fmt: (n) => `${n.toFixed(0)}%`, fixed: [0, 100] },
  { key: "likes", label: "Likes per 1K views", get: (r) => r.likesPer1k, fmt: (n) => n.toFixed(0) },
];

const niceStep = (x: number) => {
  const p = 10 ** Math.floor(Math.log10(x));
  return [1, 2, 2.5, 5, 10, 20].map((m) => m * p).find((v) => v >= x) ?? x;
};

/** Axis range that fits the dots with some air. Dots do not need a zero baseline, the axis labels say where it starts. */
function dataDomain(vals: number[], cap?: number): [number, number] {
  if (!vals.length) return [0, 1];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, Math.abs(max) * 0.1, 1);
  const rawLo = Math.max(0, min - span * 0.35);
  let rawHi = max + span * 0.35;
  if (cap != null) rawHi = Math.min(cap, rawHi);
  let step = niceStep((rawHi - rawLo) / 4);
  for (let i = 0; i < 6; i++) {
    const lo = Math.floor(rawLo / step) * step;
    if (lo + 4 * step >= rawHi) return [lo, lo + 4 * step];
    step = niceStep(step * 1.05);
  }
  return [0, rawHi];
}

function semverSort(a: string, b: string): number {
  const pa = a.split(".").map((x) => parseInt(x, 10));
  const pb = b.split(".").map((x) => parseInt(x, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return a.localeCompare(b);
}

function groupRows(rows: VideoRow[], pick: (r: VideoRow) => string | null, metric: MetricDef, order: "semver" | "size"): { groups: StripGroup[]; unlinked: number } {
  const map = new Map<string, VideoRow[]>();
  let unlinked = 0;
  for (const r of rows) {
    if (!r.hasEpisode) {
      unlinked++;
      continue;
    }
    const k = pick(r) ?? "Not set";
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  const groups: StripGroup[] = [...map.entries()].map(([label, rs]) => ({
    label: pick === pickVersion && label !== "Not set" ? `Design system v${label}` : label,
    nTotal: rs.length,
    dots: rs.flatMap((r) => {
      const v = metric.get(r);
      return v == null ? [] : [{ id: r.id, title: r.title, value: v, date: r.publishedDate }];
    }),
  }));
  groups.sort((a, b) => {
    if (order === "semver") return semverSort(a.label.replace(/^Design system v/, ""), b.label.replace(/^Design system v/, ""));
    return b.nTotal - a.nTotal || a.label.localeCompare(b.label);
  });
  return { groups, unlinked };
}

const pickVersion = (r: VideoRow) => r.dsVersion;
const pickHook = (r: VideoRow) => r.hookType;

export function LearningView({ rows }: { rows: VideoRow[] }) {
  const [metricKey, setMetricKey] = useState("pct");
  const [includeYoung, setIncludeYoung] = useState(false);
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0]!;

  const view = useMemo(() => {
    const base = rows.filter((r) => r.hasSnapshot && (includeYoung || r.mature));
    const all = base.map((r) => metric.get(r)).filter((v): v is number => v != null);
    const domain = dataDomain(all, metric.fixed?.[1]);
    const byVersion = groupRows(base, pickVersion, metric, "semver");
    const byHook = groupRows(base, pickHook, metric, "size");
    const time: TimePoint[] = base
      .filter((r) => metric.get(r) != null)
      .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
      .map((r) => ({ id: r.id, title: r.title, value: metric.get(r) as number, date: r.publishedDate, version: r.dsVersion }));
    const excluded = rows.filter((r) => r.hasSnapshot && !includeYoung && !r.mature).length;
    const noData = rows.filter((r) => !r.hasSnapshot).length;
    return { base, domain, byVersion, byHook, time, excluded, noData };
  }, [rows, metric, includeYoung]);

  if (rows.length === 0) return <Empty title="No videos yet">Nothing to compare until the first videos are tracked.</Empty>;

  return (
    <>
      <div className="callout" role="note">
        <Icon name="info" size={18} />
        <div>
          <strong>Read this as description, not proof.</strong> Hook type, design system version, topic, passage and posting date all change together, and each group holds only a handful of videos. A gap between groups is a prompt to look closer. It does not show that one thing caused another.
        </div>
      </div>

      <div className="filters" role="group" aria-label="Learning controls">
        <label className="sub" htmlFor="metric" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Metric
          <select id="metric" className="field" value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={includeYoung} onChange={(e) => setIncludeYoung(e.target.checked)} />
          Include videos under 7 days
        </label>
        <span className="sub">
          Using {view.base.length} video{view.base.length === 1 ? "" : "s"}
          {view.excluded > 0 && !includeYoung ? `, ${view.excluded} still maturing left out` : ""}
          {view.noData > 0 ? `, ${view.noData} without analytics yet` : ""}.
        </span>
      </div>

      {view.base.length === 0 ? (
        <Empty title="Nothing to compare yet">No tracked video is old enough. Videos need 7 days to mature, or tick the box above to include younger ones.</Empty>
      ) : (
        <>
          <section className="card" aria-label="By design system version">
            <div className="card-head">
              <h2>By design system version</h2>
              <span className="sub">{metric.label}. Dots are videos, the bar is the group median.</span>
            </div>
            <StripPlot groups={view.byVersion.groups} fmt={metric.fmt} domain={view.domain} metricLabel={metric.label} />
            {view.byVersion.unlinked > 0 && <p className="sub">{view.byVersion.unlinked} video{view.byVersion.unlinked === 1 ? " is" : "s are"} not linked to an episode record and cannot be grouped.</p>}
            <SummaryTable groups={view.byVersion.groups} fmt={metric.fmt} first="Version" />
          </section>

          <section className="card" aria-label="By hook type">
            <div className="card-head">
              <h2>By hook type</h2>
              <span className="sub">{metric.label}. Same rules: small groups, descriptive only.</span>
            </div>
            <StripPlot groups={view.byHook.groups} fmt={metric.fmt} domain={view.domain} metricLabel={metric.label} />
            <SummaryTable groups={view.byHook.groups} fmt={metric.fmt} first="Hook type" />
          </section>

          <section className="card" aria-label="In publish order">
            <div className="card-head">
              <h2>In publish order</h2>
              <span className="sub">{metric.label}, oldest to newest. Rules mark where the design system version changed.</span>
            </div>
            <TimeScatter points={view.time} fmt={metric.fmt} metricLabel={metric.label} domain={view.domain} />
          </section>
        </>
      )}
    </>
  );
}

function SummaryTable({ groups, fmt, first }: { groups: StripGroup[]; fmt: (n: number) => string; first: string }) {
  return (
    <details className="table-view" open>
      <summary>Table view</summary>
      <div className="table-wrap" style={{ marginTop: 6 }}>
        <table className="data">
          <thead>
            <tr>
              <th className="l">{first}</th>
              <th>n</th>
              <th>Median</th>
              <th>Lowest</th>
              <th>Highest</th>
              <th className="l">Videos</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const vals = g.dots.map((d) => d.value);
              return (
                <tr key={g.label}>
                  <td className="l">{g.label}</td>
                  <td>
                    <NBadge n={g.dots.length} label="n" />
                  </td>
                  <td>{vals.length ? fmt(median(vals) as number) : <span className="na">Unavailable</span>}</td>
                  <td>{vals.length ? fmt(Math.min(...vals)) : <span className="na">Unavailable</span>}</td>
                  <td>{vals.length ? fmt(Math.max(...vals)) : <span className="na">Unavailable</span>}</td>
                  <td className="l">
                    {g.dots.map((d, i) => (
                      <span key={d.id}>
                        {i > 0 && ", "}
                        <Link href={`/videos/${d.id}`}>{d.id}</Link>
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
