import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom } from '../lib/room'

export default function Home() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  return (
    <section className="stack center">
      <h1 className="hero">Qual filme dá <span className="accent">match</span> com todo mundo?</h1>
      <p className="muted">
        Crie uma sala, mande o link pro grupo, cada um escolhe o que curte — e o
        Movie Match mostra o quanto vocês são compatíveis e o que assistir juntos.
      </p>

      <button className="btn primary big" onClick={() => navigate(`/s/${createRoom().id}`)}>
        Criar sala
      </button>

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
          placeholder="Código da sala"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Código da sala"
        />
        <button className="btn" type="submit">Entrar</button>
      </form>
    </section>
  )
}
