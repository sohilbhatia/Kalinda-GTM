import { NextResponse } from "next/server";
import { fetchAllUpcomingMeetings } from "@/lib/lightfield";
import { FIRM_DEMO_TABLE, getSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST() {
  let meetings;
  try {
    meetings = await fetchAllUpcomingMeetings();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  if (meetings.length === 0) {
    return NextResponse.json({ upserted: 0, fetchedAt: new Date().toISOString() });
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  // Only touch metadata columns – never overwrite an uploaded demo_html.
  const rows = meetings.map((m) => ({
    id: m.id,
    title: m.title,
    start_date: m.startDate,
    end_date: m.endDate,
    meeting_url: m.meetingUrl,
    organizer_email: m.organizerEmail,
    attendee_emails: m.attendeeEmails,
    http_link: m.httpLink,
    synced_at: now,
  }));

  const { error } = await supabase
    .from(FIRM_DEMO_TABLE)
    .upsert(rows, { onConflict: "id", ignoreDuplicates: false });

  if (error) {
    return NextResponse.json(
      { error: `Supabase upsert failed: ${error.message}`, hint: error.hint ?? null },
      { status: 500 },
    );
  }

  return NextResponse.json({ upserted: rows.length, fetchedAt: now });
}
