import { useEffect, useState } from 'react'
import { GENRES } from '../lib/genres'
import { discover, uniqueMovies, type Kind, type Movie } from '../lib/tmdb'
import type { Ratings } from './Tastes'

type Props = {
  kind: Kind
  ratings: Ratings
  onChange: (r: Ratings) => void
}

// Listas fixas no topo + um botão por gênero
type Shelf = { id: string; label: string; genre?: number; sort?: 'popular' | 'top' }
const SHELVES: Shelf[] = [
  { id: 'top', label: '🏆 Mais bem avaliados', sort: 'top' },
  { id: 'pop', label: '🔥 Populares', sort: 'popular' },
  ...GENRES.map((g) => ({ id: String(g.id), label: `${g.emoji} ${g.name}`, genre: g.id })),
]

/**
 * Catálogo: uma grade de pôsteres por gênero para marcar rapidinho.
 * Toque: nada → ♥ curti → ✕ não curti → nada. Também serve para corrigir
 * o que já foi marcado (aparece com a marquinha).
 */
export default function CatalogGrid({ kind, ratings, onChange }: Props) {
  const [shelf, setShelf] = useState<Shelf>(SHELVES[0])
  const [items, setItems] = useState<Movie[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // (trocar Filmes/Séries recria este componente: ver key={kind} em MovieSwipe)
  function pickShelf(s: Shelf) {
    if (s.id === shelf.id) return
    setItems([])
    setPage(1)
    setShelf(s)
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    discover(kind, { withGenres: shelf.genre ? [shelf.genre] : undefined, sort: shelf.sort ?? 'popular', page })
      .then((list) => alive && setItems((old) => uniqueMovies([old, list])))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [shelf, kind, page])

  function cycle(m: Movie) {
    const current = ratings[m.kind][m.id]
    const map = { ...ratings[m.kind] }
    // Escolhidos na busca ("amo"/"não curto") também giram, mas mantêm o peso dobrado
    const next = !current || current.r === 0 ? 1 : current.r === 1 ? -1 : undefined
    if (next === undefined) delete map[m.id]
    else map[m.id] = { ...current, r: next, g: m.genreIds, t: m.title, p: m.posterPath }
    onChange({ ...ratings, [m.kind]: map })
  }

  // Dorama só existe para séries
  const shelves = SHELVES.filter((s) => !(kind === 'movie' && s.genre === 90002))

  return (
    <div className="stack catalog">
      <p className="muted small">Toque uma vez = <b className="like">♥ curti</b> · duas = <b className="dislike">✕ não curti</b> · três = desmarca</p>
      <div className="shelf-row" role="tablist" aria-label="Escolha uma lista">
        {shelves.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={shelf.id === s.id}
            className={`chip mini-chip ${shelf.id === s.id ? 'on' : ''}`}
            onClick={() => pickShelf(s)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <ul className="catalog-grid">
        {items.map((m) => {
          const r = ratings[m.kind][m.id]?.r
          const state = r === 1 ? 'like' : r === -1 ? 'nope' : ''
          return (
            <li key={`${m.kind}:${m.id}`}>
              <button
                type="button"
                className={`catalog-item ${state}`}
                onClick={() => cycle(m)}
                aria-label={`${m.title} (${m.year}) — ${r === 1 ? 'curti' : r === -1 ? 'não curti' : 'sem marcação'}. Toque para mudar.`}
              >
                {m.poster ? <img src={m.poster} alt="" loading="lazy" /> : <div className="poster-empty">🎬</div>}
                {state && <span className="catalog-mark">{state === 'like' ? '♥' : '✕'}</span>}
                <span className="catalog-title">{m.title}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {loading && <p className="muted small center-text">Carregando…</p>}
      {!loading && items.length > 0 && (
        <button type="button" className="btn" onClick={() => setPage((p) => p + 1)}>Carregar mais</button>
      )}
    </div>
  )
}
