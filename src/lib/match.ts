import { GENRES } from './genres'
import type { GenrePrefs, Member, Rating } from './room'
import type { Movie } from './tmdb'

/**
 * Compatibilidade entre duas pessoas (0–100), pela similaridade de cosseno
 * dos vetores de gosto (+1 gosto, -1 não curto, 0 tanto faz).
 * 100 = gostos idênticos, 50 = sem relação, 0 = opostos.
 */
export function pairCompatibility(a: GenrePrefs, b: GenrePrefs): number {
  let dot = 0, na = 0, nb = 0
  for (const g of GENRES) {
    const x = a[g.id] ?? 0
    const y = b[g.id] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (na === 0 || nb === 0) return 50
  const cos = dot / Math.sqrt(na * nb)
  return Math.round(((cos + 1) / 2) * 100)
}

/**
 * Compatibilidade entre duas pessoas considerando também os filmes:
 * se as duas avaliaram pelo menos 2 filmes em comum, 30% da nota vem de
 * quantas vezes concordaram (as duas curtiram ou as duas não curtiram).
 */
export function memberCompatibility(a: Member, b: Member): number {
  const byGenre = pairCompatibility(a.genres, b.genres)
  const am = allRatings(a)
  const bm = allRatings(b)
  const common = Object.keys(am).filter((id) => id in bm)
  if (common.length < 2) return byGenre
  const agree = common.filter((id) => am[id].r === bm[id].r).length / common.length
  return Math.round(0.7 * byGenre + 0.3 * agree * 100)
}

/** Compatibilidade do grupo = média de todos os pares. */
export function groupCompatibility(members: Member[]): number | null {
  if (members.length < 2) return null
  let sum = 0, n = 0
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++) {
      sum += memberCompatibility(members[i], members[j])
      n++
    }
  return Math.round(sum / n)
}

export type GenreScore = { id: number; score: number; vetoed: boolean }

/**
 * Nota de cada gênero para o grupo (0–100). Regra "ninguém fica de fora":
 * se alguém não curte o gênero, ele é vetado e vai para o fim da lista.
 */
export function rankGenres(members: Member[]): GenreScore[] {
  return GENRES.map((g) => {
    const votes = members.map((m) => m.genres[g.id] ?? 0)
    const vetoed = votes.some((v) => v === -1)
    const likes = votes.filter((v) => v === 1).length
    const score = members.length ? Math.round((likes / members.length) * 100) : 0
    return { id: g.id, score, vetoed }
  }).sort((a, b) => Number(a.vetoed) - Number(b.vetoed) || b.score - a.score)
}

/* ------------------------------------------------------------------ */
/* Filmes e séries                                                     */
/* ------------------------------------------------------------------ */

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Todas as avaliações (filmes e séries), com chave "movie:123" / "tv:456". */
function allRatings(member: Member): Record<string, Rating> {
  const out: Record<string, Rating> = {}
  for (const [id, r] of Object.entries(member.movies ?? {})) out[`movie:${id}`] = r
  for (const [id, r] of Object.entries(member.series ?? {})) out[`tv:${id}`] = r
  return out
}

/**
 * Perfil de gosto vindo dos títulos avaliados (filmes E séries juntos — quem
 * ama séries de crime provavelmente curte filmes de crime):
 * para cada gênero, soma ponderada de curtidos − não curtidos, de −1 a 1.
 * Favoritos (escolhidos na busca) pesam o dobro.
 */
function tasteProfile(member: Member): Map<number, number> | null {
  const rated = Object.values(allRatings(member))
  if (rated.length === 0) return null
  const profile = new Map<number, number>()
  let total = 0
  for (const { r, g, fav } of rated) {
    const w = fav ? 2 : 1
    total += w
    for (const id of g) profile.set(id, (profile.get(id) ?? 0) + r * w)
  }
  for (const [id, v] of profile) profile.set(id, v / total)
  return profile
}

/**
 * Afinidade de UMA pessoa com UM título (0–100):
 * - 60%: gêneros do título vs. gêneros que a pessoa marcou (não curto pesa mais);
 * - 40%: gêneros do título vs. o que ela curtiu/não curtiu e seus favoritos;
 * - um empurrãozinho pela nota na TMDB.
 */
export function personMovieScore(member: Member, movie: Movie): number {
  const gs = movie.genreIds
  if (gs.length === 0) return 50

  let genre = 0
  for (const g of gs) {
    const p = member.genres[g]
    if (p === 1) genre += 1
    else if (p === -1) genre -= 1.5
  }
  genre = clamp(genre / Math.min(gs.length, 2), -1, 1)

  const profile = tasteProfile(member)
  let combined = genre
  if (profile) {
    const taste = clamp((gs.reduce((s, g) => s + (profile.get(g) ?? 0), 0) / gs.length) * 2, -1, 1)
    combined = 0.6 * genre + 0.4 * taste
  }

  const quality = (movie.rating - 6.5) * 0.06
  return Math.round(clamp(((combined + quality + 1) / 2) * 100, 0, 100))
}

export type MovieSuggestion = {
  movie: Movie
  score: number // match do grupo
  perPerson: { member: Member; score: number }[]
}

/**
 * Match do grupo com um filme = metade a média, metade a menor nota.
 * Assim um filme que alguém odeia não fica no topo só porque os outros amam.
 */
export function suggestMovies(members: Member[], candidates: Movie[], limit = 12): MovieSuggestion[] {
  const seen = new Set(members.flatMap((m) => Object.keys(allRatings(m))))
  return candidates
    .filter((movie) => !seen.has(`${movie.kind}:${movie.id}`))
    .map((movie) => {
      const perPerson = members.map((member) => ({ member, score: personMovieScore(member, movie) }))
      const scores = perPerson.map((p) => p.score)
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length
      const min = Math.min(...scores)
      return { movie, perPerson, score: Math.round(0.5 * mean + 0.5 * min) }
    })
    .sort((a, b) => b.score - a.score || b.movie.rating - a.movie.rating)
    .slice(0, limit)
}
