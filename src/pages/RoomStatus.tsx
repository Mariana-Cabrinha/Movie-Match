import { Link } from 'react-router-dom'

/** Telas de "carregando", "sala não encontrada" e erro, compartilhadas. */
export function RoomStatus({ status, message }: { status: 'loading' | 'notFound' | 'error'; message?: string }) {
  if (status === 'loading') return <p className="muted center-text">Carregando sala…</p>
  return (
    <section className="stack center">
      <h2>{status === 'notFound' ? 'Sala não encontrada 🤔' : 'Algo deu errado'}</h2>
      <p className="muted">
        {status === 'notFound' ? 'Confira o código ou o link que te mandaram.' : message}
      </p>
      <Link className="btn" to="/">Voltar ao início</Link>
    </section>
  )
}
