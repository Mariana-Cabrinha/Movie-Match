# 🎬 movie-match

Um "blend" de gostos de filmes: cada pessoa do grupo escolhe o que curte, e o app sugere filmes que dão **match** com todo mundo — com um percentual de compatibilidade, tipo o Blend do Spotify/Instagram.

> Projeto pessoal, sem rede social, sem cadastro complicado: alguém cria uma sala, compartilha o link e o grupo entra.

## Como vai funcionar

1. **Criar uma sala** — você gera um link (ex.: `movie-match.app/s/ab12cd`).
2. **Compartilhar** — manda o link para as outras pessoas no WhatsApp, etc.
3. **Cada um escolhe seus gostos** — gêneros favoritos, filmes que amou, filmes que odiou (estilo "swipe" do Tinder).
4. **Blend** — o app cruza os gostos e mostra:
   - a compatibilidade geral do grupo (ex.: *"vocês são 72% compatíveis"*);
   - uma lista de filmes sugeridos, cada um com o % de match para o grupo e para cada pessoa.

## Ideia do cálculo de match (rascunho)

- Cada pessoa vira um **perfil de gosto**: peso por gênero, por década, por diretores/atores, nota média que prefere etc.
- Para cada filme candidato, calcula-se uma **nota de afinidade por pessoa** (0–100%).
- O **match do grupo** combina essas notas de forma a evitar que alguém odeie a escolha
  (ex.: média penalizada pela menor nota — "ninguém fica de fora").
- Filmes que alguém já viu ou marcou como "não" ficam fora.

## Stack sugerida (a decidir)

| Parte | Opção |
|---|---|
| Dados de filmes | [TMDB API](https://developer.themoviedb.org/) (gratuita, tem pôsteres, gêneros, recomendações e onde assistir) |
| Front-end | Web app responsivo (funciona no celular pelo link, sem instalar nada) |
| Salas / respostas do grupo | Banco simples na nuvem (ex.: Supabase ou Firebase) |
| Hospedagem | Vercel / Netlify (grátis) |

## Rodando no seu computador

Precisa do [Node.js](https://nodejs.org/) instalado.

```bash
npm install
npm run dev
```

Abra http://localhost:5173 no navegador.

Sem configurar nada, o app roda em **modo local** (salas salvas só no navegador).

### Ligando as salas na nuvem (Supabase)

1. Crie uma conta grátis em https://supabase.com e um **New project**.
2. No projeto, abra **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
4. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Reinicie o `npm run dev`. O aviso de "modo local" some e as salas passam a funcionar pelo link, atualizando ao vivo.

> A chave *anon* é feita para ficar no navegador; quem protege os dados são as regras (RLS) do `schema.sql`.
> Como o app não tem login, qualquer pessoa com o código da sala pode ver e editar aquela sala.

### Estrutura

```
src/
  lib/genres.ts   # lista de gêneros (IDs da TMDB)
  lib/room.ts     # salas e participantes (Supabase ou modo local)
  lib/useRoom.ts  # carrega a sala e atualiza ao vivo
  lib/match.ts    # cálculo de compatibilidade
  pages/          # Home, Sala, Gostos, Blend
supabase/schema.sql  # tabelas e regras do banco
```

## Roadmap

- [x] Definir stack e criar o esqueleto do app (Vite + React + TypeScript)
- [x] Tela de escolha de gostos por gênero
- [x] Blend por gênero: % do grupo, % por dupla, gêneros em comum
- [ ] Integrar com a TMDB (buscar filmes, pôsteres) + swipe de filmes
- [x] Salas na nuvem (Supabase) para entrar de qualquer aparelho pelo link, ao vivo
- [ ] Algoritmo de compatibilidade e sugestões
- [ ] Tela de resultado ("blend" com % de match)
- [ ] Publicar online
