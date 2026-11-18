-- Movie Match — adiciona os filmes avaliados no swipe
-- Para quem já rodou o schema.sql: cole isto em Supabase > SQL Editor > Run

alter table public.members
  add column if not exists movies jsonb not null default '{}'::jsonb;  -- { "550": { "r": 1, "g": [18, 53] }, ... }
