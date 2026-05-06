import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase client. Reuses the same anon key the FastAPI backend
 * uses (RLS is disabled on Kalinda-GTM tables).
 */
export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_KEY missing from frontend/.env.local",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export const FIRM_DEMO_TABLE = "firm_demo_meetings";

export interface FirmDemoMeetingRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  meeting_url: string | null;
  organizer_email: string | null;
  attendee_emails: string[];
  http_link: string | null;
  demo_html: string | null;
  demo_html_filename: string | null;
  demo_html_size_bytes: number | null;
  demo_html_uploaded_at: string | null;
  synced_at: string;
  created_at: string;
}

export type FirmDemoMeetingMeta = Omit<
  FirmDemoMeetingRow,
  "demo_html" | "created_at" | "synced_at"
> & {
  has_demo_html: boolean;
};
