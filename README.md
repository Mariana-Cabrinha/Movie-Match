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

### Estrutura

```
src/
  lib/genres.ts   # lista de gêneros (IDs da TMDB)
  lib/room.ts     # salas e participantes (hoje: salvo no navegador)
  lib/match.ts    # cálculo de compatibilidade
  pages/          # Home, Sala, Gostos, Blend
```

## Roadmap

- [x] Definir stack e criar o esqueleto do app (Vite + React + TypeScript)
- [x] Tela de escolha de gostos por gênero
- [x] Blend por gênero: % do grupo, % por dupla, gêneros em comum
- [ ] Integrar com a TMDB (buscar filmes, pôsteres) + swipe de filmes
- [ ] Salas na nuvem (Supabase) para entrar de qualquer aparelho pelo link
- [ ] Algoritmo de compatibilidade e sugestões
- [ ] Tela de resultado ("blend" com % de match)
- [ ] Publicar online
