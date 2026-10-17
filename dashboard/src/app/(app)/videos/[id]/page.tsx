import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarList, trafficItems } from "@/components/BarList";
import { Icon } from "@/components/Icon";
import { RetentionChart } from "@/components/RetentionChart";
import { Maybe, MaturityBadge, Na } from "@/components/ui";
import { MaturationCharts, RelativeChart } from "@/components/VideoCharts";
import { loadDataset } from "@/lib/data";
import { ageLabel, daysBetween, fmtClock, fmtDate, fmtInt, fmtPct, fmtRatio, fmtSeconds, fmtSigned, fmtWatch } from "@/lib/format";
import { buildRow, episodeFor, medianCurve, retentionStats } from "@/lib/model";
import { repoFileUrl } from "@/lib/repo";

export function generateStaticParams() {
  return loadDataset().videos.map((v) => ({ id: v.video_id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const v = loadDataset().videos.find((x) => x.video_id === id);
  return { title: v ? v.title : "Video" };
}

function Stat({ label, value, foot }: { label: string; value: string | null; foot?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value${value == null ? " na" : ""}`}>{value ?? "Unavailable"}</div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}

const per1k = (x: number | null, views: number | null) => (x != null && views != null && views > 0 ? ((x / views) * 1000).toFixed(1) : null);

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ds = loadDataset();
  const idx = ds.videos.findIndex((v) => v.video_id === id);
  if (idx < 0) notFound();
  const video = ds.videos[idx]!;
  const ep = episodeFor(video, ds.episodes);
  const row = buildRow(video, ep, ds.refDate);
  const snap = video.snapshots.at(-1) ?? null;
  const m = row.m;
  const stats = retentionStats(snap?.retention_curve, video.duration_sec);
  const curve = snap?.retention_curve ?? null;

  // context line: median of the other videos' latest curves
  const others = ds.videos.filter((v) => v.video_id !== id).map((v) => v.snapshots.at(-1)?.retention_curve).filter((c): c is NonNullable<typeof c> => !!c);
  const med = medianCurve(others);

  const newer = idx > 0 ? ds.videos[idx - 1]! : null; // list is newest first
  const older = idx < ds.videos.length - 1 ? ds.videos[idx + 1]! : null;
  const isMockId = video.video_id.startsWith("MOCK_");
  const epUrl = ep && !ds.mock ? repoFileUrl(`episodes/${ep.id}/episode.md`) : null;
  const unavailable = snap?.unavailable ?? [];
  const traffic = snap?.traffic_sources ?? null;

  return (
    <div className="page">
      <nav aria-label="Breadcrumb" className="sub">
        <Link href="/content">Content</Link> / {video.title}
      </nav>
      <div className="page-head">
        <div>
          <h1 style={{ overflowWrap: "anywhere" }}>{video.title}</h1>
          <p>
            Published {fmtDate(video.published_at, true)} · {fmtClock(video.duration_sec)} · {ageLabel(row.ageDays)} at last sync · <span className="mono">{video.video_id}</span>
          </p>
        </div>
        {!isMockId && (
          <a className="sub" href={`https://www.youtube.com/shorts/${video.video_id}`} target="_blank" rel="noreferrer noopener" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            Open on YouTube <Icon name="external" size={14} />
          </a>
        )}
      </div>

      {!row.mature && row.ageDays != null && (
        <div className="callout warn" role="note">
          <Icon name="alert" size={18} />
          <div>
            <MaturityBadge ageDays={row.ageDays} mature={row.mature} /> This video is {row.ageDays} day{row.ageDays === 1 ? "" : "s"} old. Views, average % viewed, the retention curve and the traffic mix all keep shifting during the first 7 days, so do not compare it with older videos yet.
          </div>
        </div>
      )}
      {snap?.partial && (
        <div className="callout warn" role="note">
          <Icon name="alert" size={18} />
          <div>
            Partial data: this snapshot covers only the first {daysBetween(video.published_at.slice(0, 10), snap.data_through ?? snap.date) + 1} day(s) YouTube has finished processing. Treat the numbers as a floor, they will revise upward.
          </div>
        </div>
      )}

      {!snap ? (
        <div className="empty">
          <h2>No analytics yet</h2>
          <p>YouTube processes analytics with a 48 to 72 hour delay, so a snapshot appears about three days after posting. Nothing is shown rather than a zero.</p>
        </div>
      ) : (
        <>
          <section aria-label="Metrics" className="stat-row">
            <Stat label="Views" value={m.views == null ? null : fmtInt(m.views)} foot={`Snapshot ${fmtDate(snap.date)}, data through ${fmtDate(snap.data_through ?? snap.date)}`} />
            <Stat label="Engaged views" value={m.engagedViews == null ? null : fmtInt(m.engagedViews)} foot={row.engagedRate == null ? undefined : `${fmtRatio(row.engagedRate)} of views`} />
            <Stat label="Watch time" value={m.estimatedMinutesWatched == null ? null : fmtWatch(m.estimatedMinutesWatched)} />
            <Stat label="Avg view duration" value={m.averageViewDuration == null ? null : fmtSeconds(m.averageViewDuration)} foot={`of ${fmtClock(video.duration_sec)}`} />
            <Stat label="Avg % viewed" value={m.averageViewPercentage == null ? null : fmtPct(m.averageViewPercentage)} />
            <Stat label="Likes" value={m.likes == null ? null : fmtInt(m.likes)} />
            <Stat label="Comments" value={m.comments == null ? null : fmtInt(m.comments)} />
            <Stat label="Shares" value={m.shares == null ? null : fmtInt(m.shares)} />
            <Stat label="Subscribers, net" value={row.subsNet == null ? null : fmtSigned(row.subsNet)} foot={m.subscribersGained == null || m.subscribersLost == null ? undefined : `+${fmtInt(m.subscribersGained)} gained, −${fmtInt(m.subscribersLost)} lost from this video's watch page`} />
          </section>
          {unavailable.length > 0 && <p className="sub">Unavailable in this snapshot: {unavailable.join(", ")}.</p>}

          <section className="card" aria-label="Retention">
            <div className="card-head">
              <h2>Retention curve</h2>
              <span className="sub">
                {snap.retention_source === "csv" ? "From a Studio CSV import" : snap.retention_source === "api" ? "From the YouTube Analytics API" : ""}
                {snap.retention_carried_from ? `, carried forward from ${fmtDate(snap.retention_carried_from)}` : ""}
              </span>
            </div>
            {curve && stats ? (
              <>
                <div className="stat-row" style={{ marginBottom: 14 }}>
                  <Stat label="Held at 3s" value={stats.at3s == null ? null : fmtRatio(stats.at3s)} foot="share of views still watching" />
                  <Stat label="Halfway" value={stats.at50 == null ? null : fmtRatio(stats.at50)} />
                  <Stat label="At the end" value={stats.atEnd == null ? null : fmtRatio(stats.atEnd)} foot="can pass 100% when people rewatch" />
                  <Stat
                    label="Biggest early drop"
                    value={stats.earlyDrop ? `−${stats.earlyDrop.points.toFixed(0)} pts` : null}
                    foot={stats.earlyDrop ? `${fmtClock(stats.earlyDrop.fromSec)} to ${fmtClock(stats.earlyDrop.toSec)}` : undefined}
                  />
                </div>
                {stats.earlyDrop && (
                  <div className="callout" style={{ marginBottom: 14 }}>
                    <Icon name="info" size={18} />
                    <div>
                      <strong>Largest early drop:</strong> the audience fell by {stats.earlyDrop.points.toFixed(0)} points between {fmtClock(stats.earlyDrop.fromSec)} and {fmtClock(stats.earlyDrop.toSec)} ({Math.round(stats.earlyDrop.from * 100)}% to {Math.round(stats.earlyDrop.to * 100)}% of the video).
                      {ep?.hook_final ? <> The hook used was: &ldquo;{ep.hook_final}&rdquo;</> : null}
                    </div>
                  </div>
                )}
                <RetentionChart curve={curve} durationSec={video.duration_sec} median={med} drops={stats.drops} earlyDrop={stats.earlyDrop} />
                {stats.drops.length > 0 && (
                  <ol className="droplist" aria-label="Steepest drops">
                    {[...stats.drops, ...(stats.earlyDrop && !stats.drops.some((d) => Math.abs(d.from - stats.earlyDrop!.from) < 0.05) ? [stats.earlyDrop] : [])]
                      .sort((a, b) => b.points - a.points)
                      .slice(0, 4)
                      .map((d, i) => (
                        <li key={d.from}>
                          <span className="no">{i + 1}</span>
                          <span>
                            {fmtClock(d.fromSec)} to {fmtClock(d.toSec)}: −{d.points.toFixed(1)} pts{d.early ? " (early)" : ""}
                          </span>
                        </li>
                      ))}
                  </ol>
                )}
                {curve.some((p) => p.relativeRetentionPerformance != null) ? (
                  <div style={{ marginTop: 18 }}>
                    <h3 className="sub" style={{ marginBottom: 6 }}>Relative retention vs similar-length YouTube videos</h3>
                    <RelativeChart curve={curve} durationSec={video.duration_sec} />
                  </div>
                ) : (
                  <p className="sub" style={{ marginTop: 14 }}>
                    Relative retention: <Na /> (this curve has no relative column).
                  </p>
                )}
              </>
            ) : (
              <div className="empty" style={{ border: 0, padding: "12px 0 4px", background: "transparent", textAlign: "left" }}>
                <h2>
                  Retention curve: <Na />
                </h2>
                <p style={{ margin: 0 }}>
                  {snap.retention_note?.startsWith("api_error") ? "The YouTube Analytics API returned an error for this Short." : snap.retention_note?.startsWith("api_empty") ? "The API answered but returned no retention rows for this Short. Very new or low-view videos often have none." : "No retention curve has been stored for this video."}
                  {snap.retention_note && (
                    <>
                      {" "}
                      <span className="mono">{snap.retention_note}</span>
                    </>
                  )}
                </p>
                <p style={{ margin: "8px 0 0" }}>
                  Fallback: export the audience-retention data from YouTube Studio, save it as <code>episodes/{video.episode_id ?? "<episode-id>"}/retention.csv</code>, then run <code>node scripts/import-retention-csv.mjs {video.episode_id ?? "<episode-id>"}</code>.
                </p>
              </div>
            )}
          </section>

          <div className="grid-2">
            <section className="card" aria-label="Traffic sources">
              <div className="card-head">
                <h2>Traffic sources</h2>
                <span className="sub">Views by where viewers came from</span>
              </div>
              {traffic && traffic.length > 0 ? (
                <BarList items={trafficItems(traffic)} />
              ) : (
                <p>
                  <Na why={snap.traffic_note} /> <span className="sub">{snap.traffic_note ? `(${snap.traffic_note})` : "The API returned no traffic rows."}</span>
                </p>
              )}
            </section>

            <section className="card" aria-label="Engagement">
              <div className="card-head">
                <h2>Engagement</h2>
                <span className="sub">Per 1,000 views</span>
              </div>
              <dl className="kv">
                <dt>Engaged view rate</dt>
                <dd>
                  <Maybe value={row.engagedRate}>{fmtRatio(row.engagedRate, 1)}</Maybe>
                </dd>
                <dt>Likes</dt>
                <dd>{per1k(m.likes, m.views) ?? <Na />}</dd>
                <dt>Comments</dt>
                <dd>{per1k(m.comments, m.views) ?? <Na />}</dd>
                <dt>Shares</dt>
                <dd>{per1k(m.shares, m.views) ?? <Na />}</dd>
                <dt>Subscribers gained</dt>
                <dd>{per1k(m.subscribersGained, m.views) ?? <Na />}</dd>
              </dl>
              <p className="sub" style={{ marginTop: 10 }}>
                Rates are computed here from the snapshot above. Subscriber counts on a single video only include subscriptions made from its watch page.
              </p>
            </section>
          </div>
        </>
      )}

      <section className="card" aria-label="Episode record">
        <div className="card-head">
          <h2>Episode record</h2>
          {ep ? (
            epUrl ? (
              <a href={epUrl} target="_blank" rel="noreferrer noopener" className="sub" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                Open episode.md <Icon name="external" size={14} />
              </a>
            ) : (
              <span className="sub">
                <code>episodes/{ep.id}/episode.md</code>
              </span>
            )
          ) : null}
        </div>
        {!ep ? (
          <p className="sub">
            No episode record has <span className="mono">youtube_id: {video.video_id}</span>. <code>/posted</code> sets it. Until then the hook, passage and design-system fields stay <span className="na">Not linked</span>.
          </p>
        ) : (
          <>
            <div className="hooks">
              <div>
                <div className="sub">Original hook</div>
                <blockquote>{ep.hook_original || <span className="na">Not set</span>}</blockquote>
              </div>
              <div>
                <div className="sub">Final hook{ep.hook_final && ep.hook_final === ep.hook_original ? " (unchanged)" : ""}</div>
                <blockquote className="final">{ep.hook_final || <span className="na">Not set</span>}</blockquote>
              </div>
            </div>
            <dl className="kv" style={{ marginTop: 14 }}>
              <dt>Hypothesis</dt>
              <dd>{ep.hypothesis || <span className="na">Not set</span>}</dd>
              <dt>Hook type</dt>
              <dd>{ep.hook_type || <span className="na">Not set</span>}</dd>
              <dt>Passage</dt>
              <dd>
                {ep.passage || <span className="na">Not set</span>}
                {ep.translation ? ` (${ep.translation})` : ""}
              </dd>
              <dt>Topic</dt>
              <dd>{ep.topic || <span className="na">Not set</span>}</dd>
              <dt>Design system</dt>
              <dd>{ep.design_system_version ? `v${ep.design_system_version}` : <span className="na">Not set</span>}</dd>
              <dt>Revisions</dt>
              <dd>{ep.effort?.revisions ?? <span className="na">Not set</span>}</dd>
              <dt>Status</dt>
              <dd>{ep.status || <span className="na">Not set</span>}</dd>
            </dl>
          </>
        )}
      </section>

      <section className="card" aria-label="Snapshot history">
        <div className="card-head">
          <h2>Snapshot history</h2>
          <span className="sub">{video.snapshots.length} snapshot{video.snapshots.length === 1 ? "" : "s"}. Metrics are cumulative, so later rows show maturation.</span>
        </div>
        {video.snapshots.length === 0 ? (
          <p className="sub">No snapshots yet.</p>
        ) : (
          <>
            {video.snapshots.length > 1 ? (
              <MaturationCharts
                points={video.snapshots.map((s) => ({
                  date: s.date,
                  ageDays: daysBetween(video.published_at.slice(0, 10), s.date),
                  views: s.metrics.views,
                  avgPct: s.metrics.averageViewPercentage,
                  avd: s.metrics.averageViewDuration,
                }))}
              />
            ) : (
              <p className="sub">Only one snapshot so far, so there is no trend to draw yet.</p>
            )}
            <div className="table-wrap" style={{ marginTop: 14 }} role="region" aria-label="Snapshot table" tabIndex={0}>
              <table className="data">
                <thead>
                  <tr>
                    <th className="l">Snapshot</th>
                    <th>Day</th>
                    <th>Data through</th>
                    <th>Views</th>
                    <th>Engaged</th>
                    <th>Watch time</th>
                    <th>Avg view dur.</th>
                    <th>Avg % viewed</th>
                    <th>Likes</th>
                    <th>Subs net</th>
                    <th className="l">Retention</th>
                  </tr>
                </thead>
                <tbody>
                  {[...video.snapshots].reverse().map((s) => {
                    const sn = s.metrics.subscribersGained != null && s.metrics.subscribersLost != null ? s.metrics.subscribersGained - s.metrics.subscribersLost : null;
                    const cell = (v: number | null, f: (n: number) => string) => (v == null ? <Na /> : f(v));
                    return (
                      <tr key={s.date}>
                        <td className="l">
                          {fmtDate(s.date, true)} {s.partial && <span className="badge warn">partial</span>}
                        </td>
                        <td>{daysBetween(video.published_at.slice(0, 10), s.date)}</td>
                        <td>{fmtDate(s.data_through)}</td>
                        <td>{cell(s.metrics.views, fmtInt)}</td>
                        <td>{cell(s.metrics.engagedViews, fmtInt)}</td>
                        <td>{cell(s.metrics.estimatedMinutesWatched, fmtWatch)}</td>
                        <td>{cell(s.metrics.averageViewDuration, fmtSeconds)}</td>
                        <td>{cell(s.metrics.averageViewPercentage, fmtPct)}</td>
                        <td>{cell(s.metrics.likes, fmtInt)}</td>
                        <td>{cell(sn, (n) => fmtSigned(n))}</td>
                        <td className="l">{s.retention_curve ? `${s.retention_source === "csv" ? "CSV" : "API"}, ${s.retention_curve.length} pts` : <Na />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div className="pager">
        {older ? (
          <Link href={`/videos/${older.video_id}`}>
            <Icon name="chevLeft" size={16} /> Older: {older.title.length > 34 ? `${older.title.slice(0, 33)}...` : older.title}
          </Link>
        ) : (
          <span />
        )}
        {newer ? (
          <Link href={`/videos/${newer.video_id}`}>
            Newer: {newer.title.length > 34 ? `${newer.title.slice(0, 33)}...` : newer.title} <Icon name="chevRight" size={16} />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
