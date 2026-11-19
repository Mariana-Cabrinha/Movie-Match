import { Link, useParams } from 'react-router-dom'
import { groupCompatibility, memberCompatibility, rankGenres } from '../lib/match'
import { genreById } from '../lib/genres'
import { useState } from 'react'
import { hasTmdb, type Kind, type Movie } from '../lib/tmdb'
import { myMemberIds, upsertMember } from '../lib/room'
import KindTabs from './KindTabs'
import MovieSuggestions from './MovieSuggestions'
import { AvatarStack } from './Avatar'
import BlendReveal from './BlendReveal'

function verdict(pct: number): string {
  if (pct >= 85) return 'Almas gêmeas do cinema 💞'
  if (pct >= 70) return 'Combinam muito bem 🍿'
  if (pct >= 55) return 'Dá pra achar um filme juntos 👍'
  if (pct >= 40) return 'Gostos bem diferentes… mas tem saída 🤝'
  return 'Opostos se atraem? Hora de negociar 😅'
}
import { useRoom } from '../lib/useRoom'
import { RoomStatus } from './RoomStatus'

export default function Blend() {
  const { roomId = '' } = useParams()
  const [kind, setKind] = useState<Kind>('movie')
  const { state } = useRoom(roomId)

  if (state.status !== 'ready') return <RoomStatus status={state.status} message={'message' in state ? state.message : undefined} />

  const { members } = state.room
  const compat = groupCompatibility(members)

  if (compat === null)
    return <p>Precisa de pelo menos 2 pessoas. <Link to={`/s/${roomId}`}>Voltar para a sala</Link></p>

  // "Você": a pessoa salva neste aparelho. Se houver mais de uma (passaram o
  // celular), não dá para saber quem está olhando — aí não mostramos os botões.
  const mineIds = new Set(myMemberIds(roomId))
  const mine = members.filter((m) => mineIds.has(m.id))
  const me = mine.length === 1 ? mine[0] : undefined

  async function rate(movie: Movie, r: 1 | -1) {
    if (!me) return
    const field = movie.kind === 'movie' ? 'movies' : 'series'
    const map = { ...(me[field] ?? {}), [movie.id]: { r, g: movie.genreIds, t: movie.title, p: movie.posterPath } }
    await upsertMember(roomId, { ...me, [field]: map })
  }

  const top = rankGenres(members).filter((g) => !g.vetoed && g.score > 0).slice(0, 5)
  const pairs = members.flatMap((a, i) =>
    members.slice(i + 1).map((b) => ({ a, b, pct: memberCompatibility(a, b) })),
  )

  return (
    <section className="stack">
      <div className="card center blend-hero">
        <AvatarStack members={members} size={44} />
        <p className="muted small">{members.map((m) => m.name).join(' + ')}</p>
        <BlendReveal pct={compat} verdict={verdict(compat)} />
      </div>

      <h3>🍿 Para vocês assistirem</h3>
      {hasTmdb && <KindTabs value={kind} onChange={setKind} />}
      {hasTmdb ? (
        <MovieSuggestions members={members} kind={kind} me={me} onRate={rate} />
      ) : (
        <p className="note">Configure o token da TMDB (VITE_TMDB_TOKEN no .env) para ver sugestões de filmes.</p>
      )}

      <h3>Gêneros que agradam o grupo</h3>
      {top.length === 0 ? (
        <p className="muted">Nenhum gênero agrada sem que alguém vete... hora de negociar 😅</p>
      ) : (
        <ul className="bars">
          {top.map((g) => {
            const info = genreById.get(g.id)!
            return (
              <li key={g.id}>
                <span>{info.emoji} {info.name}</span>
                <div className="bar"><div style={{ width: `${g.score}%` }} /></div>
                <span className="small">{g.score}%</span>
              </li>
            )
          })}
        </ul>
      )}

      {pairs.length > 1 && (
        <>
          <h3>Compatibilidade por dupla</h3>
          <ul className="members">
            {pairs.map(({ a, b, pct }) => (
              <li key={a.id + b.id} className="member">
                <AvatarStack members={[a, b]} size={28} />
                <span className="grow">{a.name} & {b.name}</span>
                <b>{pct}%</b>
              </li>
            ))}
          </ul>
        </>
      )}


      <Link className="btn" to={`/s/${roomId}`}>Voltar para a sala</Link>
    </section>
  )
}
