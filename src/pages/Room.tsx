import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isCloud, myMemberIds, removeMember } from '../lib/room'
import { groupCompatibility } from '../lib/match'
import { useRoom } from '../lib/useRoom'
import { RoomStatus } from './RoomStatus'
import { Avatar, AvatarStack } from './Avatar'

export default function RoomPage() {
  const { roomId = '' } = useParams()
  const { state, reload } = useRoom(roomId)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (state.status !== 'ready') return <RoomStatus status={state.status} message={'message' in state ? state.message : undefined} />

  const { members } = state.room
  const mine = new Set(myMemberIds(roomId))
  const link = `${window.location.origin}/s/${roomId}`
  const compat = groupCompatibility(members)

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: 'Movie Match', text: 'Entra na minha sala do Movie Match!', url: link })
      else {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* usuário cancelou */
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      await removeMember(roomId, id)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section className="stack">
      <div className="card room-card">
        <div className="row between">
          <div>
            <p className="muted small">Código da sala</p>
            <h2 className="code">{roomId}</h2>
          </div>
          {members.length > 0 && <AvatarStack members={members} size={34} />}
        </div>
        <button className="btn" onClick={share}>{copied ? '✓ Link copiado!' : '🔗 Compartilhar link'}</button>
        {!isCloud && (
          <p className="note">
            ⚠️ Modo local: as respostas ficam salvas só neste aparelho — passe o
            celular para cada pessoa escolher. Configure o Supabase para funcionar pelo link.
          </p>
        )}
      </div>

      <h3>Quem está na sala ({members.length})</h3>
      {members.length === 0 && <p className="muted">Ninguém ainda. Seja o primeiro!</p>}
      <ul className="members">
        {members.map((m) => {
          const g = Object.values(m.genres).filter((v) => v === 1).length
          const all = [...Object.values(m.movies ?? {}), ...Object.values(m.series ?? {})]
          const fav = all.filter((r) => r.fav && r.r === 1).length
          const f = all.length
          return (
            <li key={m.id} className="member">
              <Avatar member={m} size={36} />
              <span className="grow">
                <span className="member-name">
                  {m.name} {mine.has(m.id) && <span className="tag">você</span>}
                </span>
                <span className="muted small">
                  {g} gênero{g === 1 ? '' : 's'}
                  {fav > 0 && ` · ${fav} favorito${fav === 1 ? '' : 's'}`}
                  {f > 0 && ` · ${f} avaliado${f === 1 ? '' : 's'}`}
                </span>
              </span>
              <Link className="btn small" to={`/s/${roomId}/gostos?m=${m.id}`}>Editar</Link>
              <button className="btn small ghost" aria-label={`Remover ${m.name}`} onClick={() => remove(m.id)}>✕</button>
            </li>
          )
        })}
      </ul>
      {error && <p className="error">{error}</p>}

      <Link className={`btn ${compat === null ? 'primary big' : ''}`} to={`/s/${roomId}/gostos`}>
        {mine.size === 0 ? '+ Adicionar meus gostos' : '+ Adicionar pessoa'}
      </Link>

      {compat !== null ? (
        <Link className="btn big accent-btn" to={`/s/${roomId}/blend`}>
          ✨ Ver o blend do grupo · {compat}%
        </Link>
      ) : (
        <p className="muted small center-text">O blend aparece quando houver pelo menos 2 pessoas.</p>
      )}
    </section>
  )
}
