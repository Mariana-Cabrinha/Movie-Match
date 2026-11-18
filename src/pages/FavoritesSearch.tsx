import { useEffect, useState } from 'react'
import { details, posterUrl, searchTitles, type Kind, type Movie } from '../lib/tmdb'
import type { Rating } from '../lib/room'
import type { Ratings } from './Tastes'

type Props = {
  ratings: Ratings
  onChange: (r: Ratings) => void
  onBack: () => void
  onNext: () => void
}

const SUGGESTED = 3 // quantos favoritos pedimos (não é obrigatório)

type Mode = 'love' | 'hate'
type Entry = { kind: Kind; id: string } & Rating

/** Lista de avaliações de um jeito fácil de percorrer. */
function entries(ratings: Ratings): Entry[] {
  return (['movie', 'tv'] as const).flatMap((kind) => Object.entries(ratings[kind]).map(([id, r]) => ({ kind, id, ...r })))
}

/**
 * Etapa 2: buscar filmes/séries pelo nome e marcar como "amo" ou "não curto".
 * Os escolhidos aqui pesam o dobro no gosto (campo `fav`). Embaixo, dá para
 * revisar e mudar tudo que foi avaliado no swipe.
 */
export default function FavoritesSearch({ ratings, onChange, onBack, onNext }: Props) {
  const [mode, setMode] = useState<Mode>('love')
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

  const all = entries(ratings)
  const loved = all.filter((e) => e.fav && e.r === 1)
  const hated = all.filter((e) => e.fav && e.r === -1)
  const fromSwipe = all.filter((e) => !e.fav)
  const picked = mode === 'love' ? loved : hated
  const value = mode === 'love' ? 1 : -1

  function set(kind: Kind, id: string | number, r: Rating | undefined) {
    const map = { ...ratings[kind] }
    if (r) map[id] = r
    else delete map[id]
    onChange({ ...ratings, [kind]: map })
  }

  /** Toque num resultado: adiciona na aba atual, ou tira se já estava nela. */
  function toggle(m: Movie) {
    const current = ratings[m.kind][m.id]
    if (current?.fav && current.r === value) set(m.kind, m.id, undefined)
    else set(m.kind, m.id, { r: value, g: m.genreIds, fav: true, t: m.title, p: m.posterPath })
  }

  return (
    <section className="stack">
      <div className="row between">
        <button className="btn small ghost" type="button" onClick={onBack}>← Gêneros</button>
        <span className="step-label">Etapa 2 de 3 · Seus títulos</span>
      </div>

      <div className="kind-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'love'} className={mode === 'love' ? 'active' : ''} onClick={() => setMode('love')}>
          ♥ Amo ({loved.length})
        </button>
        <button type="button" role="tab" aria-selected={mode === 'hate'} className={mode === 'hate' ? 'active' : ''} onClick={() => setMode('hate')}>
          ✕ Não curto ({hated.length})
        </button>
      </div>

      {mode === 'love' ? (
        <>
          <h2>Cite {SUGGESTED} (ou mais) filmes ou séries que você ama</h2>
          <p className="muted small">Pode ser qualquer coisa: filme, série, anime, dorama… Eles pesam mais no seu match.</p>
        </>
      ) : (
        <>
          <h2>E alguns que você não curte</h2>
          <p className="muted small">Assim o app aprende o que evitar e não sugere coisas parecidas pro grupo.</p>
        </>
      )}

      {picked.length > 0 && (
        <ul className={`fav-strip ${mode === 'hate' ? 'hate' : ''}`}>
          {picked.map((f) => (
            <li key={`${f.kind}:${f.id}`}>
              {f.p ? <img src={posterUrl(f.p, 'w185')!} alt="" /> : <div className="poster-empty">🎬</div>}
              <button type="button" className="fav-remove" aria-label={`Remover ${f.t}`} onClick={() => set(f.kind, f.id, undefined)}>✕</button>
              <span className="fav-title">{f.t}</span>
            </li>
          ))}
        </ul>
      )}

      <input
        className="input"
        type="search"
        placeholder={mode === 'love' ? '🔍 Buscar o que você ama…' : '🔍 Buscar o que você não curte…'}
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
          const r = ratings[m.kind][m.id]
          const inLove = Boolean(r?.fav && r.r === 1)
          const inHate = Boolean(r?.fav && r.r === -1)
          const here = mode === 'love' ? inLove : inHate
          const kindLabel = m.kind === 'movie' ? 'filme' : 'série'
          return (
            <li key={`${m.kind}:${m.id}`}>
              <button
                type="button"
                className={`search-item ${inLove ? 'picked' : ''} ${inHate ? 'picked-no' : ''}`}
                onClick={() => toggle(m)}
                aria-pressed={here}
                aria-label={`${here ? 'Remover de' : 'Adicionar a'} "${mode === 'love' ? 'Amo' : 'Não curto'}": ${m.title} (${kindLabel}${m.year ? `, ${m.year}` : ''})`}
              >
                {m.poster ? <img src={m.poster} alt="" loading="lazy" /> : <div className="poster-empty">🎬</div>}
                <span className="grow">
                  <b>{m.title}</b>
                  <span className="muted small">
                    {m.kind === 'movie' ? 'Filme' : 'Série'}
                    {m.year && ` · ${m.year}`}
                    {inLove && mode === 'hate' && ' · está em "Amo"'}
                    {inHate && mode === 'love' && ' · está em "Não curto"'}
                  </span>
                </span>
                <span className="pick-mark">{inLove ? '♥' : inHate ? '✕' : '+'}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {fromSwipe.length > 0 && <ReviewList items={fromSwipe} onSet={set} />}

      <div className="sticky-bottom">
        <button className={`btn big ${loved.length >= SUGGESTED ? 'primary' : ''}`} type="button" onClick={onNext}>
          {loved.length + hated.length === 0 ? 'Pular → swipe' : `Próximo: swipe → (${loved.length} ♥ · ${hated.length} ✕)`}
        </button>
      </div>
    </section>
  )
}

/** Tudo que foi avaliado no swipe, para trocar ♥/✕ ou tirar. */
function ReviewList({ items, onSet }: { items: Entry[]; onSet: (kind: Kind, id: string, r: Rating | undefined) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="review" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <b>Avaliados no swipe ({items.length})</b>
        <span className="muted small"> · passou errado ou mudou de ideia? Corrija aqui</span>
      </summary>
      {open && (
        <ul className="review-list">
          {items.map((e) => (
            <ReviewRow key={`${e.kind}:${e.id}`} entry={e} onSet={onSet} />
          ))}
        </ul>
      )}
    </details>
  )
}

function ReviewRow({ entry, onSet }: { entry: Entry; onSet: (kind: Kind, id: string, r: Rating | undefined) => void }) {
  // Avaliações antigas não guardavam nome/pôster: busca na TMDB só para mostrar
  const [info, setInfo] = useState<{ t?: string; p?: string | null }>({ t: entry.t, p: entry.p })
  useEffect(() => {
    if (entry.t) return
    details(entry.kind, entry.id)
      .then((m) => setInfo({ t: m.title, p: m.posterPath }))
      .catch(() => setInfo({ t: `Título #${entry.id}` }))
  }, [entry.kind, entry.id, entry.t])

  const title = info.t ?? 'Carregando…'
  const flip = (r: 1 | -1) => onSet(entry.kind, entry.id, { ...entry, r, t: info.t, p: info.p ?? null })

  return (
    <li className="review-row">
      {info.p ? <img src={posterUrl(info.p, 'w185')!} alt="" loading="lazy" /> : <div className="poster-empty">🎬</div>}
      <span className="grow">
        <b>{title}</b>
        <span className="muted small">{entry.kind === 'movie' ? 'Filme' : 'Série'}</span>
      </span>
      <span className="review-actions" role="group" aria-label={`Avaliação de ${title}`}>
        <button type="button" className={entry.r === 1 ? 'on like' : ''} aria-pressed={entry.r === 1} aria-label={`Curti ${title}`} onClick={() => flip(1)}>♥</button>
        <button type="button" className={entry.r === -1 ? 'on nope' : ''} aria-pressed={entry.r === -1} aria-label={`Não curti ${title}`} onClick={() => flip(-1)}>✕</button>
        <button type="button" aria-label={`Tirar ${title} das avaliações`} onClick={() => onSet(entry.kind, entry.id, undefined)}>🗑</button>
      </span>
    </li>
  )
}
