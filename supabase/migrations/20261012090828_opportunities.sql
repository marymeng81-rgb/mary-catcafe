create table public.opportunities (
  id bigint generated always as identity primary key,
  url text not null unique,
  name text not null,
  status text not null default 'new' check (status in ('new','reviewed','archived')),
  opportunity jsonb not null,
  checked_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.opportunities enable row level security;
revoke all on public.opportunities from anon, authenticated;
grant select, insert on public.opportunities to service_role;
grant usage, select on sequence public.opportunities_id_seq to service_role;
