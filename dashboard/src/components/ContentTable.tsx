"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { fmtClock, fmtDate, fmtInt, fmtPct, fmtRatio, fmtSeconds, fmtSigned, fmtWatch, median } from "@/lib/format";
import type { VideoRow } from "@/lib/model";
import { Icon } from "./Icon";
import { MaturityBadge, Na } from "./ui";

type Val = number | string | null;

interface Col {
  key: string;
  label: string;
  hint?: string;
  get: (r: VideoRow) => Val;
  render: (r: VideoRow) => ReactNode;
  agg?: "sum" | "median";
  fmt?: (n: number) => string;
  left?: boolean;
  sticky?: boolean;
}

const noData = (r: VideoRow) => (r.hasSnapshot ? "The data source returned no value for this metric." : "No analytics yet: YouTube data arrives 48 to 72 hours after posting.");
const num = (r: VideoRow, v: number | null, f: (n: number) => string): ReactNode => (v == null ? <Na why={noData(r)} /> : f(v));

function episodeCell(r: VideoRow, v: string | null): ReactNode {
  if (!r.hasEpisode) return <span className="na" title="No episode record has this video's youtube_id yet.">Not linked</span>;
  return v ?? <span className="na" title="The episode record has this field empty.">Not set</span>;
}

const COLS: Col[] = [
  {
    key: "title",
    label: "Video",
    left: true,
    sticky: true,
    get: (r) => r.title.toLowerCase(),
    render: (r) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Link href={`/videos/${r.id}`}>{r.title}</Link>
        <span className="sub" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {fmtClock(r.durationSec)}
          <MaturityBadge ageDays={r.ageDays} mature={r.mature} />
          {!r.hasSnapshot && <span className="badge">No analytics yet</span>}
        </span>
      </div>
    ),
  },
  { key: "published", label: "Published", left: true, get: (r) => r.publishedAt, render: (r) => fmtDate(r.publishedDate) },
  { key: "hook", label: "Hook type", left: true, get: (r) => r.hookType, render: (r) => episodeCell(r, r.hookType) },
  { key: "passage", label: "Passage", left: true, get: (r) => r.passage, render: (r) => episodeCell(r, r.passage) },
  { key: "ds", label: "Design system", left: true, hint: "design_system_version pinned when the episode started", get: (r) => r.dsVersion, render: (r) => episodeCell(r, r.dsVersion) },
  { key: "views", label: "Views", agg: "sum", fmt: fmtInt, get: (r) => r.m.views, render: (r) => num(r, r.m.views, fmtInt) },
  { key: "engaged", label: "Engaged views", agg: "sum", fmt: fmtInt, get: (r) => r.m.engagedViews, render: (r) => num(r, r.m.engagedViews, fmtInt) },
  { key: "watch", label: "Watch time", agg: "sum", fmt: fmtWatch, get: (r) => r.m.estimatedMinutesWatched, render: (r) => num(r, r.m.estimatedMinutesWatched, fmtWatch) },
  { key: "avd", label: "Avg view duration", agg: "median", fmt: fmtSeconds, get: (r) => r.m.averageViewDuration, render: (r) => num(r, r.m.averageViewDuration, fmtSeconds) },
  { key: "pct", label: "Avg % viewed", agg: "median", fmt: fmtPct, get: (r) => r.m.averageViewPercentage, render: (r) => num(r, r.m.averageViewPercentage, fmtPct) },
  { key: "r3", label: "Held at 3s", hint: "Share of views still watching 3 seconds in (retention curve)", agg: "median", fmt: (n) => fmtRatio(n), get: (r) => r.at3s, render: (r) => num(r, r.at3s, (n) => fmtRatio(n)) },
  { key: "drop", label: "Early drop", hint: "Points lost in the steepest 5% span of the first 30% (retention curve)", agg: "median", fmt: (n) => `${n.toFixed(0)} pts`, get: (r) => r.earlyDropPts, render: (r) => num(r, r.earlyDropPts, (n) => `−${n.toFixed(0)} pts`) },
  { key: "likes", label: "Likes", agg: "sum", fmt: fmtInt, get: (r) => r.m.likes, render: (r) => num(r, r.m.likes, fmtInt) },
  { key: "comments", label: "Comments", agg: "sum", fmt: fmtInt, get: (r) => r.m.comments, render: (r) => num(r, r.m.comments, fmtInt) },
  { key: "shares", label: "Shares", agg: "sum", fmt: fmtInt, get: (r) => r.m.shares, render: (r) => num(r, r.m.shares, fmtInt) },
  { key: "subs", label: "Subs net", agg: "sum", fmt: (n) => fmtSigned(n), get: (r) => r.subsNet, render: (r) => num(r, r.subsNet, (n) => fmtSigned(n)) },
];

function cmp(a: Val, b: Val, dir: 1 | -1): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // unavailable always last
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * dir;
  return String(a).localeCompare(String(b)) * dir;
}

export function ContentTable({ rows }: { rows: VideoRow[] }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "published", dir: -1 });
  const [q, setQ] = useState("");
  const [hook, setHook] = useState("");
  const [matureOnly, setMatureOnly] = useState(false);

  const hooks = useMemo(() => [...new Set(rows.map((r) => r.hookType).filter((x): x is string => !!x))].sort(), [rows]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const col = COLS.find((c) => c.key === sort.key) ?? COLS[1]!;
    return rows
      .filter((r) => (!matureOnly || r.mature) && (!hook || r.hookType === hook) && (!needle || `${r.title} ${r.passage ?? ""} ${r.topic ?? ""}`.toLowerCase().includes(needle)))
      .sort((a, b) => cmp(col.get(a), col.get(b), sort.dir));
  }, [rows, q, hook, matureOnly, sort]);

  const matureCount = rows.filter((r) => r.mature).length;
  const toggle = (key: string) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "title" || key === "hook" || key === "passage" || key === "ds" ? 1 : -1 }));

  const agg = (c: Col): ReactNode => {
    if (!c.agg || !c.fmt) return "";
    const vals = shown.map((r) => c.get(r)).filter((v): v is number => typeof v === "number");
    if (!vals.length) return <Na />;
    const v = c.agg === "sum" ? vals.reduce((a, b) => a + b, 0) : median(vals);
    return v == null ? <Na /> : c.fmt(v);
  };

  return (
    <>
      <div className="filters">
        <input className="field" type="search" placeholder="Search title, passage, topic" aria-label="Search videos" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 0, flex: "1 1 220px", maxWidth: 360 }} />
        <select className="field" aria-label="Filter by hook type" value={hook} onChange={(e) => setHook(e.target.value)}>
          <option value="">All hook types</option>
          {hooks.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={matureOnly} onChange={(e) => setMatureOnly(e.target.checked)} />
          Hide videos under 7 days
        </label>
      </div>
      <p className="sub" aria-live="polite">
        Showing {shown.length} of {rows.length} videos. {matureCount} older than 7 days. Unavailable means YouTube returned nothing; it is never counted as zero.
      </p>
      <div className="table-wrap" role="region" aria-label="Videos table" tabIndex={0}>
        <table className="data">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} scope="col" className={`${c.left ? "l" : ""}${c.sticky ? " sticky" : ""}`} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} title={c.hint}>
                  <button type="button" onClick={() => toggle(c.key)}>
                    {c.label}
                    {sort.key === c.key && <Icon name={sort.dir === 1 ? "chevUp" : "chevDown"} size={14} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                {COLS.map((c) => (
                  <td key={c.key} className={`${c.left ? "l" : ""}${c.sticky ? " sticky title" : ""}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="l" style={{ whiteSpace: "normal", padding: 24 }}>
                  No video matches these filters.
                </td>
              </tr>
            )}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr>
                <td className="sticky l">Total or median, n={shown.length}</td>
                {COLS.slice(1).map((c) => (
                  <td key={c.key} title={c.agg === "sum" ? "Sum of the shown rows that have a value" : c.agg === "median" ? "Median of the shown rows that have a value" : undefined}>
                    {agg(c)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
