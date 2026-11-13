import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { GENRES } from '../lib/genres'
import { upsertMember, type GenrePrefs, type Member } from '../lib/room'
import { useRoom } from '../lib/useRoom'
import { RoomStatus } from './RoomStatus'

/** Ciclo do toque: tanto faz → gosto → não curto → tanto faz */
function nextValue(v: 1 | -1 | undefined): 1 | -1 | undefined {
  if (v === undefined) return 1
  if (v === 1) return -1
  return undefined
}

export default function Tastes() {
  const { roomId = '' } = useParams()
  const [params] = useSearchParams()
  const { state } = useRoom(roomId)

  if (state.status !== 'ready') return <RoomStatus status={state.status} message={'message' in state ? state.message : undefined} />

  const editing = state.room.members.find((m) => m.id === params.get('m'))
  // key: recria o formulário com os dados certos ao trocar de pessoa
  return <TastesForm key={editing?.id ?? 'novo'} roomId={roomId} editing={editing} />
}

function TastesForm({ roomId, editing }: { roomId: string; editing?: Member }) {
  const navigate = useNavigate()
  const [name, setName] = useState(editing?.name ?? '')
  const [genres, setGenres] = useState<GenrePrefs>(editing?.genres ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const liked = Object.values(genres).filter((v) => v === 1).length

  function toggle(id: number) {
    setGenres((prev) => {
      const next = { ...prev }
      const v = nextValue(prev[id])
      if (v === undefined) delete next[id]
      else next[id] = v
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await upsertMember(roomId, { id: editing?.id, name: name.trim(), genres })
      navigate(`/s/${roomId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <h2>{editing ? 'Editar gostos' : 'Seus gostos'}</h2>
      <input
        className="input"
        placeholder="Seu nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={30}
        aria-label="Seu nome"
      />

      <p className="muted small">
        Toque uma vez = <b className="like">gosto</b> · duas vezes = <b className="dislike">não curto</b> · três = tanto faz
      </p>

      <div className="chips">
        {GENRES.map((g) => {
          const v = genres[g.id]
          return (
            <button
              type="button"
              key={g.id}
              className={`chip ${v === 1 ? 'on' : v === -1 ? 'off' : ''}`}
              onClick={() => toggle(g.id)}
              aria-pressed={v !== undefined}
            >
              {g.emoji} {g.name}
            </button>
          )
        })}
      </div>

      {error && <p className="error">{error}</p>}
      <button className="btn primary big" type="submit" disabled={saving || !name.trim() || liked === 0}>
        {saving ? 'Salvando…' : liked === 0 ? 'Escolha pelo menos 1 gênero' : 'Salvar'}
      </button>
    </form>
  )
}
