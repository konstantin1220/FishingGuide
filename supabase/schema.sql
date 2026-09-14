-- FishingGuide: Gruppen, Mitgliedschaft & Leaderboard
-- Einmalig im Supabase SQL-Editor ausführen (Project → SQL Editor → New snippet → einfügen → Run).
--
-- Voraussetzung: unter Authentication → Settings "Allow anonymous sign-ins" aktivieren
-- (per Klick im Dashboard, nicht per SQL steuerbar).
--
-- Persönliche Angel-Daten (Gewässer/Fanglog/Köder/Trips) bleiben bewusst
-- ausschließlich lokal im Browser - hier landen nur Gruppenzugehörigkeit,
-- Anzeigename und aggregierte Fang-Statistik fürs Leaderboard.
--
-- Reihenfolge wichtig: erst ALLE Tabellen anlegen, dann RLS/Policies -
-- Policies können auf andere Tabellen verweisen (z.B. groups -> group_members),
-- die müssen beim Anlegen der Policy schon existieren.

create extension if not exists pgcrypto;

-- ---------- Tabellen ----------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  updated_at timestamptz default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- user_id verweist bewusst auf profiles(id) statt direkt auf auth.users(id):
-- PostgREST kann verschachtelte Selects (z.B. group_members -> profiles)
-- nur automatisch auflösen, wenn zwischen den beiden abgefragten Tabellen
-- selbst ein Fremdschlüssel besteht. Ohne das schlägt das Frontend beim
-- Laden von Mitgliederliste/Leaderboard fehl ("Could not find a
-- relationship between 'group_members' and 'profiles'").
create table if not exists group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

create table if not exists group_stats (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  total_faenge int default 0,
  biggest_fish_art text,
  biggest_fish_laenge numeric,
  updated_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- Migration für bereits bestehende Installationen (Fremdschlüssel nachträglich
-- von auth.users auf profiles umgehängt, siehe Kommentar oben bei group_members):
alter table group_members drop constraint if exists group_members_user_id_fkey;
alter table group_members add constraint group_members_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table group_stats drop constraint if exists group_stats_user_id_fkey;
alter table group_stats add constraint group_stats_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

-- ---------- Row-Level-Security ----------

alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_stats enable row level security;

drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles for select using (true);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- SECURITY DEFINER-Hilfsfunktion: prüft Mitgliedschaft, ohne dabei selbst der
-- RLS-Policy von group_members zu unterliegen (deren Funktionsbesitzer
-- umgeht RLS als Tabellen-Owner). Direkte Subqueries auf group_members
-- innerhalb einer Policy AUF group_members würden sonst eine Endlosschleife
-- auslösen ("infinite recursion detected in policy for relation
-- group_members") - genau dieser Fehler trat live auf und wird hiermit behoben.
create or replace function is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

drop policy if exists "groups_select_members" on groups;
create policy "groups_select_members" on groups for select using (
  is_group_member(groups.id)
);

drop policy if exists "group_members_select_same_group" on group_members;
create policy "group_members_select_same_group" on group_members for select using (
  is_group_member(group_members.group_id)
);

drop policy if exists "group_stats_select_same_group" on group_stats;
create policy "group_stats_select_same_group" on group_stats for select using (
  is_group_member(group_stats.group_id)
);

-- ---------- RPCs (SECURITY DEFINER, damit Invite-Code-Lookup nicht per
-- öffentlicher SELECT-Policy auf groups möglich sein muss) ----------

create or replace function create_group(p_name text, p_display_name text)
returns groups
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_group groups;
  v_code text;
begin
  -- profiles-Zeile muss vor group_members existieren (Fremdschlüssel)
  insert into profiles (id, display_name) values (auth.uid(), p_display_name)
    on conflict (id) do update set display_name = excluded.display_name, updated_at = now();

  v_code := encode(gen_random_bytes(6), 'base64');
  v_code := replace(replace(replace(v_code, '/', '_'), '+', '-'), '=', '');

  insert into groups (name, invite_code, created_by)
  values (p_name, v_code, auth.uid())
  returning * into v_group;

  insert into group_members (group_id, user_id) values (v_group.id, auth.uid());

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

  -- profiles-Zeile muss vor group_members existieren (Fremdschlüssel)
  insert into profiles (id, display_name) values (auth.uid(), p_display_name)
    on conflict (id) do update set display_name = excluded.display_name, updated_at = now();

  insert into group_members (group_id, user_id) values (v_group.id, auth.uid())
    on conflict do nothing;

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

-- ============================================================
-- Gruppen-Chat: Nachrichten, Bilder, Reaktionen
-- ============================================================

create table if not exists group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  body text,
  image_path text,
  created_at timestamptz default now()
);

create table if not exists message_reactions (
  message_id uuid references group_messages(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  primary key (message_id, user_id, emoji)
);

alter table group_messages enable row level security;
alter table message_reactions enable row level security;

-- REPLICA IDENTITY FULL: bei DELETE liefert Postgres per Voreinstellung nur
-- den Primärschlüssel der gelöschten Zeile an Realtime. Die SELECT-Policy
-- unten braucht aber group_id, um zu prüfen, ob ein anderes Gruppenmitglied
-- das Löschen live mitbekommen darf - ohne FULL bliebe die Nachricht bei
-- anderen Mitgliedern bis zum nächsten Neuladen sichtbar.
alter table group_messages replica identity full;

drop policy if exists "group_messages_select" on group_messages;
create policy "group_messages_select" on group_messages for select using (
  is_group_member(group_id)
);

drop policy if exists "group_messages_insert" on group_messages;
create policy "group_messages_insert" on group_messages for insert with check (
  is_group_member(group_id) and user_id = auth.uid()
);

drop policy if exists "group_messages_delete_own" on group_messages;
create policy "group_messages_delete_own" on group_messages for delete using (
  user_id = auth.uid()
);

drop policy if exists "message_reactions_select" on message_reactions;
create policy "message_reactions_select" on message_reactions for select using (
  exists (select 1 from group_messages gm where gm.id = message_reactions.message_id and is_group_member(gm.group_id))
);

drop policy if exists "message_reactions_insert_own" on message_reactions;
create policy "message_reactions_insert_own" on message_reactions for insert with check (
  user_id = auth.uid()
  and exists (select 1 from group_messages gm where gm.id = message_reactions.message_id and is_group_member(gm.group_id))
);

drop policy if exists "message_reactions_delete_own" on message_reactions;
create policy "message_reactions_delete_own" on message_reactions for delete using (
  user_id = auth.uid()
);

-- Realtime aktivieren (entspricht dem Dashboard-Schalter unter Database →
-- Replication) - respektiert automatisch die obigen RLS-Policies, kein
-- Nutzer sieht per Realtime mehr als per normalem SELECT.
do $$ begin
  alter publication supabase_realtime add table group_messages;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table message_reactions;
exception when duplicate_object then null; end $$;

-- Privater Storage-Bucket für Chat-Bilder. Pfad-Konvention: <groupId>/<datei>
-- - storage.foldername(name)[1] liest die Gruppen-ID direkt aus dem Pfad,
-- gleiches Muster wie bei den Tabellen-Policies oben.
insert into storage.buckets (id, name, public)
values ('group-chat', 'group-chat', false)
on conflict (id) do nothing;

drop policy if exists "chat_images_select" on storage.objects;
create policy "chat_images_select" on storage.objects for select using (
  bucket_id = 'group-chat' and is_group_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "chat_images_insert" on storage.objects;
create policy "chat_images_insert" on storage.objects for insert with check (
  bucket_id = 'group-chat' and is_group_member((storage.foldername(name))[1]::uuid)
);
