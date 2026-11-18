import { Link, useParams } from 'react-router-dom'
import { groupCompatibility, memberCompatibility, rankGenres } from '../lib/match'
import { genreById } from '../lib/genres'
import { useState } from 'react'
import { hasTmdb, type Kind } from '../lib/tmdb'
import KindTabs from './KindTabs'
import MovieSuggestions from './MovieSuggestions'
import { AvatarStack } from './Avatar'

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

  const top = rankGenres(members).filter((g) => !g.vetoed && g.score > 0).slice(0, 5)
  const pairs = members.flatMap((a, i) =>
    members.slice(i + 1).map((b) => ({ a, b, pct: memberCompatibility(a, b) })),
  )

  return (
    <section className="stack">
      <div className="card center blend-hero">
        <AvatarStack members={members} size={44} />
        <p className="muted small">{members.map((m) => m.name).join(' + ')}</p>
        <div className="ring" style={{ ['--pct' as string]: compat }}>
          <span>
            {compat}%<small>compatíveis</small>
          </span>
        </div>
        <p className="verdict">{verdict(compat)}</p>
      </div>

      <h3>🍿 Para vocês assistirem</h3>
      {hasTmdb && <KindTabs value={kind} onChange={setKind} />}
      {hasTmdb ? (
        <MovieSuggestions members={members} kind={kind} />
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
