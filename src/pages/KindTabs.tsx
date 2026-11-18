import type { Kind } from '../lib/tmdb'

const LABELS: Record<Kind, string> = { movie: '🎬 Filmes', tv: '📺 Séries' }

/** Abas "Filmes | Séries". */
export default function KindTabs({ value, onChange }: { value: Kind; onChange: (k: Kind) => void }) {
  return (
    <div className="kind-tabs" role="tablist">
      {(['movie', 'tv'] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={value === k}
          className={value === k ? 'active' : ''}
          onClick={() => onChange(k)}
        >
          {LABELS[k]}
        </button>
      ))}
    </div>
  )
}
