const LIGHTFIELD_BASE = "https://api.lightfield.app";
const LIGHTFIELD_VERSION = "2026-03-01";
const PAGE_SIZE = 25;
const DEFAULT_MAX_PAGES = 8;

type LightfieldField = { value: unknown; valueType: string };
type LightfieldMeeting = {
  id: string;
  httpLink?: string;
  fields: Record<string, LightfieldField>;
};
type LightfieldListResponse = { data: LightfieldMeeting[]; totalCount: number };

export interface NormalizedMeeting {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  meetingUrl: string | null;
  organizerEmail: string | null;
  attendeeEmails: string[];
  httpLink: string | null;
}

function pickString(field?: LightfieldField): string | null {
  if (!field) return null;
  const v = field.value;
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0] as string;
  return null;
}

function pickStringArray(field?: LightfieldField): string[] {
  if (!field) return [];
  const v = field.value;
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string") return [v];
  return [];
}

export async function fetchAllUpcomingMeetings(opts?: {
  maxPages?: number;
  fromIso?: string;
}): Promise<NormalizedMeeting[]> {
  const apiKey = process.env.LIGHTFIELD_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LIGHTFIELD_API_KEY not set. Add it to frontend/.env.local and restart dev server.",
    );
  }

  const cutoff = opts?.fromIso ?? new Date().toISOString();
  const maxPages = opts?.maxPages ?? DEFAULT_MAX_PAGES;
  const seen = new Set<string>();
  const upcoming: NormalizedMeeting[] = [];

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${LIGHTFIELD_BASE}/v1/meetings`);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(page * PAGE_SIZE));

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Lightfield-Version": LIGHTFIELD_VERSION,
      },
      cache: "no-store",
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Lightfield API ${resp.status}: ${body.slice(0, 200)}`);
    }

    const json = (await resp.json()) as LightfieldListResponse;
    const items = json.data || [];
    if (items.length === 0) break;

    for (const m of items) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      const f = m.fields || {};
      const start = pickString(f["$startDate"]);
      if (!start || start < cutoff) continue;
      upcoming.push({
        id: m.id,
        title: pickString(f["$title"]) || "(untitled meeting)",
        startDate: start,
        endDate: pickString(f["$endDate"]),
        meetingUrl: pickString(f["$meetingUrl"]),
        organizerEmail: pickString(f["$organizerEmail"]),
        attendeeEmails: pickStringArray(f["$attendeeEmails"]),
        httpLink: m.httpLink ?? null,
      });
    }

    if (items.length < PAGE_SIZE) break;
  }

  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return upcoming;
}
