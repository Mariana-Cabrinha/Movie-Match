/** Logo do Movie Match: dois pôsteres inclinados que formam um coração no encontro. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <rect x="10" y="14" width="24" height="34" rx="5" transform="rotate(-14 22 31)" fill="#ff4f6d" />
      <rect x="30" y="14" width="24" height="34" rx="5" transform="rotate(14 42 31)" fill="#ffb347" />
      <path
        d="M32 46 C 22 39, 22 29, 28 28 C 30.5 27.6, 32 29.5, 32 31 C 32 29.5, 33.5 27.6, 36 28 C 42 29, 42 39, 32 46 Z"
        fill="#fff"
      />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="logo-lockup">
      <LogoMark />
      <span>
        movie<b>match</b>
      </span>
    </span>
  )
}
