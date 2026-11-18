import { useEffect, useState } from 'react'
import { posterUrl, searchTitles, type Movie } from '../lib/tmdb'
import type { Ratings } from './Tastes'

type Props = {
  ratings: Ratings
  onChange: (r: Ratings) => void
  onBack: () => void
  onNext: () => void
}

const SUGGESTED = 3 // quantos favoritos pedimos (não é obrigatório)

/** Etapa 2: buscar filmes/séries pelo nome e marcar como favoritos. */
export default function FavoritesSearch({ ratings, onChange, onBack, onNext }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Movie[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Busca com um pequeno atraso enquanto a pessoa digita
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      searchTitles(query)
        .then((r) => {
          setResults(r.slice(0, 8))
          setError(null)
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false))
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  const favorites = (['movie', 'tv'] as const).flatMap((kind) =>
    Object.entries(ratings[kind])
      .filter(([, r]) => r.fav)
      .map(([id, r]) => ({ kind, id, ...r })),
  )

  function isFav(m: Movie) {
    return Boolean(ratings[m.kind][m.id]?.fav)
  }

  function toggle(m: Movie) {
    const map = { ...ratings[m.kind] }
    if (map[m.id]?.fav) delete map[m.id]
    else map[m.id] = { r: 1, g: m.genreIds, fav: true, t: m.title, p: m.posterPath }
    onChange({ ...ratings, [m.kind]: map })
  }

  function remove(kind: 'movie' | 'tv', id: string) {
    const map = { ...ratings[kind] }
    delete map[id]
    onChange({ ...ratings, [kind]: map })
  }

  return (
    <section className="stack">
      <div className="row between">
        <button className="btn small ghost" type="button" onClick={onBack}>← Gêneros</button>
        <span className="step-label">Etapa 2 de 3 · Favoritos</span>
      </div>
      <h2>Cite {SUGGESTED} filmes ou séries que você ama</h2>
      <p className="muted small">Pode ser qualquer coisa: filme, série, anime, dorama… Eles pesam mais no seu match.</p>

      {favorites.length > 0 && (
        <ul className="fav-strip">
          {favorites.map((f) => (
            <li key={`${f.kind}:${f.id}`}>
              {f.p ? <img src={posterUrl(f.p, 'w185')!} alt="" /> : <div className="poster-empty">🎬</div>}
              <button type="button" className="fav-remove" aria-label={`Remover ${f.t}`} onClick={() => remove(f.kind, f.id)}>✕</button>
              <span className="fav-title">{f.t}</span>
            </li>
          ))}
        </ul>
      )}

      <input
        className="input"
        type="search"
        placeholder="🔍 Buscar filme ou série…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Buscar filme ou série"
        autoFocus
      />

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted small">Buscando…</p>}
      {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
        <p className="muted small">Nada encontrado para "{query}".</p>
      )}

      <ul className="search-results">
        {results.map((m) => {
          const fav = isFav(m)
          return (
            <li key={`${m.kind}:${m.id}`}>
              <button type="button" className={`search-item ${fav ? 'picked' : ''}`} onClick={() => toggle(m)}
                aria-pressed={fav}
                aria-label={`${fav ? 'Remover dos' : 'Adicionar aos'} favoritos: ${m.title} (${m.kind === 'movie' ? 'filme' : 'série'}${m.year ? `, ${m.year}` : ''})`}
              >
                {m.poster ? <img src={m.poster} alt="" loading="lazy" /> : <div className="poster-empty">🎬</div>}
                <span className="grow">
                  <b>{m.title}</b>
                  <span className="muted small">
                    {m.kind === 'movie' ? 'Filme' : 'Série'}
                    {m.year && ` · ${m.year}`}
                  </span>
                </span>
                <span className="pick-mark">{fav ? '♥' : '+'}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="sticky-bottom">
        <button className={`btn big ${favorites.length >= SUGGESTED ? 'primary' : ''}`} type="button" onClick={onNext}>
          {favorites.length === 0 ? 'Pular → swipe' : `Próximo: swipe → (${favorites.length} favorito${favorites.length === 1 ? '' : 's'})`}
        </button>
      </div>
    </section>
  )
}
