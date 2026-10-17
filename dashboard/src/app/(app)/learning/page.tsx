import type { Metadata } from "next";
import { LearningView } from "@/components/LearningView";
import { loadDataset } from "@/lib/data";
import { buildRows } from "@/lib/model";

export const metadata: Metadata = { title: "Learning" };

export default function LearningPage() {
  const ds = loadDataset();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Learning</h1>
          <p>Is the evolving design system helping? Performance grouped by design system version and by hook type, with the number of videos behind every group.</p>
        </div>
      </div>
      <LearningView rows={buildRows(ds)} />
    </div>
  );
}
