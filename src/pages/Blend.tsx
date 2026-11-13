import { Link, useParams } from 'react-router-dom'
import { groupCompatibility, pairCompatibility, rankGenres } from '../lib/match'
import { genreById } from '../lib/genres'
import { useRoom } from '../lib/useRoom'
import { RoomStatus } from './RoomStatus'

export default function Blend() {
  const { roomId = '' } = useParams()
  const { state } = useRoom(roomId)

  if (state.status !== 'ready') return <RoomStatus status={state.status} message={'message' in state ? state.message : undefined} />

  const { members } = state.room
  const compat = groupCompatibility(members)

  if (compat === null)
    return <p>Precisa de pelo menos 2 pessoas. <Link to={`/s/${roomId}`}>Voltar para a sala</Link></p>

  const top = rankGenres(members).filter((g) => !g.vetoed && g.score > 0).slice(0, 5)
  const pairs = members.flatMap((a, i) =>
    members.slice(i + 1).map((b) => ({ a, b, pct: pairCompatibility(a.genres, b.genres) })),
  )

  return (
    <section className="stack">
      <div className="card center">
        <p className="muted small">{members.map((m) => m.name).join(' + ')}</p>
        <div className="ring" style={{ ['--pct' as string]: compat }}>
          <span>{compat}%</span>
        </div>
        <p>de compatibilidade</p>
      </div>

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
                <span className="grow">{a.name} & {b.name}</span>
                <b>{pct}%</b>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="card note">
        🍿 Em breve: sugestões de filmes reais (via TMDB) com o % de match de cada um.
      </div>

      <Link className="btn" to={`/s/${roomId}`}>Voltar para a sala</Link>
    </section>
  )
}
