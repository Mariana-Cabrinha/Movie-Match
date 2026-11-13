-- Movie Match — schema do banco (Supabase / Postgres)
-- Cole tudo isto em: Supabase > SQL Editor > New query > Run

-- Salas
create table if not exists public.rooms (
  id          text primary key check (char_length(id) between 4 and 16),
  created_at  timestamptz not null default now()
);

-- Participantes e seus gostos
create table if not exists public.members (
  id          text primary key check (char_length(id) between 4 and 32),
  room_id     text not null references public.rooms(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 30),
  genres      jsonb not null default '{}'::jsonb,   -- { "35": 1, "27": -1, ... }
  updated_at  timestamptz not null default now()
);

create index if not exists members_room_id_idx on public.members(room_id);

-- Segurança (RLS)
-- Projeto pessoal, sem login: quem tem o código da sala pode ver e editar.
-- O código é aleatório (6 caracteres), então funciona como uma "senha" do link.
alter table public.rooms   enable row level security;
alter table public.members enable row level security;

drop policy if exists "rooms: ler"    on public.rooms;
drop policy if exists "rooms: criar"  on public.rooms;
create policy "rooms: ler"   on public.rooms for select to anon using (true);
create policy "rooms: criar" on public.rooms for insert to anon with check (true);

drop policy if exists "members: ler"     on public.members;
drop policy if exists "members: criar"   on public.members;
drop policy if exists "members: editar"  on public.members;
drop policy if exists "members: remover" on public.members;
create policy "members: ler"     on public.members for select to anon using (true);
create policy "members: criar"   on public.members for insert to anon with check (true);
create policy "members: editar"  on public.members for update to anon using (true) with check (true);
create policy "members: remover" on public.members for delete to anon using (true);

-- Tempo real: avisa o app quando alguém entra/edita/sai da sala
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'members'
  ) then
    alter publication supabase_realtime add table public.members;
  end if;
end $$;
