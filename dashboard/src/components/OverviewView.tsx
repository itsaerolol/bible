"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, ageLabel, fmtClock, fmtCompact, fmtDate, fmtInt, fmtPct, fmtRatio, fmtSeconds, fmtWatch } from "@/lib/format";
import { dailySeries, netSubs, pctChange, totalOf, weightedMean, type VideoRow, type WindowTotal } from "@/lib/model";
import type { DailyRow } from "@/lib/types";
import { Icon } from "./Icon";
import { LineChart } from "./LineChart";
import { Sparkline } from "./Sparkline";
import { Empty, MaturityBadge, Na } from "./ui";

type Range = 7 | 28 | 90;

interface Delta {
  dir: "up" | "down" | "flat" | "none";
  text: string;
}

interface Kpi {
  key: string;
  label: string;
  value: string | null;
  delta: Delta;
  foot: string;
  spark: Array<number | null>;
  split: number;
}

function coverageOk(w: WindowTotal) {
  return w.days > 0 && w.present / w.days >= 0.9;
}

function pctDelta(cur: number | null, prev: number | null, curOk: boolean, prevOk: boolean, range: number): Delta {
  if (cur == null) return { dir: "none", text: "No data in this window" };
  if (!prevOk || prev == null) return { dir: "none", text: "Not enough history to compare" };
  const p = pctChange(cur, prev);
  if (!curOk) return { dir: "none", text: "Current window has gaps, comparison skipped" };
  if (p == null) return { dir: "none", text: "No change base (previous period was zero)" };
  const dir = Math.abs(p) < 0.5 ? "flat" : p > 0 ? "up" : "down";
  return { dir, text: `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p) >= 100 ? Math.round(Math.abs(p)).toLocaleString("en-US") : Math.abs(p).toFixed(1)}% vs previous ${range} days` };
}

export function OverviewView({ daily, rows, dataThrough }: { daily: DailyRow[]; rows: VideoRow[]; dataThrough: string | null }) {
  const [range, setRange] = useState<Range>(28);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("range"));
      if (saved === 7 || saved === 28 || saved === 90) setRange(saved);
    } catch {
      /* ignore blocked storage */
    }
  }, []);
  const choose = (r: Range) => {
    setRange(r);
    try {
      localStorage.setItem("range", String(r));
    } catch {
      /* ignore */
    }
  };

  const lastDaily = daily.at(-1)?.date ?? null;
  const end = lastDaily && dataThrough ? (lastDaily < dataThrough ? lastDaily : dataThrough) : (lastDaily ?? dataThrough);

  const model = useMemo(() => {
    if (!end || !daily.length) return null;
    const curFrom = addDays(end, -(range - 1));
    const prevTo = addDays(curFrom, -1);
    const prevFrom = addDays(prevTo, -(range - 1));
    const both = (key: "views" | "engagedViews" | "estimatedMinutesWatched") => ({
      cur: dailySeries(daily, key, curFrom, end),
      prev: dailySeries(daily, key, prevFrom, prevTo),
    });
    const v = both("views");
    const e = both("engagedViews");
    const m = both("estimatedMinutesWatched");
    const curSubs = netSubs(daily, curFrom, end);
    const prevSubs = netSubs(daily, prevFrom, prevTo);

    const tv = { cur: totalOf(v.cur), prev: totalOf(v.prev) };
    const te = { cur: totalOf(e.cur), prev: totalOf(e.prev) };
    const tm = { cur: totalOf(m.cur), prev: totalOf(m.prev) };
    const ts = { cur: totalOf(curSubs), prev: totalOf(prevSubs) };

    const avd = (mins: number | null, views: number | null) => (mins != null && views != null && views > 0 ? (mins * 60) / views : null);
    const avdSeries = (mm: Array<number | null>, vv: Array<number | null>) => mm.map((x, i) => avd(x, vv[i] ?? null));
    const avdCur = avd(tm.cur.total, tv.cur.total);
    const avdPrev = avd(tm.prev.total, tv.prev.total);

    // cohort metric: videos published in the window, views-weighted
    const inWin = (r: VideoRow, a: string, b: string) => r.hasSnapshot && r.publishedDate >= a && r.publishedDate <= b;
    const curRows = rows.filter((r) => inWin(r, curFrom, end));
    const prevRows = rows.filter((r) => inWin(r, prevFrom, prevTo));
    const pctOf = (rs: VideoRow[]) => weightedMean(rs.map((r) => ({ v: r.m.averageViewPercentage, w: r.m.views })));
    const cohort = [...prevRows, ...curRows].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    const pctCur = pctOf(curRows);
    const pctPrev = pctOf(prevRows);

    const foot = (w: WindowTotal, extra: string) => (w.present < w.days ? `${extra} ${w.present} of ${w.days} days reported.` : extra);
    const kpis: Kpi[] = [
      {
        key: "views",
        label: "Views",
        value: tv.cur.total == null ? null : fmtCompact(tv.cur.total),
        delta: pctDelta(tv.cur.total, tv.prev.total, coverageOk(tv.cur), coverageOk(tv.prev), range),
        foot: foot(tv.cur, `Last ${range} days.`),
        spark: [...v.prev, ...v.cur],
        split: v.prev.length,
      },
      {
        key: "engaged",
        label: "Engaged views",
        value: te.cur.total == null ? null : fmtCompact(te.cur.total),
        delta: pctDelta(te.cur.total, te.prev.total, coverageOk(te.cur), coverageOk(te.prev), range),
        foot: foot(te.cur, "Views past the first frame."),
        spark: [...e.prev, ...e.cur],
        split: e.prev.length,
      },
      {
        key: "watch",
        label: "Watch time",
        value: tm.cur.total == null ? null : fmtWatch(tm.cur.total),
        delta: pctDelta(tm.cur.total, tm.prev.total, coverageOk(tm.cur), coverageOk(tm.prev), range),
        foot: foot(tm.cur, "Estimated minutes watched."),
        spark: [...m.prev, ...m.cur],
        split: m.prev.length,
      },
      {
        key: "avd",
        label: "Avg view duration",
        value: avdCur == null ? null : fmtSeconds(avdCur),
        delta: pctDelta(avdCur, avdPrev, coverageOk(tm.cur) && coverageOk(tv.cur), coverageOk(tm.prev) && coverageOk(tv.prev), range),
        foot: "Derived: watch time divided by views.",
        spark: [...avdSeries(m.prev, v.prev), ...avdSeries(m.cur, v.cur)],
        split: v.prev.length,
      },
      {
        key: "pct",
        label: "Avg % viewed",
        value: pctCur == null ? null : fmtPct(pctCur),
        delta:
          pctCur == null
            ? { dir: "none", text: "No video published in this window" }
            : pctPrev == null
              ? { dir: "none", text: "No videos in the previous window to compare" }
              : (() => {
                  const d = pctCur - pctPrev;
                  return { dir: Math.abs(d) < 0.5 ? "flat" : d > 0 ? "up" : "down", text: `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)} pts vs previous ${range} days` } as Delta;
                })(),
        foot: pctCur == null ? "Needs a video published in the window." : `n=${curRows.length} video${curRows.length === 1 ? "" : "s"} published ${fmtDate(curFrom)} to ${fmtDate(end)}${prevRows.length ? `, compared with n=${prevRows.length}` : ""}. Views-weighted. One dot per video.`,
        spark: cohort.map((r) => r.m.averageViewPercentage),
        split: prevRows.length,
      },
      {
        key: "subs",
        label: "Subscribers, net",
        value: ts.cur.total == null ? null : `${ts.cur.total > 0 ? "+" : ts.cur.total < 0 ? "−" : ""}${fmtInt(Math.abs(ts.cur.total))}`,
        delta:
          ts.cur.total == null
            ? { dir: "none", text: "No data in this window" }
            : ts.prev.total == null || !coverageOk(ts.prev)
              ? { dir: "none", text: "Not enough history to compare" }
              : (() => {
                  const d = ts.cur.total - ts.prev.total;
                  return { dir: d === 0 ? "flat" : d > 0 ? "up" : "down", text: `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d)} vs previous ${range} days` } as Delta;
                })(),
        foot: foot(ts.cur, "Gained minus lost."),
        spark: [...prevSubs, ...curSubs],
        split: prevSubs.length,
      },
    ];

    const dates = Array.from({ length: range }, (_, i) => addDays(curFrom, i));
    return { kpis, dates, views: v.cur, engaged: e.cur, curFrom, end, prevFrom, prevTo };
  }, [daily, rows, range, end]);

  const recent = rows.slice(0, 6);

  return (
    <>
      <div className="filters" role="group" aria-label="Date range">
        <div className="seg">
          {([7, 28, 90] as Range[]).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => choose(r)}>
              Last {r} days
            </button>
          ))}
        </div>
        {model && (
          <span className="sub">
            {fmtDate(model.curFrom)} to {fmtDate(model.end, true)} · compared with {fmtDate(model.prevFrom)} to {fmtDate(model.prevTo)}
          </span>
        )}
      </div>

      {!model ? (
        <Empty title="No channel data yet">The daily Action has not written data/analytics/channel.json. Run the Sync analytics workflow, or generate sample data with node scripts/make-mock-data.mjs.</Empty>
      ) : (
        <>
          <section aria-label="Key numbers" className="kpis">
            {model.kpis.map((k) => (
              <article className="kpi" key={k.key}>
                <h2 className="label">{k.label}</h2>
                {k.value == null ? (
                  <div className="value na">Unavailable</div>
                ) : (
                  <div className="value">{k.value}</div>
                )}
                <div className={`delta ${k.delta.dir}`}>
                  {k.delta.dir === "up" && <Icon name="up" size={14} />}
                  {k.delta.dir === "down" && <Icon name="down" size={14} />}
                  {k.delta.dir === "flat" && <Icon name="flat" size={14} />}
                  <span>{k.delta.text}</span>
                </div>
                <Sparkline values={k.spark} split={k.split} />
                <div className="foot">{k.foot}</div>
              </article>
            ))}
          </section>

          <section className="card" aria-label="Daily views">
            <div className="card-head">
              <h2>Daily views</h2>
              <span className="sub">Public views count from the first frame (Shorts since Mar 31, 2025, all videos since late Aug 2026). Engaged views keep the earlier rule.</span>
            </div>
            <LineChart
              labels={model.dates}
              ariaLabel={`Daily views and engaged views, last ${range} days`}
              xTick={(i) => fmtDate(model.dates[i])}
              tipTitle={(i) => fmtDate(model.dates[i], true)}
              yFormat={(n) => fmtCompact(n)}
              valueFormat={(n) => fmtInt(n)}
              series={[
                { key: "views", label: "Views", color: "var(--s1)", values: model.views, area: true },
                { key: "engaged", label: "Engaged views", color: "var(--s2)", values: model.engaged },
              ]}
            />
          </section>
        </>
      )}

      <section aria-label="Recent videos">
        <div className="card-head" style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650 }}>Recent videos</h2>
          <Link href="/content" className="sub">
            All videos
          </Link>
        </div>
        {recent.length === 0 ? (
          <Empty title="No videos yet">Nothing has been tracked. The first sync lists your Shorts.</Empty>
        ) : (
          <div className="strip">
            {recent.map((r) => (
              <Link key={r.id} href={`/videos/${r.id}`} className="vcard">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <span className="sub">{fmtDate(r.publishedDate)} · {ageLabel(r.ageDays)}</span>
                  <MaturityBadge ageDays={r.ageDays} mature={r.mature} />
                </div>
                <h3>{r.title}</h3>
                {r.hasSnapshot ? (
                  <dl>
                    <div>
                      <dt>Views</dt>
                      <dd>{r.m.views == null ? <Na /> : fmtCompact(r.m.views)}</dd>
                    </div>
                    <div>
                      <dt>Avg % viewed</dt>
                      <dd>{r.m.averageViewPercentage == null ? <Na /> : fmtPct(r.m.averageViewPercentage)}</dd>
                    </div>
                    <div>
                      <dt>Held at 3s</dt>
                      <dd>{r.at3s == null ? <Na why="No retention curve for this video." /> : fmtRatio(r.at3s)}</dd>
                    </div>
                    <div>
                      <dt>Length</dt>
                      <dd>{fmtClock(r.durationSec)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="sub">No analytics yet. YouTube data arrives 48 to 72 hours after posting.</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
