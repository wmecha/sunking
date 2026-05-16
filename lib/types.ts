// Core TypeScript interfaces for Sun King Location Intelligence

export interface GbpSnapshot {
  id: number;
  filename: string;
  imported_at: string;
  total_count: number;
  published_count: number;
  not_published_count: number;
  duplicate_count: number;
  notes?: string;
}

export interface GbpLocation {
  id: number;
  snapshot_id: number;
  store_code?: string;
  business_name?: string;
  status?: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface TrackerLocation {
  id: number;
  store_code?: string;
  business_name?: string;
  country?: string;
  location_type?: string;
  ov?: string;
  ou?: string;
  claiming_issue?: string;
  action_taken?: string;
  address?: string;
  city?: string;
  tracker_status?: string;
  // Canonical Google Maps Place URL (e.g. https://maps.app.goo.gl/...).
  // When set, the row's Maps link uses this exact URL — guaranteed to
  // land on the specific Sun King listing on Google. Falls back to a
  // lat/lng or address search when unset.
  google_maps_url?: string | null;
  // Photo URLs (Supabase Storage public URLs)
  logo_photo_url?: string | null;
  cover_photo_url?: string | null;
  other_photo_urls?: string[] | null;
  // Google Bulk Upload fields
  latitude?: number | null;
  longitude?: number | null;
  primary_phone?: string | null;
  website?: string | null;
  primary_category?: string | null;
  monday_hours?: string | null;
  tuesday_hours?: string | null;
  wednesday_hours?: string | null;
  thursday_hours?: string | null;
  friday_hours?: string | null;
  saturday_hours?: string | null;
  sunday_hours?: string | null;
  updated_at?: string;
  sheet_synced_at?: string | null;
}

export interface ReconciliationRun {
  id: number;
  run_at: string;
  snapshot_id: number;
  total_gbp?: number;
  total_tracker?: number;
  matched?: number;
  ov_confirmed?: number;
  ou_confirmed?: number;
  missing_from_tracker?: number;
  status_mismatches?: number;
}

export interface ExportHistory {
  id: number;
  exported_at: string;
  filename?: string;
  filter_country?: string;
  filter_status?: string;
  row_count?: number;
}

export interface CountryBreakdown {
  country: string;
  total: number;
  live: number;
  not_live: number;
  submitted: number;
  needs_pin: number;
}

export interface DashboardMetrics {
  totalInAccount: number;
  liveOnMaps: number;
  inAccountNotLive: number;
  needsAttention: number;
  latestSnapshot?: GbpSnapshot;
  countryBreakdown: CountryBreakdown[];
}

export interface ReconciliationResult {
  matched: number;
  missingFromTracker: GbpLocation[];
  missingFromGbp: TrackerLocation[];
  statusMismatches: Array<{
    store_code: string;
    business_name: string;
    gbp_status: string;
    tracker_status: string;
  }>;
}

export type TrackerStatus =
  | 'Live'
  | 'In Account'
  | 'Submitted'
  | 'Needs Pin'
  | 'No Claim'
  | 'Duplicate'
  | 'Closed';
