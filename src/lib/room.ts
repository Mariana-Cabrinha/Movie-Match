// Armazenamento das salas.
// POR ENQUANTO fica só no navegador (localStorage): dá para testar com várias
// pessoas no MESMO aparelho ("passa o celular"). No próximo passo trocamos
// isto por um banco na nuvem (ex.: Supabase) para funcionar pelo link.

/** 1 = gosto, -1 = não curto. Gêneros ausentes = tanto faz. */
export type GenrePrefs = Record<number, 1 | -1>

export type Member = { id: string; name: string; genres: GenrePrefs }
export type Room = { id: string; createdAt: number; members: Member[] }

const KEY = (id: string) => `movie-match:room:${id}`

function randomId(len: number) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789' // sem caracteres ambíguos
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  for (const b of bytes) out += chars[b % chars.length]
  return out
}

export function createRoom(): Room {
  const room: Room = { id: randomId(6), createdAt: Date.now(), members: [] }
  saveRoom(room)
  return room
}

export function getRoom(id: string): Room | null {
  try {
    const raw = localStorage.getItem(KEY(id))
    return raw ? (JSON.parse(raw) as Room) : null
  } catch {
    return null
  }
}

export function getOrCreateRoom(id: string): Room {
  const room = getRoom(id) ?? { id, createdAt: Date.now(), members: [] }
  saveRoom(room)
  return room
}

function saveRoom(room: Room) {
  try {
    localStorage.setItem(KEY(room.id), JSON.stringify(room))
  } catch {
    /* navegador sem armazenamento: segue só em memória */
  }
}

export function upsertMember(roomId: string, member: Omit<Member, 'id'> & { id?: string }): Member {
  const room = getOrCreateRoom(roomId)
  const full: Member = { ...member, id: member.id ?? randomId(8) }
  const i = room.members.findIndex((m) => m.id === full.id)
  if (i >= 0) room.members[i] = full
  else room.members.push(full)
  saveRoom(room)
  return full
}

export function removeMember(roomId: string, memberId: string) {
  const room = getOrCreateRoom(roomId)
  room.members = room.members.filter((m) => m.id !== memberId)
  saveRoom(room)
}
