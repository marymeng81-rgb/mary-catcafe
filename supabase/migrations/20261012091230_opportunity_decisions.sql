alter table public.opportunities drop constraint opportunities_status_check;
alter table public.opportunities add constraint opportunities_status_check check (status in ('new','approved','rejected','reviewed','archived'));
alter table public.opportunities add column decided_at timestamptz;
grant update (status, decided_at) on public.opportunities to service_role;
