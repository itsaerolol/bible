// Shapes of the JSON files in data/ (contract: docs/schemas.md plus "Schema notes").

export const METRIC_KEYS = [
  "views",
  "engagedViews",
  "estimatedMinutesWatched",
  "averageViewDuration",
  "averageViewPercentage",
  "likes",
  "comments",
  "shares",
  "subscribersGained",
  "subscribersLost",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export type Metrics = Record<MetricKey, number | null>;

export interface RetentionPoint {
  t: number;
  audienceWatchRatio: number;
  relativeRetentionPerformance: number | null;
}

export interface TrafficSource {
  source: string;
  views: number | null;
  engagedViews?: number | null;
  estimatedMinutesWatched?: number | null;
}

export interface Snapshot {
  date: string;
  data_through?: string;
  partial?: boolean;
  metrics: Metrics;
  traffic_sources: TrafficSource[] | null;
  retention_curve: RetentionPoint[] | null;
  retention_source: "api" | "csv" | null;
  unavailable: string[];
  retention_note?: string;
  retention_carried_from?: string;
  retention_csv?: string;
  retention_imported_at?: string;
  traffic_note?: string;
}

export interface VideoFile {
  video_id: string;
  title: string;
  published_at: string;
  duration_sec: number;
  is_short: boolean;
  episode_id: string | null;
  snapshots: Snapshot[];
}

export interface DailyRow {
  date: string;
  views: number | null;
  engagedViews: number | null;
  estimatedMinutesWatched: number | null;
  subscribersGained: number | null;
  subscribersLost: number | null;
}

export interface Channel {
  generated_at: string;
  channel_id: string;
  daily: DailyRow[];
}

export interface Episode {
  id: string;
  title?: string;
  status?: string;
  passage?: string;
  translation?: string;
  topic?: string;
  hook_type?: string;
  hook_original?: string;
  hook_final?: string;
  design_system_version?: string;
  duration_sec?: number | null;
  youtube_id?: string | null;
  posted_at?: string | null;
  hypothesis?: string;
  effort?: { revisions?: number | null; edit_minutes?: number | null };
}

export interface Recommendation {
  title: string;
  rationale: string;
  evidence: string[];
  confidence: "low" | "medium" | "high";
}

export interface Insights {
  generated_at: string;
  model: string;
  based_on: { videos: number; date_range: [string, string] };
  summary: string;
  recommendations: Recommendation[];
  caveats: string[];
  sample?: { videos: number; mature_videos: number };
}

export interface SyncStatus {
  generated_at: string;
  sync_date: string;
  data_through: string;
  lag_days: number;
  mode: string;
  channel_id: string | null;
  uploads_seen: number;
  shorts_tracked: number;
  long_form_skipped: number;
  private_skipped?: number;
  snapshots_written: number;
  snapshots_deferred: number;
  videos_without_complete_data: number;
  videos_without_metrics: number;
  retention: {
    eligible: number;
    api_ok: number;
    api_empty: number;
    api_error: number;
    csv_carried: number;
    verdict: "works" | "unavailable" | "inconclusive";
    first_error: string | null;
  };
  traffic: { ok: number; empty: number; error: number; first_error: string | null };
  episodes: { linked: number; unmatched_youtube_ids: string[] };
  notes: string[];
}

export interface Dataset {
  mock: boolean;
  channel: Channel | null;
  videos: VideoFile[];
  episodes: Episode[];
  insights: Insights | null;
  status: SyncStatus | null;
  /** Date (YYYY-MM-DD) that ages and maturity are measured against: the last sync date. */
  refDate: string | null;
  lastSyncAt: string | null;
  dataThrough: string | null;
  warnings: string[];
}
