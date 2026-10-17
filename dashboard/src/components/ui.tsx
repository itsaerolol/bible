import type { ReactNode } from "react";
import { MATURE_DAYS } from "@/lib/model";
import { Icon } from "./Icon";

/** Honest placeholder for a value the API did not give us. Never a zero. */
export function Na({ why }: { why?: string }) {
  return (
    <span className="na" title={why ?? "The data source returned no value for this."}>
      Unavailable
    </span>
  );
}

export function Maybe({ value, children, why }: { value: number | string | null | undefined; children: ReactNode; why?: string }) {
  return value == null ? <Na why={why} /> : <>{children}</>;
}

export function MaturityBadge({ ageDays, mature }: { ageDays: number | null; mature: boolean }) {
  if (ageDays == null || mature) return null;
  return (
    <span className="badge warn" title={`Published ${ageDays} day${ageDays === 1 ? "" : "s"} before the last sync. Metrics and retention keep shifting during the first ${MATURE_DAYS} days.`}>
      <Icon name="alert" size={12} />
      Maturing, day {Math.max(ageDays, 0)} of {MATURE_DAYS}
    </span>
  );
}

export function Confidence({ level }: { level: "low" | "medium" | "high" }) {
  const n = level === "low" ? 1 : level === "medium" ? 2 : 3;
  return (
    <span className="conf" title={`Model-stated confidence: ${level}`}>
      <i aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <b key={i} className={i <= n ? "on" : ""} />
        ))}
      </i>
      {level[0]!.toUpperCase() + level.slice(1)} confidence
    </span>
  );
}

export function NBadge({ n, label = "n" }: { n: number; label?: string }) {
  return (
    <span className="badge n" title={`${n} video${n === 1 ? "" : "s"} in this aggregate`}>
      {label}={n}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
