import { GENRES } from './genres'
import type { GenrePrefs, Member } from './room'

/**
 * Compatibilidade entre duas pessoas (0–100), pela similaridade de cosseno
 * dos vetores de gosto (+1 gosto, -1 não curto, 0 tanto faz).
 * 100 = gostos idênticos, 50 = sem relação, 0 = opostos.
 */
export function pairCompatibility(a: GenrePrefs, b: GenrePrefs): number {
  let dot = 0, na = 0, nb = 0
  for (const g of GENRES) {
    const x = a[g.id] ?? 0
    const y = b[g.id] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (na === 0 || nb === 0) return 50
  const cos = dot / Math.sqrt(na * nb)
  return Math.round(((cos + 1) / 2) * 100)
}

/** Compatibilidade do grupo = média de todos os pares. */
export function groupCompatibility(members: Member[]): number | null {
  if (members.length < 2) return null
  let sum = 0, n = 0
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++) {
      sum += pairCompatibility(members[i].genres, members[j].genres)
      n++
    }
  return Math.round(sum / n)
}

export type GenreScore = { id: number; score: number; vetoed: boolean }

/**
 * Nota de cada gênero para o grupo (0–100). Regra "ninguém fica de fora":
 * se alguém não curte o gênero, ele é vetado e vai para o fim da lista.
 */
export function rankGenres(members: Member[]): GenreScore[] {
  return GENRES.map((g) => {
    const votes = members.map((m) => m.genres[g.id] ?? 0)
    const vetoed = votes.some((v) => v === -1)
    const likes = votes.filter((v) => v === 1).length
    const score = members.length ? Math.round((likes / members.length) * 100) : 0
    return { id: g.id, score, vetoed }
  }).sort((a, b) => Number(a.vetoed) - Number(b.vetoed) || b.score - a.score)
}
