import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { GENRES } from '../lib/genres'
import { upsertMember, type GenrePrefs, type Member, type MovieRatings } from '../lib/room'
import { hasTmdb, type Kind } from '../lib/tmdb'
import MovieSwipe from './MovieSwipe'
import FavoritesSearch from './FavoritesSearch'

export type Ratings = Record<Kind, MovieRatings>
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

  const [step, setStep] = useState<'genres' | 'favorites' | 'swipe'>('genres')
  // Avaliações de filmes e de séries, compartilhadas entre a busca e o swipe
  const [ratings, setRatings] = useState<Ratings>({ movie: editing?.movies ?? {}, tv: editing?.series ?? {} })

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await upsertMember(roomId, { id: editing?.id, name: name.trim(), genres, movies: ratings.movie, series: ratings.tv })
      navigate(`/s/${roomId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Com TMDB: segue para favoritos e swipe. Sem TMDB: salva direto.
    if (hasTmdb) setStep('favorites')
    else save()
  }

  if (step === 'favorites')
    return (
      <FavoritesSearch
        ratings={ratings}
        onChange={setRatings}
        onBack={() => setStep('genres')}
        onNext={() => setStep('swipe')}
      />
    )

  if (step === 'swipe')
    return (
      <>
        <MovieSwipe
          genres={genres}
          ratings={ratings}
          onChange={setRatings}
          saving={saving}
          onBack={() => setStep('favorites')}
          onDone={save}
        />
        {error && <p className="error">{error}</p>}
      </>
    )

  return (
    <form className="stack" onSubmit={handleSubmit}>
      {hasTmdb && <p className="step-label">Etapa 1 de 3 · Gêneros</p>}
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

      <div className="legend small">
        <span>Toque para marcar:</span>
        <span className="chip on mini">✓ gosto</span>
        <span className="muted">→</span>
        <span className="chip off mini">✕ não curto</span>
        <span className="muted">→ tanto faz</span>
      </div>

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
              <span className="chip-mark">{v === 1 ? '✓' : v === -1 ? '✕' : g.emoji}</span> {g.name}
            </button>
          )
        })}
      </div>

      {error && <p className="error">{error}</p>}
      <div className="sticky-bottom">
        <button className="btn primary big" type="submit" disabled={saving || !name.trim() || liked === 0}>
          {saving
            ? 'Salvando…'
            : !name.trim()
              ? 'Digite seu nome'
              : liked === 0
                ? 'Marque pelo menos 1 gênero'
                : hasTmdb
                  ? 'Próximo: seus títulos →'
                  : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
