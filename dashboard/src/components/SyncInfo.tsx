"use client";

import { useEffect, useState } from "react";
import { fmtDate, fmtDateTimeUtc } from "@/lib/format";

function rel(ms: number): string {
  const h = ms / 3_600_000;
  if (h < 1) return "under 1 hour ago";
  if (h < 48) return `${Math.floor(h)} hour${Math.floor(h) === 1 ? "" : "s"} ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export function SyncInfo({ lastSyncAt, dataThrough, mock }: { lastSyncAt: string | null; dataThrough: string | null; mock: boolean }) {
  const [age, setAge] = useState<number | null>(null);
  useEffect(() => {
    if (lastSyncAt) setAge(Date.now() - Date.parse(lastSyncAt));
  }, [lastSyncAt]);
  if (!lastSyncAt) {
    return (
      <div className="sync">
        <span className="l1">
          <strong>No sync yet.</strong>
        </span>
        <span className="l2">Waiting for the first run of the Action.</span>
      </div>
    );
  }
  const stale = !mock && age != null && age > 36 * 3_600_000;
  return (
    <div className="sync">
      <span className="l1">
        Last sync <strong>{fmtDateTimeUtc(lastSyncAt, false)}</strong>
        {age != null && <span className={`rel${stale ? " stale" : ""}`}> ({rel(age)})</span>}
      </span>
      <span className="l2">
        {stale && <span className="stale">Stale, check the Action. </span>}
        {dataThrough && (
          <>
            Data through <strong>{fmtDate(dataThrough)}</strong>
          </>
        )}
      </span>
    </div>
  );
}
