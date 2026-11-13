// IDs oficiais de gêneros da TMDB — assim, quando integrarmos a API,
// os gostos já batem direto com os filmes.
export type Genre = { id: number; name: string; emoji: string }

export const GENRES: Genre[] = [
  { id: 28, name: 'Ação', emoji: '💥' },
  { id: 12, name: 'Aventura', emoji: '🧭' },
  { id: 16, name: 'Animação', emoji: '🎨' },
  { id: 35, name: 'Comédia', emoji: '😂' },
  { id: 80, name: 'Crime', emoji: '🕵️' },
  { id: 99, name: 'Documentário', emoji: '🎥' },
  { id: 18, name: 'Drama', emoji: '🎭' },
  { id: 10751, name: 'Família', emoji: '👨‍👩‍👧' },
  { id: 14, name: 'Fantasia', emoji: '🐉' },
  { id: 36, name: 'História', emoji: '🏛️' },
  { id: 27, name: 'Terror', emoji: '👻' },
  { id: 10402, name: 'Musical', emoji: '🎵' },
  { id: 9648, name: 'Mistério', emoji: '🔍' },
  { id: 10749, name: 'Romance', emoji: '💘' },
  { id: 878, name: 'Ficção científica', emoji: '🚀' },
  { id: 53, name: 'Suspense', emoji: '😰' },
  { id: 10752, name: 'Guerra', emoji: '🪖' },
  { id: 37, name: 'Faroeste', emoji: '🤠' },
]

export const genreById = new Map(GENRES.map((g) => [g.id, g]))
