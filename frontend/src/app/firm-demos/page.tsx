"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  Clock,
  Download,
  RefreshCcw,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FirmDemoMeeting {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  meeting_url: string | null;
  organizer_email: string | null;
  attendee_emails: string[];
  http_link: string | null;
  demo_html_filename: string | null;
  demo_html_size_bytes: number | null;
  demo_html_uploaded_at: string | null;
  has_demo_html: boolean;
}

interface ListResponse {
  meetings?: FirmDemoMeeting[];
  error?: string;
  hint?: string;
  missingTable?: boolean;
}

const TZ = "America/Los_Angeles";
const SQL_PATH = "supabase/migrations/0001_firm_demo_meetings.sql";

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: TZ,
  });
}

function formatDayShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: TZ,
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

function externalEmails(m: FirmDemoMeeting): string[] {
  return (m.attendee_emails || []).filter(
    (e) => !e.toLowerCase().endsWith("@kalinda.ai"),
  );
}

function firmHostFromEmail(email?: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).toLowerCase();
}

function formatBytes(n: number | null | undefined): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function FirmDemosPage() {
  const [meetings, setMeetings] = useState<FirmDemoMeeting[] | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string; missingTable?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const list = useCallback(async (): Promise<FirmDemoMeeting[] | null> => {
    const resp = await fetch("/api/firm-demos", { cache: "no-store" });
    const json = (await resp.json()) as ListResponse;
    if (!resp.ok || json.error) {
      setError({
        message: json.error || `Request failed (${resp.status})`,
        hint: json.hint,
        missingTable: json.missingTable,
      });
      return null;
    }
    setError(null);
    setMeetings(json.meetings || []);
    return json.meetings || [];
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const resp = await fetch("/api/firm-demos/sync", { method: "POST" });
      const json = await resp.json();
      if (!resp.ok || json.error) {
        setError({ message: json.error || `Sync failed (${resp.status})`, hint: json.hint });
      } else {
        setLastSync(new Date().toISOString());
        await list();
      }
    } catch (e) {
      setError({ message: (e as Error).message });
    } finally {
      setSyncing(false);
    }
  }, [list]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const initial = await list();
      // Always pull from Lightfield on first load so new meetings appear automatically.
      if (initial !== null) {
        setSyncing(true);
        try {
          const resp = await fetch("/api/firm-demos/sync", { method: "POST" });
          const json = await resp.json();
          if (resp.ok && !json.error) {
            setLastSync(new Date().toISOString());
            await list();
          }
        } catch {
          // ignore – list() already populated UI
        } finally {
          setSyncing(false);
        }
      }
      setLoading(false);
    })();
  }, [list]);

  const grouped = useMemo(() => {
    const map = new Map<string, FirmDemoMeeting[]>();
    (meetings || []).forEach((m) => {
      const k = dayKey(m.start_date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [meetings]);

  const handleUploaded = useCallback((updated: FirmDemoMeeting) => {
    setMeetings((cur) =>
      (cur || []).map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
    );
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground/80">
            <Building2 className="size-3.5" />
            Firm Demos
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Upcoming firm demos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Synced from Lightfield to Supabase. Upload an HTML deck per meeting; click a
            meeting to download it.
          </p>
        </div>
        <button
          type="button"
          onClick={sync}
          disabled={syncing}
          className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2.5 text-[13px] font-medium text-foreground/80 hover:bg-black/[0.04] disabled:opacity-50"
        >
          <RefreshCcw className={cn("size-3.5", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync from Lightfield"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
          <div className="font-medium">Couldn’t load meetings</div>
          <div className="mt-1 text-destructive/90">{error.message}</div>
          {error.missingTable && (
            <div className="mt-2 text-destructive/80">
              Run{" "}
              <code className="rounded bg-destructive/10 px-1 py-0.5">{SQL_PATH}</code>{" "}
              in the Supabase SQL editor for project{" "}
              <code className="rounded bg-destructive/10 px-1 py-0.5">ocofvxnvrodqxpytgsum</code>,
              then refresh.
            </div>
          )}
          {!error.missingTable && error.hint && (
            <div className="mt-2 text-destructive/80">{error.hint}</div>
          )}
        </div>
      )}

      {!error && loading && meetings === null && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-xl bg-black/[0.04]" />
          ))}
        </div>
      )}

      {!error && meetings !== null && meetings.length === 0 && !loading && (
        <div className="rounded-xl border border-border bg-white px-6 py-10 text-center">
          <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-black/[0.05] text-muted-foreground">
            <Calendar className="size-4" />
          </div>
          <div className="text-sm font-medium">No upcoming meetings</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            Lightfield didn’t return any meetings with a future start date.
          </div>
        </div>
      )}

      <div className="space-y-8">
        {grouped.map(([day, dayMeetings]) => (
          <section key={day}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {formatDay(dayMeetings[0].start_date)}
              </div>
              <div className="h-px flex-1 bg-border/60" />
              <div className="text-[11px] text-muted-foreground/70">
                {dayMeetings.length} {dayMeetings.length === 1 ? "demo" : "demos"}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {dayMeetings.map((m) => (
                <MeetingRow key={m.id} meeting={m} onUploaded={handleUploaded} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {lastSync && (
        <div className="mt-10 text-[11px] text-muted-foreground/60">
          Last synced from Lightfield{" "}
          {new Date(lastSync).toLocaleString("en-US", { timeZone: TZ })}
        </div>
      )}
    </div>
  );
}

function MeetingRow({
  meeting,
  onUploaded,
}: {
  meeting: FirmDemoMeeting;
  onUploaded: (m: FirmDemoMeeting) => void;
}) {
  const ext = externalEmails(meeting);
  const firms = Array.from(
    new Set(ext.map(firmHostFromEmail).filter(Boolean) as string[]),
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const handleClick = () => {
    if (!meeting.has_demo_html) {
      // No deck yet → open the file picker so they can attach one.
      fileInputRef.current?.click();
      return;
    }
    // Trigger download via hidden anchor → Content-Disposition: attachment.
    const a = document.createElement("a");
    a.href = `/api/firm-demos/${meeting.id}/download`;
    a.rel = "noopener";
    a.download = meeting.demo_html_filename || "demo.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setRowError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`/api/firm-demos/${meeting.id}/upload`, {
        method: "POST",
        body: fd,
      });
      const json = await resp.json();
      if (!resp.ok || json.error) {
        setRowError(json.error || `Upload failed (${resp.status})`);
        return;
      }
      onUploaded({
        ...meeting,
        demo_html_filename: json.meeting?.demo_html_filename ?? file.name,
        demo_html_size_bytes: json.meeting?.demo_html_size_bytes ?? file.size,
        demo_html_uploaded_at:
          json.meeting?.demo_html_uploaded_at ?? new Date().toISOString(),
        has_demo_html: true,
      });
    } catch (e) {
      setRowError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="group flex items-stretch gap-4 rounded-xl border border-border bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className="flex flex-1 items-stretch gap-4 text-left disabled:opacity-60"
      >
        <div className="flex w-[68px] shrink-0 flex-col items-center justify-center rounded-lg bg-black/[0.04] text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {new Date(meeting.start_date).toLocaleDateString("en-US", {
              month: "short",
              timeZone: TZ,
            })}
          </div>
          <div className="text-2xl font-semibold tabular-nums leading-none">
            {new Date(meeting.start_date).toLocaleDateString("en-US", {
              day: "numeric",
              timeZone: TZ,
            })}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {formatDayShort(meeting.start_date)}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
            {meeting.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {formatTime(meeting.start_date)}
              {meeting.end_date && <> – {formatTime(meeting.end_date)}</>}
            </span>
            {ext.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" />
                {ext.length} {ext.length === 1 ? "guest" : "guests"}
              </span>
            )}
            {firms.length > 0 && (
              <span className="inline-flex items-center gap-1.5 truncate">
                <Building2 className="size-3.5" />
                <span className="truncate">{firms.join(", ")}</span>
              </span>
            )}
            {meeting.has_demo_html && (
              <span className="inline-flex items-center gap-1.5 text-foreground/70">
                <Download className="size-3.5" />
                {meeting.demo_html_filename}
                {meeting.demo_html_size_bytes ? (
                  <span className="text-muted-foreground/70">
                    · {formatBytes(meeting.demo_html_size_bytes)}
                  </span>
                ) : null}
              </span>
            )}
          </div>
          {rowError && (
            <div className="mt-1.5 text-[12px] text-destructive">{rowError}</div>
          )}
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-end justify-center gap-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-white px-2 text-[12px] font-medium text-foreground/70 transition-colors hover:bg-black/[0.04]",
            uploading && "opacity-60",
          )}
        >
          <Upload className="size-3.5" />
          {uploading ? "Uploading…" : meeting.has_demo_html ? "Replace" : "Upload .html"}
        </button>
        {meeting.has_demo_html && (
          <button
            type="button"
            onClick={handleClick}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-white px-2 text-[12px] font-medium text-foreground/70 hover:bg-black/[0.04]"
          >
            <Download className="size-3.5" />
            Download
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,text/html"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
