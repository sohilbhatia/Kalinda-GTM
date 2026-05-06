-- Firm Demos: meetings synced from Lightfield + per-meeting HTML demo upload.
create table if not exists public.firm_demo_meetings (
  id                    text primary key,                -- Lightfield meeting id (mtg_...)
  title                 text not null,
  start_date            timestamptz not null,
  end_date              timestamptz,
  meeting_url           text,
  organizer_email       text,
  attendee_emails       text[] not null default '{}',
  http_link             text,
  demo_html             text,                            -- raw HTML contents (UTF-8)
  demo_html_filename    text,
  demo_html_size_bytes  integer,
  demo_html_uploaded_at timestamptz,
  synced_at             timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

create index if not exists firm_demo_meetings_start_date_idx
  on public.firm_demo_meetings (start_date);

-- Match the rest of this project (anon key is used as the service key in the API layer).
alter table public.firm_demo_meetings disable row level security;
