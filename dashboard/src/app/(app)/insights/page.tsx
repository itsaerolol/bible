import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Confidence, Empty } from "@/components/ui";
import { loadDataset } from "@/lib/data";
import { daysBetween, fmtDate, fmtDateTimeUtc } from "@/lib/format";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  const ds = loadDataset();
  const ins = ds.insights;
  const titles = new Map(ds.videos.map((v) => [v.video_id, v.title]));
  const stale = ins && ds.dataThrough ? daysBetween(ins.generated_at.slice(0, 10), ds.dataThrough) > 2 : false;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Insights</h1>
          <p>Advice from Claude Haiku about delivery: hook structure, length, pacing, visuals. It reads your numbers and episode notes, never changes anything, and never comments on message or doctrine.</p>
        </div>
      </div>

      {!ins ? (
        <Empty title="No insights yet">
          The daily Action writes data/insights.json after a real sync when the ANTHROPIC_API_KEY secret is set. Until then there is nothing here, on purpose.
        </Empty>
      ) : (
        <>
          <div className="card">
            <div className="card-head">
              <h2>Summary</h2>
              <span className="sub">
                Generated {fmtDateTimeUtc(ins.generated_at)} · {ins.model}
              </span>
            </div>
            <p style={{ color: "var(--text-2)" }}>{ins.summary}</p>
            <p className="sub" style={{ marginTop: 10 }}>
              Based on n={ins.based_on.videos} video{ins.based_on.videos === 1 ? "" : "s"}, published {fmtDate(ins.based_on.date_range[0], true)} to data through {fmtDate(ins.based_on.date_range[1], true)}
              {ins.sample ? `, ${ins.sample.mature_videos} older than 7 days` : ""}.
            </p>
          </div>

          {stale && (
            <div className="callout warn" role="note">
              <Icon name="alert" size={18} />
              <div>These insights were generated {fmtDate(ins.generated_at.slice(0, 10), true)}, but data runs through {fmtDate(ds.dataThrough, true)}. They do not reflect the newest videos yet.</div>
            </div>
          )}

          <section aria-label="Recommendations" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {ins.recommendations.length === 0 && <Empty title="No recommendations">The model found nothing the data supports. With a small sample that is the honest answer.</Empty>}
            {ins.recommendations.map((r, i) => (
              <article className="card rec" key={i}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                  <h3>{r.title}</h3>
                  <Confidence level={r.confidence} />
                </div>
                <p>{r.rationale}</p>
                <div>
                  <div className="sub" style={{ marginBottom: 6 }}>
                    Evidence ({r.evidence.length} video{r.evidence.length === 1 ? "" : "s"})
                  </div>
                  <div className="chips">
                    {r.evidence.map((id) =>
                      titles.has(id) ? (
                        <Link key={id} className="chip" href={`/videos/${id}`} title={titles.get(id)}>
                          {id} · {(titles.get(id) ?? "").replace(/^\[MOCK\] /, "").slice(0, 28)}
                        </Link>
                      ) : (
                        <span key={id} className="badge" title="This video is not in the current data">
                          {id} (not in data)
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className="card" aria-label="Caveats">
            <div className="card-head">
              <h2>Caveats</h2>
            </div>
            <ul className="plain">
              {ins.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
