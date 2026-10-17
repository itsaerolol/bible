import { fmtDateTimeUtc, fmtDate } from "@/lib/format";
import type { SyncStatus } from "@/lib/types";
import { Icon } from "./Icon";

const VERDICT_TEXT: Record<SyncStatus["retention"]["verdict"], string> = {
  works: "Retention curves are coming through the API.",
  unavailable: "The API returned no retention curve for any Short aged 4+ days.",
  inconclusive: "Inconclusive: no tracked Short is 4+ days old yet.",
};

/** What the last sync saw, including the retention-curve API test. */
export function SyncHealth({ status, mock }: { status: SyncStatus | null; mock: boolean }) {
  if (!status) {
    return (
      <section className="card" aria-label="Sync health">
        <div className="card-head">
          <h2>Sync health</h2>
        </div>
        <p className="sub">No sync-status.json yet. It is written by every run of the Sync analytics workflow.</p>
      </section>
    );
  }
  const r = status.retention;
  return (
    <section className="card" aria-label="Sync health">
      <div className="card-head">
        <h2>Sync health</h2>
        <span className="sub">{mock ? "Fabricated sample status" : `Mode: ${status.mode}`}</span>
      </div>
      <div className={`callout${r.verdict === "unavailable" ? " warn" : ""}`} style={{ marginBottom: 12 }}>
        <Icon name={r.verdict === "unavailable" ? "alert" : "info"} size={18} />
        <div>
          <strong>Retention curve test: {r.verdict}.</strong> {VERDICT_TEXT[r.verdict]} Of {r.eligible} Short{r.eligible === 1 ? "" : "s"} aged 4+ days: {r.api_ok} returned a curve, {r.api_empty} returned nothing, {r.api_error} errored
          {r.csv_carried ? `, ${r.csv_carried} use an imported CSV curve` : ""}.
          {r.verdict === "unavailable" && " Use the Studio CSV fallback (docs/dashboard-setup.md)."}
          {r.first_error && <> First error: <span className="mono">{r.first_error}</span></>}
        </div>
      </div>
      <dl className="kv">
        <dt>Last sync</dt>
        <dd>{fmtDateTimeUtc(status.generated_at)}</dd>
        <dt>Data through</dt>
        <dd>
          {fmtDate(status.data_through, true)} (YouTube processes data with a 48 to 72 hour delay, so the last {status.lag_days} days are held back)
        </dd>
        <dt>Shorts tracked</dt>
        <dd>
          {status.shorts_tracked} of {status.uploads_seen} uploads ({status.long_form_skipped} long-form skipped)
        </dd>
        <dt>Snapshots this run</dt>
        <dd>
          {status.snapshots_written} written, {status.snapshots_deferred} deferred by cadence, {status.videos_without_complete_data} too new for complete data
          {status.videos_without_metrics ? `, ${status.videos_without_metrics} with no metrics row` : ""}
        </dd>
        <dt>Traffic sources</dt>
        <dd>
          {status.traffic.ok} ok, {status.traffic.empty} empty, {status.traffic.error} errors
        </dd>
        <dt>Episode links</dt>
        <dd>
          {status.episodes.linked} linked
          {status.episodes.unmatched_youtube_ids.length > 0 && (
            <>
              {" "}
              · unmatched youtube_id in episodes: <span className="mono">{status.episodes.unmatched_youtube_ids.join(", ")}</span>
            </>
          )}
        </dd>
      </dl>
    </section>
  );
}
