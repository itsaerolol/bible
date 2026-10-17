"use client";

import { useRef, useState } from "react";
import { median } from "@/lib/format";
import { compactAxis, niceMax, useWidth } from "./chartUtils";
import { NBadge } from "./ui";

export interface Dot {
  id: string;
  title: string;
  value: number;
  date: string;
}

export interface StripGroup {
  label: string;
  nTotal: number; // videos in the group, including those without a value for this metric
  dots: Dot[];
}

interface Props {
  groups: StripGroup[];
  fmt: (n: number) => string;
  domain: [number, number];
  metricLabel: string;
}

const M = { l: 10, r: 14 };

function xScale(domain: [number, number], w: number) {
  const [lo, hi] = domain;
  return (v: number) => M.l + ((v - lo) / (hi - lo || 1)) * Math.max(10, w - M.l - M.r);
}

/** One strip per group: every video is a dot, the bar is the median. Shows spread and n instead of hiding them in an average. */
export function StripPlot({ groups, fmt, domain, metricLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const [tip, setTip] = useState<{ x: number; cy: number; gi: number; dot: Dot } | null>(null);
  const X = xScale(domain, w);
  const step = (domain[1] - domain[0]) / 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => domain[0] + step * i);

  return (
    <figure className="chart" ref={ref as never} style={{ minHeight: 60 }}>
      <div style={{ position: "relative" }}>
        {groups.map((g, gi) => {
          const med = median(g.dots.map((d) => d.value));
          const few = g.dots.length < 3;
          const sorted = [...g.dots].sort((a, b) => a.value - b.value);
          // nudge dots that would overlap so each stays visible
          const ys: number[] = [];
          sorted.forEach((d, i) => {
            let near = 0;
            for (let k = 0; k < i; k++) if (Math.abs(X(sorted[k]!.value) - X(d.value)) < 11) near++;
            ys.push(26 + ((near % 3) - 1) * 9 * (near ? 1 : 0));
          });
          return (
            <div key={g.label} style={{ padding: "8px 0", borderTop: gi ? "1px solid var(--border)" : undefined }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px" }}>
                <strong style={{ fontSize: 14 }}>{g.label}</strong>
                <NBadge n={g.dots.length} />
                {g.nTotal > g.dots.length && <span className="sub">({g.nTotal - g.dots.length} without {metricLabel.toLowerCase()})</span>}
                <span className="sub" style={{ marginLeft: "auto" }}>
                  {med == null ? "Unavailable" : `median ${fmt(med)}`}
                </span>
              </div>
              {few && <div className="sub">Fewer than 3 videos: too few to compare, shown for completeness.</div>}
              {w > 0 && (
                <div style={{ position: "relative" }}>
                <svg width={w} height={52} role="img" aria-label={`${g.label}: ${g.dots.length} videos, ${metricLabel}`} onPointerLeave={() => setTip(null)}>
                  <line className="axis-line" x1={M.l} x2={w - M.r} y1={26} y2={26} />
                  {med != null && <rect x={X(med) - 1.5} y={10} width={3} height={32} rx={1.5} fill="var(--text)" opacity={0.9} />}
                  {sorted.map((d, i) => (
                    <g key={d.id}>
                      <circle cx={X(d.value)} cy={ys[i]} r={5} fill="var(--s1)" stroke="var(--surface)" strokeWidth={2} />
                      <circle
                        cx={X(d.value)}
                        cy={ys[i]}
                        r={14}
                        fill="transparent"
                        tabIndex={0}
                        role="img"
                        aria-label={`${d.title}, ${metricLabel} ${fmt(d.value)}`}
                        onPointerEnter={() => setTip({ x: X(d.value), cy: ys[i]!, gi, dot: d })}
                        onFocus={() => setTip({ x: X(d.value), cy: ys[i]!, gi, dot: d })}
                        onBlur={() => setTip(null)}
                      />
                    </g>
                  ))}
                </svg>
                {tip && tip.gi === gi && (
                  <div className="tip" style={{ top: tip.cy + 12, left: Math.min(Math.max(tip.x - 90, 0), Math.max(0, w - 240)) }}>
                    <div className="t-head">{tip.dot.title}</div>
                    <div className="t-row">
                      {metricLabel}
                      <b>{fmt(tip.dot.value)}</b>
                    </div>
                    <div className="sub">{tip.dot.date}</div>
                  </div>
                )}
                </div>
              )}
            </div>
          );
        })}
        {w > 0 && (
          <svg width={w} height={26} aria-hidden="true">
            {ticks.map((t) => (
              <text key={t} x={X(t)} y={16} textAnchor={t === ticks[0] ? "start" : t === ticks[4] ? "end" : "middle"}>
                {fmt(t)}
              </text>
            ))}
          </svg>
        )}
      </div>
    </figure>
  );
}

export interface TimePoint {
  id: string;
  title: string;
  value: number;
  date: string;
  version: string | null;
}

/** Publish order on x, metric on y, a rule wherever the design system version changes. Descriptive only. */
export function TimeScatter({ points, fmt, metricLabel, domain }: { points: TimePoint[]; fmt: (n: number) => string; metricLabel: string; domain: [number, number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const [hover, setHover] = useState<number | null>(null);
  const H = 230;
  const m = { t: 22, r: 14, b: 26, l: 44 };
  const n = points.length;
  const innerW = Math.max(10, w - m.l - m.r);
  const innerH = H - m.t - m.b;
  const top = domain[1] <= 100 && domain[1] > 1 ? niceMax(domain[1]) : domain[1];
  const lo = domain[0];
  const X = (i: number) => m.l + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const Y = (v: number) => m.t + innerH * (1 - (v - lo) / (top - lo || 1));
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + ((top - lo) / 4) * i);
  const changes: Array<{ i: number; v: string }> = [];
  points.forEach((p, i) => {
    if (i > 0 && p.version !== points[i - 1]!.version && p.version) changes.push({ i, v: p.version });
  });
  const first = points[0]?.version;
  const hp = hover != null ? points[hover] : null;

  return (
    <figure className="chart" style={{ minHeight: H }}>
      <div ref={ref} style={{ position: "relative" }}>
        {w > 0 && n > 0 && (
          <svg width={w} height={H} role="img" aria-label={`${metricLabel} by publish order, with design system version changes marked`} onPointerLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="tick-grid" x1={m.l} x2={w - m.r} y1={Y(t)} y2={Y(t)} />
                <text x={m.l - 8} y={Y(t) + 4} textAnchor="end">
                  {compactAxis(+t.toFixed(1))}
                </text>
              </g>
            ))}
            {first && (
              <text x={m.l} y={12} className="strong" style={{ fontSize: 11.5 }}>
                v{first}
              </text>
            )}
            {changes.map((c) => (
              <g key={c.i}>
                <line className="hair" x1={(X(c.i - 1) + X(c.i)) / 2} x2={(X(c.i - 1) + X(c.i)) / 2} y1={m.t - 6} y2={H - m.b} />
                <text x={(X(c.i - 1) + X(c.i)) / 2 + 5} y={12} className="strong" style={{ fontSize: 11.5 }}>
                  v{c.v}
                </text>
              </g>
            ))}
            <line className="axis-line" x1={m.l} x2={w - m.r} y1={Y(lo)} y2={Y(lo)} />
            <text x={m.l} y={H - 6}>{points[0]?.date.slice(5)}</text>
            <text x={w - m.r} y={H - 6} textAnchor="end">{points.at(-1)?.date.slice(5)}</text>
            {points.map((p, i) => (
              <g key={p.id}>
                <circle cx={X(i)} cy={Y(p.value)} r={5} fill="var(--s1)" stroke="var(--surface)" strokeWidth={2} />
                <circle cx={X(i)} cy={Y(p.value)} r={14} fill="transparent" tabIndex={0} role="img" aria-label={`${p.title}, ${metricLabel} ${fmt(p.value)}`} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
              </g>
            ))}
          </svg>
        )}
        {hp && w > 0 && hover != null && (
          <div className="tip" style={{ top: Y(hp.value) - 56 < 0 ? Y(hp.value) + 12 : Y(hp.value) - 62, left: Math.min(Math.max(X(hover) - 90, 0), Math.max(0, w - 200)) }}>
            <div className="t-head">{hp.title}</div>
            <div className="t-row">
              {metricLabel}
              <b>{fmt(hp.value)}</b>
            </div>
            <div className="sub">
              {hp.date}
              {hp.version ? ` · v${hp.version}` : ""}
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
