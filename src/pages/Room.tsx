import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrCreateRoom, removeMember } from '../lib/room'
import { groupCompatibility } from '../lib/match'

export default function RoomPage() {
  const { roomId = '' } = useParams()
  const [room, setRoom] = useState(() => getOrCreateRoom(roomId))
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/s/${roomId}`
  const compat = groupCompatibility(room.members)

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: 'Movie Match', url: link })
      else {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* usuário cancelou */
    }
  }

  return (
    <section className="stack">
      <div className="card">
        <p className="muted small">Sala</p>
        <h2 className="code">{roomId}</h2>
        <button className="btn" onClick={share}>{copied ? 'Link copiado!' : 'Compartilhar link'}</button>
        <p className="note">
          ⚠️ Versão de teste: por enquanto as respostas ficam salvas só neste aparelho —
          passe o celular para cada pessoa escolher. Em breve funciona pelo link.
        </p>
      </div>

      <h3>Quem está na sala ({room.members.length})</h3>
      {room.members.length === 0 && <p className="muted">Ninguém ainda. Seja o primeiro!</p>}
      <ul className="members">
        {room.members.map((m) => (
          <li key={m.id} className="member">
            <span className="avatar">{m.name.slice(0, 1).toUpperCase()}</span>
            <span className="grow">{m.name}</span>
            <Link className="btn small" to={`/s/${roomId}/gostos?m=${m.id}`}>Editar</Link>
            <button
              className="btn small ghost"
              aria-label={`Remover ${m.name}`}
              onClick={() => {
                removeMember(roomId, m.id)
                setRoom(getOrCreateRoom(roomId))
              }}
            >✕</button>
          </li>
        ))}
      </ul>

      <Link className="btn primary" to={`/s/${roomId}/gostos`}>+ Adicionar pessoa</Link>

      {compat !== null ? (
        <Link className="btn big accent-btn" to={`/s/${roomId}/blend`}>
          Ver o blend do grupo · {compat}%
        </Link>
      ) : (
        <p className="muted small center-text">O blend aparece quando houver pelo menos 2 pessoas.</p>
      )}
    </section>
  )
}
