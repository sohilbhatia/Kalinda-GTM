import { NextResponse } from "next/server";
import { FIRM_DEMO_TABLE, getSupabase, type FirmDemoMeetingMeta } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabase();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from(FIRM_DEMO_TABLE)
    .select(
      "id,title,start_date,end_date,meeting_url,organizer_email,attendee_emails,http_link,demo_html_filename,demo_html_size_bytes,demo_html_uploaded_at",
    )
    .gte("start_date", nowIso)
    .order("start_date", { ascending: true });

  if (error) {
    const isMissingTable =
      error.code === "PGRST205" ||
      error.message?.toLowerCase().includes("could not find the table");
    return NextResponse.json(
      {
        error: error.message,
        hint: isMissingTable
          ? "Run supabase/migrations/0001_firm_demo_meetings.sql in the Supabase SQL editor."
          : (error.hint ?? null),
        missingTable: isMissingTable || undefined,
      },
      { status: isMissingTable ? 412 : 500 },
    );
  }

  const meetings: FirmDemoMeetingMeta[] = (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    start_date: row.start_date,
    end_date: row.end_date,
    meeting_url: row.meeting_url,
    organizer_email: row.organizer_email,
    attendee_emails: row.attendee_emails ?? [],
    http_link: row.http_link,
    demo_html_filename: row.demo_html_filename,
    demo_html_size_bytes: row.demo_html_size_bytes,
    demo_html_uploaded_at: row.demo_html_uploaded_at,
    has_demo_html: !!row.demo_html_filename,
  }));

  return NextResponse.json({ meetings });
}
