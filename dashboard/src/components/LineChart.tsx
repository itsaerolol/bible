"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { areaPath, compactAxis, linePath, niceMax, spreadIdx, ticksFor, useWidth, type Pt } from "./chartUtils";

export interface Series {
  key: string;
  label: string;
  color: string; // CSS color or var(--token)
  values: Array<number | null>;
  area?: boolean;
}

export interface LineChartProps {
  labels: string[];
  series: Series[];
  ariaLabel: string;
  height?: number;
  yFormat?: (n: number) => string;
  valueFormat?: (n: number) => string;
  xTick?: (i: number) => string;
  tipTitle?: (i: number) => string;
  yMax?: number;
  yTicks?: number[];
  refLine?: { value: number; label: string };
  xTickCount?: number;
  tableLabel?: string;
}

const M = { t: 10, r: 14, b: 26, l: 44 };

/** Line/area chart with crosshair tooltip, keyboard stepping and a table-view twin. */
export function LineChart({ labels, series, ariaLabel, height = 240, yFormat = compactAxis, valueFormat, xTick, tipTitle, yMax, yTicks, refLine, xTickCount = 5, tableLabel = "Date" }: LineChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref);
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const H = height;
  const innerW = Math.max(10, w - M.l - M.r);
  const innerH = H - M.t - M.b;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const top = yMax ?? niceMax(Math.max(...all, 0));
  const ticks = yTicks ?? ticksFor(top, 4);
  const X = (i: number) => M.l + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const Y = (v: number) => M.t + innerH * (1 - v / top);
  const vf = valueFormat ?? yFormat;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = n <= 1 ? 0 : Math.round(((px - M.l) / innerW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  };

  const xi = spreadIdx(n, Math.min(xTickCount, w < 420 ? 3 : xTickCount));
  const tipLeftSide = hover != null && X(hover) > w * 0.58;

  return (
    <figure className="chart" style={{ minHeight: H }}>
      {series.length >= 2 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.key}>
              <i style={{ borderTopColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div ref={ref} tabIndex={0} role="group" aria-label={`${ariaLabel}. Use left and right arrow keys to read values.`} onKeyDown={onKey} onBlur={() => setHover(null)} style={{ position: "relative" }}>
        {w > 0 && (
          <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)} role="img" aria-label={ariaLabel}>
            <title>{ariaLabel}</title>
            {ticks.map((t) => (
              <g key={t}>
                <line className="tick-grid" x1={M.l} x2={w - M.r} y1={Y(t)} y2={Y(t)} />
                <text x={M.l - 8} y={Y(t) + 4} textAnchor="end">
                  {yFormat(t)}
                </text>
              </g>
            ))}
            <line className="axis-line" x1={M.l} x2={w - M.r} y1={Y(0)} y2={Y(0)} />
            {refLine && (
              <g>
                <line className="hair" x1={M.l} x2={w - M.r} y1={Y(refLine.value)} y2={Y(refLine.value)} />
                {refLine.label && (
                  <text x={w - M.r - 4} y={Y(refLine.value) - 5} textAnchor="end">
                    {refLine.label}
                  </text>
                )}
              </g>
            )}
            {xi.map((i) => (
              <text key={i} x={X(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
                {xTick ? xTick(i) : labels[i]}
              </text>
            ))}
            {series.map((s) => {
              const pts: Pt[] = s.values.map((v, i) => (v == null ? null : [X(i), Y(v)]));
              return (
                <g key={s.key}>
                  {s.area && <path d={areaPath(pts, Y(0))} fill={s.color} opacity={0.1} />}
                  <path d={linePath(pts)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </g>
              );
            })}
            {hover != null && (
              <g pointerEvents="none">
                <line className="hair" x1={X(hover)} x2={X(hover)} y1={M.t} y2={Y(0)} />
                {series.map((s) => {
                  const v = s.values[hover];
                  return v == null ? null : <circle key={s.key} cx={X(hover)} cy={Y(v)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />;
                })}
              </g>
            )}
          </svg>
        )}
        {hover != null && w > 0 && (
          <div className="tip" style={{ top: M.t, left: tipLeftSide ? undefined : X(hover) + 14, right: tipLeftSide ? w - X(hover) + 14 : undefined }}>
            <div className="t-head">{tipTitle ? tipTitle(hover) : labels[hover]}</div>
            {series.map((s) => (
              <div className="t-row" key={s.key}>
                <i style={{ borderTopColor: s.color }} />
                {s.label}
                <b>{s.values[hover] == null ? "Unavailable" : vf(s.values[hover] as number)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="table-view">
        <summary>Table view</summary>
        <div className="scroll">
          <table className="data">
            <thead>
              <tr>
                <th className="l">{tableLabel}</th>
                {series.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={i}>
                  <td>{tipTitle ? tipTitle(i) : l}</td>
                  {series.map((s) => (
                    <td key={s.key}>{s.values[i] == null ? <span className="na">Unavailable</span> : vf(s.values[i] as number)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
