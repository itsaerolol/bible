"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { fmtClock, fmtRatio } from "@/lib/format";
import { interpRatio, type Drop } from "@/lib/model";
import type { RetentionPoint } from "@/lib/types";
import { areaPath, linePath, useWidth, type Pt } from "./chartUtils";

export interface RetentionChartProps {
  curve: RetentionPoint[];
  durationSec: number;
  median: { points: Array<{ t: number; v: number }>; n: number } | null;
  drops: Drop[];
  earlyDrop: Drop | null;
}

interface Marker extends Drop {
  no: number;
}

/** Retention curve: share of views still watching at each point. Drop windows are numbered, the biggest early one is labelled. */
export function RetentionChart({ curve, durationSec, median, drops, earlyDrop }: RetentionChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const [hover, setHover] = useState<number | null>(null);
  const H = w > 0 && w < 480 ? 236 : 300;
  const M = { t: 18, r: 14, b: 42, l: 42 };
  const innerW = Math.max(10, w - M.l - M.r);
  const innerH = H - M.t - M.b;
  const maxRatio = Math.max(...curve.map((p) => p.audienceWatchRatio), ...(median?.points.map((p) => p.v) ?? [0]));
  const ticks = maxRatio > 1.02 ? [0, 0.25, 0.5, 0.75, 1, 1.25] : [0, 0.25, 0.5, 0.75, 1];
  const top = ticks.at(-1)!;
  const X = (t: number) => M.l + t * innerW;
  const Y = (v: number) => M.t + innerH * (1 - v / top);

  // markers: the drops from the analysis, numbered by size (the early drop is always among them)
  const markers: Marker[] = [...drops]
    .sort((a, b) => b.points - a.points)
    .slice(0, 4)
    .map((d, i) => ({ ...d, no: i + 1 }));

  const pts: Pt[] = curve.map((p) => [X(p.t), Y(p.audienceWatchRatio)]);
  const medPts: Pt[] = median ? median.points.map((p) => [X(p.t), Y(p.v)]) : [];

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - r.left - M.l) / innerW;
    let best = 0;
    let bd = Infinity;
    curve.forEach((p, i) => {
      const d = Math.abs(p.t - t);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(curve.length - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? curve.length) - 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  const hp = hover != null ? curve[hover]! : null;
  const hx = hp ? X(hp.t) : 0;
  const medAt = hp && median ? interpRatio(median.points.map((p) => ({ t: p.t, audienceWatchRatio: p.v, relativeRetentionPerformance: null })), hp.t) : null;
  const tipLeft = hp != null && hx > w * 0.58;
  const xTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="chart" style={{ minHeight: H }}>
      <div className="legend">
        <span>
          <i />
          This video
        </span>
        {median && (
          <span>
            <i style={{ borderTopColor: "var(--gray-mark)" }} />
            Median of {median.n} other videos with a curve
          </span>
        )}
        {markers.length > 0 && <span>Numbered rings mark the steepest 5% spans</span>}
      </div>
      <div ref={ref} tabIndex={0} role="group" aria-label="Retention curve. Use left and right arrow keys to read values." onKeyDown={onKey} onBlur={() => setHover(null)} style={{ position: "relative" }}>
        {w > 0 && (
          <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)} role="img" aria-label="Retention curve: share of views still watching, from start to end of the video">
            {ticks.map((t) => (
              <g key={t}>
                <line className="tick-grid" x1={M.l} x2={w - M.r} y1={Y(t)} y2={Y(t)} />
                <text x={M.l - 8} y={Y(t) + 4} textAnchor="end">
                  {Math.round(t * 100)}%
                </text>
              </g>
            ))}
            <line className="axis-line" x1={M.l} x2={w - M.r} y1={Y(0)} y2={Y(0)} />
            {xTicks.map((t) => (
              <g key={t}>
                <text x={X(t)} y={H - 22} textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"}>
                  {fmtClock(t * durationSec)}
                </text>
                <text x={X(t)} y={H - 7} textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"} opacity={0.75}>
                  {Math.round(t * 100)}%
                </text>
              </g>
            ))}
            {markers.map((m) => (
              <rect key={`b${m.no}`} x={X(m.from)} y={M.t} width={Math.max(2, X(m.to) - X(m.from))} height={innerH} fill="var(--ink-wash)" />
            ))}
            {median && <path d={linePath(medPts)} fill="none" stroke="var(--gray-mark)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
            <path d={areaPath(pts, Y(0))} fill="var(--s1)" opacity={0.1} />
            <path d={linePath(pts)} fill="none" stroke="var(--s1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {markers.map((m) => {
              const cx = X(m.from);
              const cy = Y(interpRatio(curve, m.from) ?? 0);
              const isEarly = earlyDrop != null && Math.abs(m.from - earlyDrop.from) < 1e-9;
              const labelLeft = cx > w - 100;
              return (
                <g key={`m${m.no}`} pointerEvents="none">
                  <circle cx={cx} cy={cy} r={9} fill="var(--surface)" stroke="var(--s1)" strokeWidth={2} />
                  <text x={cx} y={cy + 4} textAnchor="middle" className="strong" style={{ fontSize: 11 }}>
                    {m.no}
                  </text>
                  {isEarly && (
                    <text x={labelLeft ? cx - 15 : cx + 15} y={cy - 10} textAnchor={labelLeft ? "end" : "start"} className="strong" style={{ fontSize: 12.5 }}>
                      {`−${m.points.toFixed(0)} pts early`}
                    </text>
                  )}
                </g>
              );
            })}
            {hp && (
              <g pointerEvents="none">
                <line className="hair" x1={hx} x2={hx} y1={M.t} y2={Y(0)} />
                <circle cx={hx} cy={Y(hp.audienceWatchRatio)} r={4.5} fill="var(--s1)" stroke="var(--surface)" strokeWidth={2} />
              </g>
            )}
          </svg>
        )}
        {hp && w > 0 && (
          <div className="tip" style={{ top: M.t, left: tipLeft ? undefined : hx + 14, right: tipLeft ? w - hx + 14 : undefined }}>
            <div className="t-head">
              {fmtClock(hp.t * durationSec)} ({Math.round(hp.t * 100)}% in)
            </div>
            <div className="t-row">
              <i />
              Still watching
              <b>{fmtRatio(hp.audienceWatchRatio)}</b>
            </div>
            {medAt != null && (
              <div className="t-row">
                <i style={{ borderTopColor: "var(--gray-mark)" }} />
                Median of others
                <b>{fmtRatio(medAt)}</b>
              </div>
            )}
          </div>
        )}
      </div>
      <details className="table-view">
        <summary>Table view</summary>
        <div className="scroll">
          <table className="data">
            <thead>
              <tr>
                <th className="l">Position</th>
                <th>Time</th>
                <th>Still watching</th>
                <th>Relative</th>
              </tr>
            </thead>
            <tbody>
              {curve.map((p, i) => (
                <tr key={i}>
                  <td>{Math.round(p.t * 100)}%</td>
                  <td>{fmtClock(p.t * durationSec)}</td>
                  <td>{fmtRatio(p.audienceWatchRatio, 1)}</td>
                  <td>{p.relativeRetentionPerformance == null ? <span className="na">Unavailable</span> : p.relativeRetentionPerformance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
