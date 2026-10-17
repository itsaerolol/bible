"use client";

import { useEffect, useState, type RefObject } from "react";

/** Round a max up to 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (max <= m * p) return m * p;
  return 10 * p;
}

export function ticksFor(max: number, count = 4): number[] {
  const top = niceMax(max);
  return Array.from({ length: count + 1 }, (_, i) => (top / count) * i);
}

export function compactAxis(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1000) return `${+(n / 1000).toFixed(a >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(n * 10) / 10);
}

export type Pt = [number, number] | null;

/** SVG path that breaks wherever a point is null. */
export function linePath(points: Pt[]): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    pen = true;
  }
  return d;
}

export function areaPath(points: Pt[], baseY: number): string {
  const segs: Array<Array<[number, number]>> = [];
  let cur: Array<[number, number]> = [];
  for (const p of points) {
    if (!p) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push(p);
  }
  if (cur.length) segs.push(cur);
  return segs
    .filter((s) => s.length > 1)
    .map((s) => `M${s[0]![0].toFixed(1)} ${baseY}` + s.map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("") + `L${s.at(-1)![0].toFixed(1)} ${baseY}Z`)
    .join("");
}

export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.floor(el.getBoundingClientRect().width));
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Choose up to `count` evenly spread indexes, always including first and last. */
export function spreadIdx(n: number, count: number): number[] {
  if (n <= 0) return [];
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  return Array.from({ length: count }, (_, k) => Math.round((k * (n - 1)) / (count - 1)));
}
