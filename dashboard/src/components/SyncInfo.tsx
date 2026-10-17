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
        <strong>No sync yet.</strong> Waiting for the first run of the Action.
      </div>
    );
  }
  const stale = !mock && age != null && age > 36 * 3_600_000;
  return (
    <div className="sync">
      Last sync <strong>{fmtDateTimeUtc(lastSyncAt)}</strong>
      {age != null && <span className={stale ? "stale" : undefined}> ({rel(age)}{stale ? ", check the Action" : ""})</span>}
      {dataThrough && <> · data through <strong>{fmtDate(dataThrough)}</strong></>}
    </div>
  );
}
