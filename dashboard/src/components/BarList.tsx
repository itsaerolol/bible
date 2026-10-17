import { fmtInt, trafficLabel } from "@/lib/format";
import { Na } from "./ui";

export interface BarItem {
  key: string;
  label: string;
  value: number | null;
  share: number | null;
}

/** Horizontal bars for a nominal breakdown. One hue, value at the tip, no legend needed. */
export function BarList({ items, valueLabel = "views" }: { items: BarItem[]; valueLabel?: string }) {
  const max = Math.max(...items.map((i) => i.value ?? 0), 1);
  return (
    <ul className="barlist">
      {items.map((it) => (
        <li key={it.key} title={`${it.label}: ${fmtInt(it.value)} ${valueLabel}`}>
          <span className="name">{it.label}</span>
          <span className="track" aria-hidden="true">
            <span className="fill" style={{ display: "block", width: `${((it.value ?? 0) / max) * 100}%` }} />
          </span>
          <span className="num">
            {it.value == null ? <Na /> : fmtInt(it.value)}
            {it.share != null && <small> {(it.share * 100).toFixed(it.share < 0.1 ? 1 : 0)}%</small>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function trafficItems(rows: Array<{ source: string; views: number | null }>): BarItem[] {
  const total = rows.reduce((n, r) => n + (r.views ?? 0), 0);
  return rows.map((r) => ({ key: r.source, label: trafficLabel(r.source), value: r.views, share: r.views != null && total > 0 ? r.views / total : null }));
}
