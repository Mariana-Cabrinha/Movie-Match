-- Movie Match — adiciona as séries avaliadas (inclui animes e doramas)
-- Cole isto em Supabase > SQL Editor > Run

alter table public.members
  add column if not exists series jsonb not null default '{}'::jsonb;  -- mesmo formato da coluna movies
