import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { GENRES } from '../lib/genres'
import { getOrCreateRoom, upsertMember, type GenrePrefs } from '../lib/room'

/** Ciclo do toque: tanto faz → gosto → não curto → tanto faz */
function nextValue(v: 1 | -1 | undefined): 1 | -1 | undefined {
  if (v === undefined) return 1
  if (v === 1) return -1
  return undefined
}

export default function Tastes() {
  const { roomId = '' } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const editing = getOrCreateRoom(roomId).members.find((m) => m.id === params.get('m'))

  const [name, setName] = useState(editing?.name ?? '')
  const [genres, setGenres] = useState<GenrePrefs>(editing?.genres ?? {})

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

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        upsertMember(roomId, { id: editing?.id, name: name.trim(), genres })
        navigate(`/s/${roomId}`)
      }}
    >
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

      <button className="btn primary big" type="submit" disabled={!name.trim() || liked === 0}>
        {liked === 0 ? 'Escolha pelo menos 1 gênero' : 'Salvar'}
      </button>
    </form>
  )
}
