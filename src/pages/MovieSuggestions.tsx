import { useEffect, useState } from 'react'
import { ratingsOf, type Member } from '../lib/room'
import { rankGenres, suggestMovies, type MovieSuggestion, type Neighbors } from '../lib/match'
import { discover, recommendations, uniqueMovies, watchUrl, type Kind, type Movie } from '../lib/tmdb'
import { genreById } from '../lib/genres'
import { Avatar, memberColor } from './Avatar'

const NEIGHBOR_SEEDS = 3 // por pessoa, de cada lado (curtidos e não curtidos)

/** Ordena as avaliações de um lado: escolhidos na busca primeiro. */
function seedsOf(member: Member, kind: Kind, r: 1 | -1): number[] {
  return Object.entries(ratingsOf(member, kind))
    .filter(([, x]) => x.r === r)
    .sort(([, a], [, b]) => Number(Boolean(b.fav)) - Number(Boolean(a.fav)))
    .slice(0, NEIGHBOR_SEEDS)
    .map(([id]) => Number(id))
}

/** Busca candidatos na TMDB e ordena pelo match do grupo. */
async function loadSuggestions(members: Member[], kind: Kind): Promise<MovieSuggestion[]> {
  const ranked = rankGenres(members)
  const top = ranked.filter((g) => !g.vetoed && g.score > 0).slice(0, 4).map((g) => g.id)
  const vetoed = ranked.filter((g) => g.vetoed).map((g) => g.id)
  const recs = (id: number) => recommendations(kind, id).catch(() => [] as Movie[])

  // "Vizinhos" de cada pessoa: parecidos com o que ela curtiu e com o que NÃO curtiu
  const neighbors = new Map<string, Neighbors>()
  const likedLists: Movie[][] = []
  await Promise.all(
    members.map(async (m) => {
      const [liked, disliked] = await Promise.all([
        Promise.all(seedsOf(m, kind, 1).map(recs)),
        Promise.all(seedsOf(m, kind, -1).map(recs)),
      ])
      likedLists.push(...liked)
      const keys = (lists: Movie[][]) => new Set(lists.flat().map((x) => `${x.kind}:${x.id}`))
      neighbors.set(m.id, { liked: keys(liked), disliked: keys(disliked) })
    }),
  )

  const lists = await Promise.all([1, 2, 3].map((page) => discover(kind, { withGenres: top, withoutGenres: vetoed, page })))
  // Candidatos: populares dos gêneros em comum + parecidos com o que alguém curtiu
  const candidates = uniqueMovies([...lists, ...likedLists]).filter((m) => !m.genreIds.some((g) => vetoed.includes(g)))
  return suggestMovies(members, candidates, 12, neighbors)
}

type Props = {
  members: Member[]
  kind: Kind
  /** A pessoa deste aparelho (se der para saber) — pode responder às sugestões */
  me?: Member
  onRate?: (movie: Movie, r: 1 | -1) => Promise<void>
}

export default function MovieSuggestions({ members, kind, me, onRate }: Props) {
  const [list, setList] = useState<MovieSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  // Recalcula quando alguém muda os gostos (a sala atualiza ao vivo) ou troca a aba
  const signature = JSON.stringify([kind, members.map((m) => [m.id, m.genres, m.movies, m.series])])

  useEffect(() => {
    let alive = true
    setError(null)
    // Mantém a lista antiga na tela enquanto recalcula (sem "piscar")
    loadSuggestions(members, kind)
      .then((l) => alive && setList(l))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  // Trocou de aba: mostra o carregando de novo
  useEffect(() => setList(null), [kind])

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
          <span className="match-badge big-badge">
            {best.score}%{best.guess && <GuessMark />}
          </span>
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
        {me && onRate && <RateButtons movie={best.movie} me={me} onRate={onRate} />}
        <a className="btn small" href={watchUrl(best.movie)} target="_blank" rel="noreferrer">
          Onde assistir →
        </a>
      </article>

      <h4 className="muted">Outras boas opções</h4>
      <ul className="suggestions">
      {rest.map(({ movie, score, perPerson, guess }, i) => (
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
            <span className="match-badge">
              {score}%{guess && <GuessMark />}
            </span>
          </button>
          {open === movie.id && (
            <div className="suggestion-detail">
              <p className="small">{movie.overview}</p>
              <PersonScores perPerson={perPerson} />
              {me && onRate && <RateButtons movie={movie} me={me} onRate={onRate} />}
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

/** Marquinha de "palpite": o app sabe pouco sobre o gosto de alguém para este título. */
function GuessMark() {
  return (
    <span className="guess-mark" title="Palpite: o app ainda sabe pouco sobre o gosto de alguém para este tipo de título">
      ?
    </span>
  )
}

/** % de cada pessoa com o filme, com a cor de cada uma. Palpites ficam mais apagados. */
function PersonScores({ perPerson }: { perPerson: MovieSuggestion['perPerson'] }) {
  return (
    <ul className="per-person">
      {perPerson.map(({ member, score, confidence }) => {
        const guess = confidence < 0.5
        return (
          <li key={member.id} className={guess ? 'guess' : ''}>
            <Avatar member={member} size={22} />
            <span className="person-name small">{member.name}</span>
            <div className="bar">
              <div style={{ width: `${score}%`, background: memberColor(member) }} />
            </div>
            <span className="small">
              {score}%{guess ? '?' : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** "Já vi e curti" / "Não curto": responde à sugestão e o app recalcula a lista. */
function RateButtons({ movie, me, onRate }: { movie: Movie; me: Member; onRate: (m: Movie, r: 1 | -1) => Promise<void> }) {
  const [busy, setBusy] = useState<1 | -1 | null>(null)
  const rate = async (r: 1 | -1) => {
    setBusy(r)
    try {
      await onRate(movie, r)
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="rate-row">
      <span className="small muted">{me.name}, acertamos?</span>
      <button type="button" className="btn small" disabled={busy !== null} onClick={() => rate(1)}>
        {busy === 1 ? '…' : '♥ Já vi e curti'}
      </button>
      <button type="button" className="btn small" disabled={busy !== null} onClick={() => rate(-1)}>
        {busy === -1 ? '…' : '✕ Não curto'}
      </button>
    </div>
  )
}
