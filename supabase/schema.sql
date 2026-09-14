-- FishingGuide: Gruppen, Mitgliedschaft & Leaderboard
-- Einmalig im Supabase SQL-Editor ausführen (Project → SQL Editor → New query → einfügen → Run).
--
-- Voraussetzung: unter Authentication → Settings "Allow anonymous sign-ins" aktivieren
-- (per Klick im Dashboard, nicht per SQL steuerbar).
--
-- Persönliche Angel-Daten (Gewässer/Fanglog/Köder/Trips) bleiben bewusst
-- ausschließlich lokal im Browser - hier landen nur Gruppenzugehörigkeit,
-- Anzeigename und aggregierte Fang-Statistik fürs Leaderboard.

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles for select using (true);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- ---------- groups ----------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table groups enable row level security;

drop policy if exists "groups_select_members" on groups;
create policy "groups_select_members" on groups for select using (
  exists (select 1 from group_members m where m.group_id = groups.id and m.user_id = auth.uid())
);

-- ---------- group_members ----------
create table if not exists group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table group_members enable row level security;

drop policy if exists "group_members_select_same_group" on group_members;
create policy "group_members_select_same_group" on group_members for select using (
  exists (select 1 from group_members m2 where m2.group_id = group_members.group_id and m2.user_id = auth.uid())
);

-- ---------- group_stats (Leaderboard) ----------
create table if not exists group_stats (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  total_faenge int default 0,
  biggest_fish_art text,
  biggest_fish_laenge numeric,
  updated_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table group_stats enable row level security;

drop policy if exists "group_stats_select_same_group" on group_stats;
create policy "group_stats_select_same_group" on group_stats for select using (
  exists (select 1 from group_members m where m.group_id = group_stats.group_id and m.user_id = auth.uid())
);

-- ---------- RPCs (SECURITY DEFINER, damit Invite-Code-Lookup nicht per
-- öffentlicher SELECT-Policy auf groups möglich sein muss) ----------

create or replace function create_group(p_name text, p_display_name text)
returns groups
language plpgsql security definer set search_path = public
as $$
declare
  v_group groups;
  v_code text;
begin
  v_code := encode(gen_random_bytes(6), 'base64');
  v_code := replace(replace(replace(v_code, '/', '_'), '+', '-'), '=', '');

  insert into groups (name, invite_code, created_by)
  values (p_name, v_code, auth.uid())
  returning * into v_group;

  insert into group_members (group_id, user_id) values (v_group.id, auth.uid());

  insert into profiles (id, display_name) values (auth.uid(), p_display_name)
    on conflict (id) do update set display_name = excluded.display_name, updated_at = now();

  return v_group;
end;
$$;

create or replace function join_group(p_code text, p_display_name text)
returns groups
language plpgsql security definer set search_path = public
as $$
declare
  v_group groups;
begin
  select * into v_group from groups where invite_code = p_code;
  if not found then
    raise exception 'invalid_code';
  end if;

  insert into group_members (group_id, user_id) values (v_group.id, auth.uid())
    on conflict do nothing;

  insert into profiles (id, display_name) values (auth.uid(), p_display_name)
    on conflict (id) do update set display_name = excluded.display_name, updated_at = now();

  return v_group;
end;
$$;

create or replace function sync_stats(p_group_id uuid, p_total int, p_art text, p_laenge numeric)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'not_a_member';
  end if;

  insert into group_stats (group_id, user_id, total_faenge, biggest_fish_art, biggest_fish_laenge, updated_at)
  values (p_group_id, auth.uid(), p_total, p_art, p_laenge, now())
  on conflict (group_id, user_id) do update set
    total_faenge = excluded.total_faenge,
    biggest_fish_art = excluded.biggest_fish_art,
    biggest_fish_laenge = excluded.biggest_fish_laenge,
    updated_at = now();
end;
$$;
