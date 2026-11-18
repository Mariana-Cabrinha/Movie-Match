import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom } from '../lib/room'
import { hasTmdb, trending, type Movie } from '../lib/tmdb'

/** Três pôsteres em leque, com filmes em alta na semana. */
function PosterFan() {
  const [movies, setMovies] = useState<Movie[]>([])
  useEffect(() => {
    if (hasTmdb) trending().then((m) => setMovies(m.slice(0, 3))).catch(() => {})
  }, [])

  return (
    <div className="poster-fan" aria-hidden="true">
      {[0, 1, 2].map((i) =>
        movies[i]?.poster ? (
          <img key={i} src={movies[i].poster!} alt="" className={`fan-${i}`} />
        ) : (
          <div key={i} className={`fan-${i} fan-empty`}>🎬</div>
        ),
      )}
      <span className="fan-heart">💘</span>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setBusy(true)
    setError(null)
    try {
      const room = await createRoom()
      navigate(`/s/${room.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <section className="stack center">
      <PosterFan />
      <h1 className="hero">Qual filme dá <span className="accent">match</span> com todo mundo?</h1>
      <p className="muted">Junte o grupo, cada um conta o que curte e a gente acha o filme que agrada geral.</p>

      <button className="btn primary big" onClick={handleCreate} disabled={busy}>
        {busy ? 'Criando…' : 'Criar sala'}
      </button>
      {error && <p className="error">{error}</p>}

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          const c = code.trim().toLowerCase()
          if (c) navigate(`/s/${c}`)
        }}
      >
        <input
          className="input"
          placeholder="Tem um código? Ex.: ab12cd"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Código da sala"
        />
        <button className="btn" type="submit">Entrar</button>
      </form>

      <ol className="steps">
        <li><span>1</span><div><b>Crie uma sala</b><p className="muted small">e mande o link pro grupo</p></div></li>
        <li><span>2</span><div><b>Cada um escolhe</b><p className="muted small">gêneros e filmes que curtiu ou não</p></div></li>
        <li><span>3</span><div><b>Vejam o blend</b><p className="muted small">o % de compatibilidade e o que assistir</p></div></li>
      </ol>
    </section>
  )
}
