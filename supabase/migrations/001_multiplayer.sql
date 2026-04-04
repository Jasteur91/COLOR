-- À exécuter dans Supabase → SQL Editor (une fois).
-- Active Realtime : Database → Replication → activer game_rooms, game_room_players, game_room_results

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_session_id text not null,
  variant text not null check (variant in ('color', 'sound')),
  rounds smallint not null check (rounds in (5, 10)),
  difficulty text not null default 'hard' check (difficulty in ('easy', 'hard')),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.game_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  session_id text not null,
  name text not null,
  joined_at timestamptz not null default now(),
  unique (room_id, session_id)
);

create index if not exists idx_game_room_players_room on public.game_room_players (room_id);

create table if not exists public.game_room_results (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  session_id text not null,
  player_name text not null,
  total numeric not null,
  round_scores jsonb not null default '[]'::jsonb,
  finished_at timestamptz not null default now(),
  unique (room_id, session_id)
);

create index if not exists idx_game_room_results_room on public.game_room_results (room_id);

alter table public.game_rooms enable row level security;
alter table public.game_room_players enable row level security;
alter table public.game_room_results enable row level security;

-- MVP : accès public lecture/écriture avec la clé anon (à durcir en prod : auth ou edge functions)
create policy "game_rooms_select" on public.game_rooms for select using (true);
create policy "game_rooms_insert" on public.game_rooms for insert with check (true);
create policy "game_rooms_update" on public.game_rooms for update using (true);

create policy "game_room_players_select" on public.game_room_players for select using (true);
create policy "game_room_players_insert" on public.game_room_players for insert with check (true);
create policy "game_room_players_update" on public.game_room_players for update using (true);
create policy "game_room_players_delete" on public.game_room_players for delete using (true);

create policy "game_room_results_select" on public.game_room_results for select using (true);
create policy "game_room_results_insert" on public.game_room_results for insert with check (true);
create policy "game_room_results_update" on public.game_room_results for update using (true);

alter publication supabase_realtime add table public.game_rooms;
alter publication supabase_realtime add table public.game_room_players;
alter publication supabase_realtime add table public.game_room_results;
