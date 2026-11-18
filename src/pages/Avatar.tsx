import type { Member } from '../lib/room'

// Cores bem distintas entre si para cada pessoa da sala
const COLORS = ['#ff4f6d', '#ffb347', '#3ecf8e', '#4fa3ff', '#b47bff', '#ff7ac6', '#2fd3d3', '#f5d547']

/** Cor fixa de cada pessoa (calculada a partir do id). */
export function memberColor(member: Pick<Member, 'id'>): string {
  let h = 0
  for (const c of member.id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

export function Avatar({ member, size = 32 }: { member: Pick<Member, 'id' | 'name'>; size?: number }) {
  return (
    <span
      className="avatar"
      title={member.name}
      style={{ width: size, height: size, fontSize: size * 0.42, background: memberColor(member) }}
    >
      {member.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Avatares sobrepostos, estilo "Blend" do Spotify. */
export function AvatarStack({ members, size = 40 }: { members: Member[]; size?: number }) {
  return (
    <span className="avatar-stack">
      {members.map((m) => (
        <Avatar key={m.id} member={m} size={size} />
      ))}
    </span>
  )
}
