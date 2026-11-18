import { useEffect, useState } from 'react'
import { ratingsOf, type Member } from '../lib/room'
import { rankGenres, suggestMovies, type MovieSuggestion } from '../lib/match'
import { discover, recommendations, uniqueMovies, watchUrl, type Kind } from '../lib/tmdb'
import { genreById } from '../lib/genres'
import { Avatar, memberColor } from './Avatar'

/** Busca candidatos na TMDB e ordena pelo match do grupo. */
async function loadSuggestions(members: Member[], kind: Kind): Promise<MovieSuggestion[]> {
  const ranked = rankGenres(members)
  const top = ranked.filter((g) => !g.vetoed && g.score > 0).slice(0, 4).map((g) => g.id)
  const vetoed = ranked.filter((g) => g.vetoed).map((g) => g.id)

  // Títulos que mais gente curtiu (favoritos contam dobrado) → buscar parecidos
  const likes = new Map<number, number>()
  for (const m of members)
    for (const [id, { r, fav }] of Object.entries(ratingsOf(m, kind)))
      if (r === 1) likes.set(Number(id), (likes.get(Number(id)) ?? 0) + (fav ? 2 : 1))
  const seeds = [...likes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id)

  const lists = await Promise.all([
    ...[1, 2, 3].map((page) => discover(kind, { withGenres: top, withoutGenres: vetoed, page })),
    ...seeds.map((id) => recommendations(kind, id).catch(() => [])),
  ])
  // Tira títulos de gêneros vetados que vieram pelas recomendações
  const candidates = uniqueMovies(lists).filter((m) => !m.genreIds.some((g) => vetoed.includes(g)))
  return suggestMovies(members, candidates)
}

export default function MovieSuggestions({ members, kind }: { members: Member[]; kind: Kind }) {
  const [list, setList] = useState<MovieSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  // Recalcula quando alguém muda os gostos (a sala atualiza ao vivo) ou troca a aba
  const signature = JSON.stringify([kind, members.map((m) => [m.id, m.genres, m.movies, m.series])])

  useEffect(() => {
    let alive = true
    setList(null)
    setError(null)
    loadSuggestions(members, kind)
      .then((l) => alive && setList(l))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  if (error) return <p className="error">{error}</p>
  if (!list)
    return (
      <div className="stack" aria-label="Procurando filmes">
        <div className="featured skeleton" style={{ height: 260 }} />
        <div className="suggestion skeleton" style={{ height: 96 }} />
        <div className="suggestion skeleton" style={{ height: 96 }} />
      </div>
    )
  if (list.length === 0)
    return (
      <p className="muted">
        Não achei {kind === 'movie' ? 'filmes' : 'séries'} que agradem todo mundo. Tentem marcar mais gêneros!
      </p>
    )

  const [best, ...rest] = list

  return (
    <>
      <article className="featured">
        <div className="featured-art" style={best.movie.backdrop ? { backgroundImage: `url(${best.movie.backdrop})` } : undefined}>
          <span className="featured-label">🏆 O match do grupo</span>
          <span className="match-badge big-badge">{best.score}%</span>
        </div>
        <div className="featured-body">
          {best.movie.poster && <img src={best.movie.poster} alt="" className="featured-poster" />}
          <div className="grow">
            <h4>{best.movie.title} <span className="muted small">{best.movie.year}</span></h4>
            <p className="small muted">
              ⭐ {best.movie.rating.toFixed(1)} · {best.movie.genreIds.map((g) => genreById.get(g)?.name).filter(Boolean).slice(0, 3).join(' · ')}
            </p>
            <PersonScores perPerson={best.perPerson} />
          </div>
        </div>
        <p className="small featured-overview">{best.movie.overview}</p>
        <a className="btn small" href={watchUrl(best.movie)} target="_blank" rel="noreferrer">
          Onde assistir →
        </a>
      </article>

      <h4 className="muted">Outras boas opções</h4>
      <ul className="suggestions">
      {rest.map(({ movie, score, perPerson }, i) => (
        <li key={movie.id} className="suggestion">
          <button type="button" className="suggestion-main" onClick={() => setOpen(open === movie.id ? null : movie.id)} aria-expanded={open === movie.id}>
            {movie.poster ? <img src={movie.poster} alt="" loading="lazy" /> : <div className="poster-empty">🎬</div>}
            <div className="grow">
              <p className="small muted">#{i + 2}</p>
              <h4>{movie.title} <span className="muted small">{movie.year}</span></h4>
              <p className="small muted">
                {movie.genreIds.map((g) => genreById.get(g)?.name).filter(Boolean).slice(0, 3).join(' · ')} · ⭐ {movie.rating.toFixed(1)}
              </p>
            </div>
            <span className="match-badge">{score}%</span>
          </button>
          {open === movie.id && (
            <div className="suggestion-detail">
              <p className="small">{movie.overview}</p>
              <PersonScores perPerson={perPerson} />
              <a className="small" href={watchUrl(movie)} target="_blank" rel="noreferrer">
                Onde assistir →
              </a>
            </div>
          )}
        </li>
      ))}
      </ul>
    </>
  )
}

/** % de cada pessoa com o filme, com a cor de cada uma. */
function PersonScores({ perPerson }: { perPerson: MovieSuggestion['perPerson'] }) {
  return (
    <ul className="per-person">
      {perPerson.map(({ member, score }) => (
        <li key={member.id}>
          <Avatar member={member} size={22} />
          <span className="person-name small">{member.name}</span>
          <div className="bar">
            <div style={{ width: `${score}%`, background: memberColor(member) }} />
          </div>
          <span className="small">{score}%</span>
        </li>
      ))}
    </ul>
  )
}
