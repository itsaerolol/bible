import type { Metadata } from "next";
import { ContentTable } from "@/components/ContentTable";
import { Empty } from "@/components/ui";
import { loadDataset } from "@/lib/data";
import { buildRows } from "@/lib/model";

export const metadata: Metadata = { title: "Content" };

export default function ContentPage() {
  const ds = loadDataset();
  const rows = buildRows(ds);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Content</h1>
          <p>Every tracked Short with its metrics next to the episode fields: hook type, passage, and the design system version it was made with.</p>
        </div>
      </div>
      {rows.length === 0 ? <Empty title="No videos yet">The first sync lists your Shorts. Until then there is nothing to show.</Empty> : <ContentTable rows={rows} />}
    </div>
  );
}
