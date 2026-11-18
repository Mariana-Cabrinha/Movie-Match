import { useEffect, useRef, useState } from 'react'

const DURATION = 1600 // ms do 0 até o valor final
const CONFETTI_FROM = 70 // % a partir do qual tem comemoração
const PIECES = ['🍿', '💖', '🎬', '✨', '🍿', '💞', '⭐', '🎉']

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Anel com o % subindo de 0 até o valor, frase no final e confete se for alto. */
export default function BlendReveal({ pct, verdict }: { pct: number; verdict: string }) {
  const reduced = prefersReducedMotion()
  const [shown, setShown] = useState(reduced ? pct : 0)
  const [done, setDone] = useState(reduced)
  const from = useRef(reduced ? pct : 0)

  useEffect(() => {
    if (reduced) {
      setShown(pct)
      setDone(true)
      return
    }
    // Anima a partir do valor atual (ex.: alguém entrou na sala e o % mudou)
    const start = performance.now()
    const begin = from.current
    let frame = 0
    setDone(false)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      const eased = 1 - Math.pow(1 - t, 3) // desacelera no final
      const value = Math.round(begin + (pct - begin) * eased)
      setShown(value)
      from.current = value
      if (t < 1) frame = requestAnimationFrame(tick)
      else {
        clearTimeout(fallback)
        setDone(true)
      }
    }
    frame = requestAnimationFrame(tick)
    // Garantia: se o navegador pausar a animação (aba em segundo plano, etc.),
    // mostra o valor final mesmo assim
    const fallback = setTimeout(() => {
      cancelAnimationFrame(frame)
      setShown(pct)
      from.current = pct
      setDone(true)
    }, DURATION + 400)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(fallback)
    }
  }, [pct, reduced])

  return (
    <>
      <div className="ring" style={{ ['--pct' as string]: shown }} role="img" aria-label={`${pct}% compatíveis`}>
        <span aria-hidden="true">
          {shown}%<small>compatíveis</small>
        </span>
      </div>
      <p className={`verdict ${done ? 'in' : ''}`} aria-live="polite">
        {done ? verdict : ' '}
      </p>
      {done && !reduced && pct >= CONFETTI_FROM && <Confetti />}
    </>
  )
}

function Confetti() {
  // Posições sorteadas uma vez
  const [pieces] = useState(() =>
    Array.from({ length: 26 }, (_, i) => ({
      emoji: PIECES[i % PIECES.length],
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.8 + Math.random() * 1.4,
      size: 16 + Math.random() * 14,
      drift: (Math.random() - 0.5) * 120,
    })),
  )
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            fontSize: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  )
}
