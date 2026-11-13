import { Link, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import RoomPage from './pages/Room'
import Tastes from './pages/Tastes'
import Blend from './pages/Blend'

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="logo">🎬 Movie Match</Link>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/s/:roomId" element={<RoomPage />} />
          <Route path="/s/:roomId/gostos" element={<Tastes />} />
          <Route path="/s/:roomId/blend" element={<Blend />} />
          <Route path="*" element={<p>Página não encontrada. <Link to="/">Voltar</Link></p>} />
        </Routes>
      </main>
    </div>
  )
}
