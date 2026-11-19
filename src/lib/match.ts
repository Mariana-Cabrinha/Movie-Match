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
  // só títulos que as duas VIRAM ("não vi" não conta como concordância)
  const common = Object.keys(am).filter((id) => id in bm && am[id].r !== 0 && bm[id].r !== 0)
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
export function allRatings(member: Member): Record<string, Rating> {
  const out: Record<string, Rating> = {}
  for (const [id, r] of Object.entries(member.movies ?? {})) out[`movie:${id}`] = r
  for (const [id, r] of Object.entries(member.series ?? {})) out[`tv:${id}`] = r
  return out
}

// Pesos dos sinais de gosto
const W_FAV = 2 // escolhido na busca ("amo" / "não curto")
const W_SWIPE = 1 // curti / não curti no swipe
const W_NOT_SEEN = 0.5 // "não vi": sinal fraco…
const NOT_SEEN_VALUE = -0.35 // …de desinteresse ("se não vi, não me interessei tanto")
const W_GENRE_PREF = 2 // gênero marcado na etapa 1 conta como evidência

type Profile = {
  /** gosto por gênero, de −1 (detesta) a 1 (ama) */
  taste: Map<number, number>
  /** quanta informação temos sobre cada gênero (para a confiança) */
  evidence: Map<number, number>
}

/**
 * Perfil de gosto da pessoa: junta filmes E séries (quem ama séries de crime
 * provavelmente curte filmes de crime). Também mede QUANTO sabemos sobre cada
 * gênero — é isso que evita dar 98% para algo que nunca foi perguntado.
 */
function profileOf(member: Member): Profile {
  const sum = new Map<number, number>()
  const weight = new Map<number, number>()
  const evidence = new Map<number, number>()
  const add = (map: Map<number, number>, k: number, v: number) => map.set(k, (map.get(k) ?? 0) + v)

  for (const { r, g, fav } of Object.values(allRatings(member))) {
    const w = r === 0 ? W_NOT_SEEN : fav ? W_FAV : W_SWIPE
    const value = r === 0 ? NOT_SEEN_VALUE : r
    for (const id of g) {
      add(sum, id, value * w)
      add(weight, id, w)
      add(evidence, id, w)
    }
  }
  for (const [id, v] of Object.entries(member.genres)) if (v) add(evidence, Number(id), W_GENRE_PREF)

  const taste = new Map<number, number>()
  for (const [id, s] of sum) taste.set(id, s / (weight.get(id) ?? 1))
  return { taste, evidence }
}

const profileCache = new WeakMap<Member, Profile>()
function cachedProfile(member: Member): Profile {
  let p = profileCache.get(member)
  if (!p) profileCache.set(member, (p = profileOf(member)))
  return p
}

/**
 * "Vizinhos" de uma pessoa: títulos que a TMDB recomenda a partir do que ela
 * curtiu (bom sinal) e do que ela NÃO curtiu (sinal de alerta). Assim, quem
 * marcou ✕ em Crepúsculo vê coisas parecidas com Crepúsculo caírem no ranking.
 */
export type Neighbors = { liked: Set<string>; disliked: Set<string> }

export type PersonScore = {
  score: number // 0–100
  /** 0–1: quanto o app sabe sobre o gosto da pessoa para este título */
  confidence: number
}

/**
 * Afinidade de UMA pessoa com UM título:
 * 1. gêneros do título vs. gêneros que ela marcou (não curto pesa mais);
 * 2. gêneros do título vs. o que ela curtiu/não curtiu/não viu (perfil);
 * 3. se o título é "vizinho" de algo que ela curtiu ou não curtiu;
 * 4. tudo isso é encolhido em direção a 50% quando há pouca informação
 *    (confiança baixa = palpite), e a nota da TMDB dá um empurrãozinho.
 */
export function personMovieScore(member: Member, movie: Movie, neighbors?: Neighbors): PersonScore {
  const gs = movie.genreIds
  const { taste, evidence } = cachedProfile(member)
  const key = `${movie.kind}:${movie.id}`

  // 1. gêneros marcados
  let genre = 0
  let marked = 0
  for (const g of gs) {
    const p = member.genres[g]
    if (p === 1) (genre += 1), marked++
    else if (p === -1) (genre -= 1.5), marked++
  }
  genre = marked ? clamp(genre / Math.min(gs.length, 2), -1, 1) : 0

  // 2. perfil pelos títulos avaliados
  const known = gs.filter((g) => taste.has(g))
  const fromTitles = known.length ? clamp((known.reduce((s, g) => s + taste.get(g)!, 0) / known.length) * 1.5, -1, 1) : 0

  let combined = 0.55 * genre + 0.45 * fromTitles

  // 3. vizinhos (sinal forte e específico — vale mais que gênero)
  if (neighbors?.disliked.has(key)) combined -= 0.7
  if (neighbors?.liked.has(key)) combined += 0.35
  // já marcou "não vi" neste título: leve desinteresse
  if (allRatings(member)[key]?.r === 0) combined -= 0.25

  // 4. confiança: média da evidência sobre os gêneros do título
  const ev = gs.length ? gs.reduce((s, g) => s + Math.min(evidence.get(g) ?? 0, 4), 0) / gs.length : 0
  const neighborBoost = neighbors && (neighbors.liked.has(key) || neighbors.disliked.has(key)) ? 0.3 : 0
  const confidence = clamp(0.2 + ev / 4 + neighborBoost, 0.2, 1)

  const quality = clamp((movie.rating - 6.8) * 0.05, -0.15, 0.1)
  const value = clamp(combined, -1, 1) * confidence + quality
  return { score: Math.round(clamp(50 + value * 45, 3, 97)), confidence }
}

export type MovieSuggestion = {
  movie: Movie
  score: number // match do grupo
  /** true quando o app sabe pouco sobre o gosto de alguém para este título */
  guess: boolean
  perPerson: { member: Member; score: number; confidence: number }[]
}

/**
 * Match do grupo com um título = metade a média, metade a menor nota.
 * Assim um título que alguém detesta não fica no topo só porque os outros amam.
 * Títulos que alguém já viu (curtiu/não curtiu) ficam de fora; "não vi", não.
 */
export function suggestMovies(
  members: Member[],
  candidates: Movie[],
  limit = 12,
  neighbors?: Map<string, Neighbors>,
): MovieSuggestion[] {
  const seen = new Set(members.flatMap((m) => Object.entries(allRatings(m)).filter(([, r]) => r.r !== 0).map(([k]) => k)))
  return candidates
    .filter((movie) => !seen.has(`${movie.kind}:${movie.id}`))
    .map((movie) => {
      const perPerson = members.map((member) => ({ member, ...personMovieScore(member, movie, neighbors?.get(member.id)) }))
      const scores = perPerson.map((p) => p.score)
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length
      const min = Math.min(...scores)
      const guess = perPerson.some((p) => p.confidence < 0.5)
      return { movie, perPerson, guess, score: Math.round(0.5 * mean + 0.5 * min) }
    })
    .sort((a, b) => b.score - a.score || b.movie.rating - a.movie.rating)
    .slice(0, limit)
}
