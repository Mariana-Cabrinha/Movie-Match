import { useCallback, useEffect, useState } from 'react'
import { fetchRoom, subscribeRoom, type Room } from './room'

type State =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error'; message: string }
  | { status: 'ready'; room: Room }

/** Carrega a sala e mantém atualizada ao vivo. */
export function useRoom(roomId: string) {
  const [state, setState] = useState<State>({ status: 'loading' })

  const reload = useCallback(async () => {
    try {
      const room = await fetchRoom(roomId)
      setState(room ? { status: 'ready', room } : { status: 'notFound' })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [roomId])

  useEffect(() => {
    setState({ status: 'loading' })
    reload()
    return subscribeRoom(roomId, reload)
  }, [roomId, reload])

  return { state, reload }
}
