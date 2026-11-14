-- Lead Desk schema. Paste into Supabase > SQL Editor > New query > Run. Safe to re-run.

-- ---------- Team members (one row per login) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role text not null default 'caller' check (role in ('admin', 'caller', 'dev')),
  created_at timestamptz not null default now()
);

-- Create a profile automatically whenever a user is added in Authentication > Users.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Leads ----------
create table if not exists public.leads (
  id bigint generated always as identity primary key,
  category text not null,
  company text not null,
  emirate text default '',
  segment text default '',
  phone text default '',
  mobile text default '',
  email text default '',
  website text default '',
  address text default '',
  maps_url text default '',
  details jsonb not null default '{}'::jsonb,
  status text not null default 'new',
  starred boolean not null default false,
  assigned_to uuid references public.profiles (id) on delete set null,
  contact_person text default '',
  notes text default '',
  call_count int not null default 0,
  last_contacted_at timestamptz,
  next_follow_up timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_follow_idx on public.leads (next_follow_up);

-- ---------- Every call / note / status change ----------
create table if not exists public.activities (
  id bigint generated always as identity primary key,
  lead_id bigint references public.leads (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  type text not null,              -- call | note | status | meeting | tag | email | whatsapp
  outcome text,                    -- call outcome id or new status
  note text default '',
  created_at timestamptz not null default now()
);
create index if not exists activities_created_idx on public.activities (created_at desc);
create index if not exists activities_lead_idx on public.activities (lead_id);

-- ---------- Meetings ----------
create table if not exists public.meetings (
  id bigint generated always as identity primary key,
  lead_id bigint references public.leads (id) on delete cascade,
  title text not null default '',
  scheduled_at timestamptz not null,
  duration_min int not null default 30,
  mode text not null default 'online',
  location text default '',
  attendees text default '',        -- comma separated emails
  status text not null default 'scheduled',
  notes text default '',
  outcome text default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_when_idx on public.meetings (scheduled_at);

-- ---------- Tags / questions for a teammate ----------
create table if not exists public.mentions (
  id bigint generated always as identity primary key,
  lead_id bigint references public.leads (id) on delete cascade,
  from_user uuid references public.profiles (id) on delete set null,
  to_user uuid references public.profiles (id) on delete cascade,
  message text not null,
  reply text default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Shared settings (single row) ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------- Security: only signed-in team members can read/write ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','leads','activities','meetings','mentions','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "team access" on public.%I', t);
    execute format('create policy "team access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- Live updates (manager sees the caller's work instantly) ----------
do $$
declare t text;
begin
  foreach t in array array['leads','activities','meetings','mentions'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
