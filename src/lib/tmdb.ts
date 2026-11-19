// Cliente mínimo da TMDB (https://developer.themoviedb.org/), para filmes e séries.
// Usa o "Token de Leitura da API" (somente leitura) do .env: VITE_TMDB_TOKEN.
// Obs.: como o app roda no navegador, esse token fica visível para quem usar o
// site. Ele só permite LER dados públicos, então o risco é baixo.

import { ANIME, DORAMA } from './genres'

const TOKEN = import.meta.env.VITE_TMDB_TOKEN as string | undefined
const BASE = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p'

export const hasTmdb = Boolean(TOKEN)

export type Kind = 'movie' | 'tv'

/** Um título: filme ou série (o nome do tipo ficou "Movie" por simplicidade). */
export type Movie = {
  kind: Kind
  id: number
  title: string
  overview: string
  posterPath: string | null // caminho cru da TMDB (guardado nos favoritos)
  poster: string | null // pôster pequeno (listas)
  posterLarge: string | null // pôster grande (carta do swipe)
  backdrop: string | null // imagem horizontal (destaque)
  year: string
  /** Gêneros já "traduzidos" para a lista única do app (inclui Anime/Dorama). */
  genreIds: number[]
  rating: number // nota média na TMDB (0–10)
}

type Raw = {
  id: number
  media_type?: string
  title?: string
  name?: string
  overview: string
  poster_path: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
  original_language?: string
  vote_average: number
}

/* ------------------------------------------------------------------ */
/* Gêneros: as séries usam IDs um pouco diferentes dos filmes na TMDB  */
/* ------------------------------------------------------------------ */

// Série → equivalentes de filme (a lista de gêneros do app é a dos filmes)
const TV_TO_MOVIE: Record<number, number[]> = {
  10759: [28, 12], // Ação & Aventura
  10765: [878, 14], // Ficção científica & Fantasia
  10768: [10752], // Guerra & Política
}
// Filme → gênero de série, para buscar séries pelos gêneros que a pessoa marcou
const MOVIE_TO_TV: Record<number, number> = { 28: 10759, 12: 10759, 878: 10765, 14: 10765, 10752: 10768 }
const TV_HAS_SAME = new Set([16, 35, 80, 99, 18, 10751, 9648, 37])

const DORAMA_LANGS = ['ko', 'zh', 'th', 'ja']

function normalizeGenres(raw: Raw, kind: Kind): number[] {
  const ids = new Set<number>()
  for (const g of raw.genre_ids ?? []) for (const m of kind === 'tv' ? (TV_TO_MOVIE[g] ?? [g]) : [g]) ids.add(m)
  const lang = raw.original_language ?? ''
  if (ids.has(16) && lang === 'ja') ids.add(ANIME)
  const raws = raw.genre_ids ?? []
  const isShow = raws.some((g) => g === 10764 || g === 10767 || g === 10763) // reality, talk, jornal
  if (kind === 'tv' && !ids.has(16) && !isShow && DORAMA_LANGS.includes(lang)) ids.add(DORAMA)
  return [...ids]
}

/** Converte gêneros do app para IDs de série da TMDB (os que existem lá). */
function toTvGenres(ids: number[]): number[] {
  const out = new Set<number>()
  for (const id of ids) {
    if (MOVIE_TO_TV[id]) out.add(MOVIE_TO_TV[id])
    else if (TV_HAS_SAME.has(id)) out.add(id)
  }
  return [...out]
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

const cache = new Map<string, Promise<unknown>>()

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  if (!TOKEN) throw new Error('Token da TMDB não configurado (VITE_TMDB_TOKEN no .env).')
  const qs = new URLSearchParams({ language: 'pt-BR', region: 'BR', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  const url = `${BASE}${path}?${qs}`
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' } }).then(async (r) => {
        if (!r.ok) {
          cache.delete(url)
          throw new Error(r.status === 401 ? 'Token da TMDB inválido.' : `Erro na TMDB (${r.status}).`)
        }
        return r.json()
      }),
    )
  }
  return cache.get(url) as Promise<T>
}

export function posterUrl(path: string | null, size: 'w185' | 'w342' | 'w500' = 'w342'): string | null {
  return path ? `${IMG}/${size}${path}` : null
}

function toMovie(m: Raw, kind: Kind): Movie {
  return {
    kind,
    id: m.id,
    title: m.title ?? m.name ?? '',
    overview: m.overview,
    posterPath: m.poster_path,
    poster: posterUrl(m.poster_path),
    posterLarge: posterUrl(m.poster_path, 'w500'),
    backdrop: m.backdrop_path ? `${IMG}/w780${m.backdrop_path}` : null,
    year: (m.release_date ?? m.first_air_date ?? '').slice(0, 4),
    genreIds: normalizeGenres(m, kind),
    rating: m.vote_average,
  }
}

type Page = { results: Raw[] }

const usable = (m: Raw) => Boolean(m.poster_path && m.overview)

/* ------------------------------------------------------------------ */
/* Buscas                                                              */
/* ------------------------------------------------------------------ */

/**
 * Títulos populares e bem avaliados. `withGenres` usa a lista do app (OU);
 * Anime e Dorama viram filtros de idioma/animação.
 */
export async function discover(
  kind: Kind,
  opts: {
    withGenres?: number[]
    withoutGenres?: number[]
    page?: number
    /** popular (padrão) ou "top": os mais bem avaliados de todos os tempos */
    sort?: 'popular' | 'top'
  },
): Promise<Movie[]> {
  const top = opts.sort === 'top'
  const base: Record<string, string | number> = {
    sort_by: top ? 'vote_average.desc' : 'popularity.desc',
    'vote_count.gte': top ? (kind === 'movie' ? 3000 : 800) : kind === 'movie' ? 300 : 150,
    include_adult: 'false',
    page: opts.page ?? 1,
  }
  const wanted = opts.withGenres ?? []
  const normal = wanted.filter((g) => g !== ANIME && g !== DORAMA)
  const genres = kind === 'tv' ? toTvGenres(normal) : normal
  const without = kind === 'tv' ? toTvGenres(opts.withoutGenres ?? []) : (opts.withoutGenres ?? []).filter((g) => g < 90000)

  const queries: Record<string, string | number>[] = []
  if (!wanted.length || genres.length) {
    const q = { ...base }
    if (genres.length) q.with_genres = genres.join('|')
    if (without.length) q.without_genres = without.join(',')
    queries.push(q)
  }
  if (wanted.includes(ANIME)) queries.push({ ...base, with_genres: 16, with_original_language: 'ja' })
  if (wanted.includes(DORAMA) && kind === 'tv')
    // sem animação, reality (10764), talk show (10767) e jornalismo (10763)
    queries.push({ ...base, with_original_language: 'ko|zh|th', without_genres: '16,10764,10767,10763', 'vote_count.gte': 50 })

  const pages = await Promise.all(queries.map((q) => get<Page>(`/discover/${kind}`, q)))
  return uniqueMovies(pages.map((p) => p.results.filter(usable).map((m) => toMovie(m, kind))))
}

/** Títulos parecidos com um título. */
export async function recommendations(kind: Kind, id: number): Promise<Movie[]> {
  const data = await get<Page>(`/${kind}/${id}/recommendations`)
  return data.results.filter((m) => m.poster_path).map((m) => toMovie(m, kind))
}

/** Busca por nome (filmes e séries juntos). */
export async function searchTitles(query: string): Promise<Movie[]> {
  if (query.trim().length < 2) return []
  const data = await get<Page>('/search/multi', { query: query.trim(), include_adult: 'false' })
  return data.results
    .filter((m) => (m.media_type === 'movie' || m.media_type === 'tv') && m.poster_path)
    .map((m) => toMovie(m, m.media_type as Kind))
}

/** Detalhes de um título pelo ID (usado para mostrar avaliações antigas sem nome salvo). */
export async function details(kind: Kind, id: number | string): Promise<Movie> {
  const raw = await get<Raw & { genres?: { id: number }[] }>(`/${kind}/${id}`)
  return toMovie({ ...raw, genre_ids: raw.genre_ids ?? raw.genres?.map((g) => g.id) }, kind)
}

/** Em alta na semana (vitrine da tela inicial). */
export async function trending(kind: Kind = 'movie'): Promise<Movie[]> {
  const data = await get<Page>(`/trending/${kind}/week`)
  return data.results.filter((m) => m.poster_path).map((m) => toMovie(m, kind))
}

/** Junta listas sem repetir títulos. */
export function uniqueMovies(lists: Movie[][]): Movie[] {
  const seen = new Map<string, Movie>()
  for (const list of lists) for (const m of list) if (!seen.has(`${m.kind}:${m.id}`)) seen.set(`${m.kind}:${m.id}`, m)
  return [...seen.values()]
}

export function watchUrl(m: Pick<Movie, 'kind' | 'id'>): string {
  return `https://www.themoviedb.org/${m.kind}/${m.id}/watch?locale=BR`
}
