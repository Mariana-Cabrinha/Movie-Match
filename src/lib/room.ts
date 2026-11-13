// Salas e participantes.
// - Com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env → salva na nuvem
//   (Supabase) e cada pessoa entra pelo link no próprio aparelho, ao vivo.
// - Sem essas chaves → modo local: salva só neste navegador (bom para testar).

import { supabase } from './supabase'

/** 1 = gosto, -1 = não curto. Gêneros ausentes = tanto faz. */
export type GenrePrefs = Record<number, 1 | -1>

export type Member = { id: string; name: string; genres: GenrePrefs }
export type Room = { id: string; members: Member[] }

export const isCloud = supabase !== null

function randomId(len: number) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789' // sem caracteres ambíguos
  let out = ''
  for (const b of crypto.getRandomValues(new Uint8Array(len))) out += chars[b % chars.length]
  return out
}

/* ------------------------------------------------------------------ */
/* "Quem sou eu" em cada sala (para marcar "você" na lista)            */
/* ------------------------------------------------------------------ */

const MINE = (roomId: string) => `movie-match:mine:${roomId}`

export function myMemberIds(roomId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(MINE(roomId)) ?? '[]')
  } catch {
    return []
  }
}

function rememberMine(roomId: string, memberId: string) {
  try {
    const ids = new Set(myMemberIds(roomId))
    ids.add(memberId)
    localStorage.setItem(MINE(roomId), JSON.stringify([...ids]))
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

/* ------------------------------------------------------------------ */
/* Modo local (localStorage)                                           */
/* ------------------------------------------------------------------ */

const LOCAL = (id: string) => `movie-match:room:${id}`

function localGet(id: string): Room | null {
  try {
    const raw = localStorage.getItem(LOCAL(id))
    return raw ? (JSON.parse(raw) as Room) : null
  } catch {
    return null
  }
}

function localSave(room: Room) {
  try {
    localStorage.setItem(LOCAL(room.id), JSON.stringify({ id: room.id, members: room.members }))
  } catch {
    /* sem armazenamento */
  }
  window.dispatchEvent(new CustomEvent('movie-match:local-change', { detail: room.id }))
}

/* ------------------------------------------------------------------ */
/* API usada pelas telas                                               */
/* ------------------------------------------------------------------ */

export async function createRoom(): Promise<Room> {
  const room: Room = { id: randomId(6), members: [] }
  if (supabase) {
    const { error } = await supabase.from('rooms').insert({ id: room.id })
    if (error) throw new Error(`Não foi possível criar a sala: ${error.message}`)
  } else {
    localSave(room)
  }
  return room
}

/** Retorna a sala com seus participantes, ou null se o código não existir. */
export async function fetchRoom(id: string): Promise<Room | null> {
  if (!supabase) return localGet(id)

  const [roomRes, membersRes] = await Promise.all([
    supabase.from('rooms').select('id').eq('id', id).maybeSingle(),
    supabase.from('members').select('id, name, genres').eq('room_id', id).order('updated_at'),
  ])
  if (roomRes.error) throw new Error(roomRes.error.message)
  if (membersRes.error) throw new Error(membersRes.error.message)
  if (!roomRes.data) return null
  return { id, members: (membersRes.data ?? []) as Member[] }
}

export async function upsertMember(
  roomId: string,
  member: Omit<Member, 'id'> & { id?: string },
): Promise<Member> {
  const full: Member = { ...member, id: member.id ?? randomId(10) }

  if (supabase) {
    const { error } = await supabase.from('members').upsert({
      id: full.id,
      room_id: roomId,
      name: full.name,
      genres: full.genres,
      updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(`Não foi possível salvar: ${error.message}`)
  } else {
    const room = localGet(roomId) ?? { id: roomId, members: [] }
    const i = room.members.findIndex((m) => m.id === full.id)
    if (i >= 0) room.members[i] = full
    else room.members.push(full)
    localSave(room)
  }

  if (!member.id) rememberMine(roomId, full.id)
  return full
}

export async function removeMember(roomId: string, memberId: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from('members').delete().eq('id', memberId)
    if (error) throw new Error(`Não foi possível remover: ${error.message}`)
  } else {
    const room = localGet(roomId)
    if (!room) return
    room.members = room.members.filter((m) => m.id !== memberId)
    localSave(room)
  }
}

/** Chama onChange sempre que alguém entra, edita ou sai da sala. Retorna a função para parar. */
export function subscribeRoom(roomId: string, onChange: () => void): () => void {
  if (supabase) {
    const client = supabase
    const channel = client
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `room_id=eq.${roomId}` },
        () => onChange(),
      )
      .subscribe()
    return () => {
      client.removeChannel(channel)
    }
  }

  // Modo local: mudanças nesta aba e em outras abas do mesmo navegador
  const onLocal = (e: Event) => {
    if ((e as CustomEvent).detail === roomId) onChange()
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCAL(roomId)) onChange()
  }
  window.addEventListener('movie-match:local-change', onLocal)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener('movie-match:local-change', onLocal)
    window.removeEventListener('storage', onStorage)
  }
}
