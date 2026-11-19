import { useEffect, useRef, useState } from 'react'
import { discover, uniqueMovies, type Kind, type Movie } from '../lib/tmdb'
import type { GenrePrefs, Rating } from '../lib/room'
import { GENRES, genreById } from '../lib/genres'
import type { Ratings } from './Tastes'
import KindTabs from './KindTabs'
import CatalogGrid from './CatalogGrid'

type Props = {
  genres: GenrePrefs
  ratings: Ratings
  onChange: (r: Ratings) => void
  saving: boolean
  onBack: () => void
  onDone: () => void
}

const SWIPE_DISTANCE = 90 // px para contar como "arrastou"
const FLY_MS = 280 // duração da carta voando para fora

function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const DECK_SIZE = 30
const randomPage = (max: number) => 1 + Math.floor(Math.random() * max)

/**
 * De onde vem cada carta:
 * - "seu": gêneros que a pessoa marcou que curte (o que ela já espera)
 * - "descoberta": gêneros que ela NÃO marcou — pode ter algo que ela nem
 *   lembrava que curtia (ou que não curtia), e é aí que o app mais aprende
 * - "classico": os mais bem avaliados de todos os tempos, de qualquer gênero
 */
type Source = 'seu' | 'descoberta' | 'classico'
const PATTERN: Source[] = ['seu', 'descoberta', 'seu', 'classico', 'descoberta', 'seu'] // ~50% / 33% / 17%

const SOURCE_LABEL: Record<Source, string | null> = {
  seu: null,
  descoberta: '🧭 Descoberta',
  classico: '🏆 Clássico',
}

async function buildDeck(kind: Kind, genres: GenrePrefs, already: Record<string, Rating>) {
  const ids = (v: 1 | -1) => Object.keys(genres).map(Number).filter((g) => genres[g] === v)
  const liked = ids(1)
  const disliked = ids(-1)
  const unmarked = GENRES.map((g) => g.id).filter((g) => genres[g] === undefined)

  // Páginas sorteadas: cada rodada traz títulos diferentes
  const [seu, descoberta, classico] = await Promise.all([
    Promise.all([1, 2].map(() => discover(kind, { withGenres: liked, withoutGenres: disliked, page: randomPage(4) }))),
    Promise.all([1, 2].map(() => discover(kind, { withGenres: unmarked, withoutGenres: disliked, page: randomPage(4) }))),
    discover(kind, { sort: 'top', withoutGenres: disliked, page: randomPage(5) }).then((l) => [l]),
  ])

  const sources = new Map<string, Source>()
  const usable = (m: Movie) =>
    !(String(m.id) in already) && // já marcou (inclusive "não vi"): não repete
    !m.genreIds.some((g) => genres[g] === -1) // ex.: vetou Anime
  const pools: Record<Source, Movie[]> = {
    seu: shuffle(uniqueMovies(liked.length ? seu : [])).filter(usable),
    descoberta: shuffle(uniqueMovies(descoberta)).filter(usable),
    classico: shuffle(uniqueMovies(classico)).filter(usable),
  }

  // Intercala as fontes seguindo o PATTERN, sem repetir títulos
  const deck: Movie[] = []
  const used = new Set<number>()
  for (let i = 0; deck.length < DECK_SIZE && Object.values(pools).some((p) => p.length); i++) {
    const want = PATTERN[i % PATTERN.length]
    const from = pools[want].length ? want : (Object.keys(pools) as Source[]).find((s) => pools[s].length)!
    const m = pools[from].shift()!
    if (used.has(m.id)) continue
    used.add(m.id)
    deck.push(m)
    sources.set(`${m.kind}:${m.id}`, from)
  }
  return { deck, sources }
}

/** Cartas no estilo Tinder: arraste para a direita (curti) ou esquerda (não curti). */
export default function MovieSwipe({ genres, ratings, onChange, saving, onBack, onDone }: Props) {
  const [tab, setTab] = useState<Kind>('movie')
  const [decks, setDecks] = useState<Record<Kind, Movie[] | null>>({ movie: null, tv: null })
  const [indexes, setIndexes] = useState<Record<Kind, number>>({ movie: 0, tv: 0 })
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(0)
  const [showInfo, setShowInfo] = useState(false)
  const start = useRef<number | null>(null)

  // De onde veio cada carta (para mostrar a etiqueta "Descoberta" etc.)
  const [sources, setSources] = useState<Map<string, Source>>(new Map())

  const [mode, setMode] = useState<'swipe' | 'catalog'>('swipe')
  const [round, setRound] = useState(0)

  /** Busca um baralho novo (o que já foi marcado, inclusive "não vi", não volta). */
  function newRound() {
    setDecks((d) => ({ ...d, [tab]: null }))
    setIndexes((ix) => ({ ...ix, [tab]: 0 }))
    setHistory([])
    setRound((n) => n + 1)
  }

  // Carrega as cartas de cada aba na primeira vez que ela é aberta (e a cada nova rodada)
  useEffect(() => {
    if (decks[tab]) return
    const kind = tab
    buildDeck(kind, genres, ratings[kind])
      .then(({ deck, sources: s }) => {
        setDecks((d) => ({ ...d, [kind]: deck }))
        setSources((old) => new Map([...old, ...s]))
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, round])

  const deck = decks[tab]
  const index = indexes[tab]
  // Conta só curti/não curti ("não vi" fica guardado, mas não é avaliação)
  const rated = [...Object.values(ratings.movie), ...Object.values(ratings.tv)].filter((x) => x.r !== 0).length
  const movie = deck?.[index]
  const nextMovie = deck?.[index + 1]
  // Enquanto a carta voa para fora: 1 = direita, -1 = esquerda, 0 = para baixo
  const [leaving, setLeaving] = useState<1 | -1 | 0 | null>(null)

  // Histórico para o "Desfazer": o que havia antes de cada resposta
  const [history, setHistory] = useState<{ kind: Kind; id: number; prev?: Rating }[]>([])

  function answer(r: 1 | -1 | 0) {
    if (!movie || leaving !== null) return
    setHistory((h) => [...h, { kind: movie.kind, id: movie.id, prev: ratings[movie.kind][movie.id] }])
    // Guarda título e pôster para dar para revisar depois
    // Guarda também o "não vi" (r = 0): não volta mais no swipe e conta como
    // um leve desinteresse. Título e pôster ficam salvos para dar para revisar.
    onChange({
      ...ratings,
      [movie.kind]: { ...ratings[movie.kind], [movie.id]: { r, g: movie.genreIds, t: movie.title, p: movie.posterPath } },
    })
    setLeaving(r)
    setTimeout(() => {
      setLeaving(null)
      setDrag(0)
      setShowInfo(false)
      setIndexes((ix) => ({ ...ix, [tab]: ix[tab] + 1 }))
    }, FLY_MS)
  }

  /** Volta a última carta e desfaz a resposta dada a ela. */
  function undo() {
    const last = history[history.length - 1]
    if (!last || leaving !== null) return
    const map = { ...ratings[last.kind] }
    if (last.prev) map[last.id] = last.prev
    else delete map[last.id]
    onChange({ ...ratings, [last.kind]: map })
    setHistory((h) => h.slice(0, -1))
    setTab(last.kind)
    setDrag(0)
    setShowInfo(false)
    setIndexes((ix) => ({ ...ix, [last.kind]: Math.max(0, ix[last.kind] - 1) }))
  }

  // Posição da carta: seguindo o dedo, ou voando para fora
  const cardTransform =
    leaving === 1
      ? 'translateX(150%) rotate(28deg)'
      : leaving === -1
        ? 'translateX(-150%) rotate(-28deg)'
        : leaving === 0
          ? 'translateY(110%) scale(0.9)'
          : `translateX(${drag}px) rotate(${drag / 20}deg)`
  const stampLike = leaving === 1 || (leaving === null && drag > 30)
  const stampNope = leaving === -1 || (leaving === null && drag < -30)

  // Teclado: ← não curti, → curti, ↓ não vi
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (mode !== 'swipe') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo()
      else if (e.key === 'ArrowRight') answer(1)
      else if (e.key === 'ArrowLeft') answer(-1)
      else if (e.key === 'ArrowDown') answer(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <section className="stack">
      <div className="row between">
        <button className="btn small ghost" type="button" onClick={onBack}>← Seus títulos</button>
        <span className="step-label">Etapa 3 de 3 · Avaliar</span>
      </div>
      <div className="row between">
        <h2>Já viu esses?</h2>
        <span className="tag">{rated} avaliado{rated === 1 ? '' : 's'}</span>
      </div>
      <div className="mode-switch" role="tablist" aria-label="Jeito de avaliar">
        <button type="button" role="tab" aria-selected={mode === 'swipe'} className={mode === 'swipe' ? 'active' : ''} onClick={() => setMode('swipe')}>
          🃏 Swipe
        </button>
        <button type="button" role="tab" aria-selected={mode === 'catalog'} className={mode === 'catalog' ? 'active' : ''} onClick={() => setMode('catalog')}>
          🗂️ Catálogo
        </button>
      </div>
      <KindTabs
        value={tab}
        onChange={(k) => {
          setTab(k)
          setDrag(0)
          setShowInfo(false)
        }}
      />
      {mode === 'catalog' ? (
        <CatalogGrid key={tab} kind={tab} ratings={ratings} onChange={onChange} />
      ) : (
      <>
      <p className="muted small">
        Arraste para a <b className="like">direita ♥</b> se curtiu ou para a <b className="dislike">esquerda ✕</b> se não.
      </p>

      {error && <p className="error">{error}</p>}
      {!deck && !error && <div className="swipe-card skeleton" aria-label="Buscando filmes" />}

      {deck && movie && (
        <>
          <div className="swipe-stack">
          {/* Próxima carta, esperando por baixo */}
          {nextMovie && (
            <div className={`swipe-card behind ${leaving !== null ? 'rising' : ''}`} aria-hidden="true">
              {(nextMovie.posterLarge ?? nextMovie.poster) && <img src={nextMovie.posterLarge ?? nextMovie.poster!} alt="" draggable={false} />}
            </div>
          )}
          <div
            key={`${movie.kind}:${movie.id}`}
            className={`swipe-card top ${leaving !== null ? 'leaving' : ''}`}
            style={{ transform: cardTransform, opacity: leaving !== null ? 0 : 1 }}
            onPointerDown={(e) => {
              if (leaving !== null) return
              start.current = e.clientX
              ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            }}
            onPointerMove={(e) => start.current !== null && setDrag(e.clientX - start.current)}
            onPointerUp={() => {
              start.current = null
              if (drag > SWIPE_DISTANCE) answer(1)
              else if (drag < -SWIPE_DISTANCE) answer(-1)
              else setDrag(0)
            }}
            onPointerCancel={() => {
              start.current = null
              setDrag(0)
            }}
          >
            {stampLike && <span className="stamp like-stamp">CURTI</span>}
            {stampNope && <span className="stamp dislike-stamp">NÃO CURTI</span>}
            {(movie.posterLarge ?? movie.poster) && <img src={movie.posterLarge ?? movie.poster!} alt="" draggable={false} />}
            <div className="swipe-overlay">
              {SOURCE_LABEL[sources.get(`${movie.kind}:${movie.id}`) ?? 'seu'] && (
                <span className="source-tag">{SOURCE_LABEL[sources.get(`${movie.kind}:${movie.id}`) ?? 'seu']}</span>
              )}
              <h3>{movie.title} <span className="year">{movie.year}</span></h3>
              <p className="small">
                ⭐ {movie.rating.toFixed(1)} · {movie.genreIds.map((g) => genreById.get(g)?.name).filter(Boolean).slice(0, 3).join(' · ')}
              </p>
              {showInfo && <p className="small overview">{movie.overview}</p>}
            </div>
            <button
              type="button"
              className="info-btn"
              aria-label={showInfo ? 'Esconder sinopse' : 'Ver sinopse'}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setShowInfo((s) => !s)}
            >
              {showInfo ? '✕' : 'i'}
            </button>
          </div>
          </div>

          <div className="swipe-actions">
            <button
              type="button"
              className="round undo-btn"
              onClick={undo}
              disabled={history.length === 0}
              aria-label="Desfazer a última resposta"
              title="Desfazer"
            >
              ↩
            </button>
            <button type="button" className="round dislike-btn" onClick={() => answer(-1)} aria-label="Não curti">✕</button>
            <button type="button" className="round small-round" onClick={() => answer(0)} aria-label="Não vi">
              <span>🙈</span>
              <span className="round-label">não vi</span>
            </button>
            <button type="button" className="round like-btn" onClick={() => answer(1)} aria-label="Curti">♥</button>
          </div>
        </>
      )}

      {deck && !movie && (
        <div className="card center">
          <p>Acabaram {tab === 'movie' ? 'os filmes' : 'as séries'} desta rodada 🎉</p>
          {tab === 'movie' && (
            <button type="button" className="btn small" onClick={() => setTab('tv')}>Avaliar séries →</button>
          )}
          <p className="muted small">Você avaliou {rated}. Pode salvar, ou continuar:</p>
          <div className="row center-row">
            <button type="button" className="btn small" onClick={newRound}>🔄 Nova rodada</button>
            <button type="button" className="btn small" onClick={() => setMode('catalog')}>🗂️ Ver catálogo</button>
          </div>
          {history.length > 0 && (
            <button type="button" className="btn small ghost" onClick={undo}>↩ Desfazer a última</button>
          )}
        </div>
      )}
      </>
      )}

      <div>
        <button
          className={`btn big ${deck && !movie ? 'primary' : ''}`}
          type="button"
          disabled={saving}
          onClick={onDone}
        >
          {saving ? 'Salvando…' : rated === 0 ? 'Pular esta etapa e salvar' : `Concluir e salvar (${rated})`}
        </button>
      </div>
    </section>
  )
}
