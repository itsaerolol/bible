import type { Metadata } from "next";
import { OverviewView } from "@/components/OverviewView";
import { SyncHealth } from "@/components/SyncHealth";
import { loadDataset } from "@/lib/data";
import { buildRows } from "@/lib/model";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  const ds = loadDataset();
  const rows = buildRows(ds);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>How the channel is doing, with each number compared with the period before it.</p>
        </div>
      </div>
      <OverviewView daily={ds.channel?.daily ?? []} rows={rows} dataThrough={ds.dataThrough} />
      <SyncHealth status={ds.status} mock={ds.mock} />
    </div>
  );
}
