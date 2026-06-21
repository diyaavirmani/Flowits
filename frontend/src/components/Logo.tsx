// FLOWITS logo mark — brutalist rebuild of the app icon:
// an ink app-tile carrying a system gear with a verified (check) badge.
// Monochrome ink + paper + the orange accent, sharp-edged to match the design.

export default function Logo({ size = 36 }: { size?: number }) {
  const ink = '#0A0A0A'
  const paper = '#F2F1EA'
  const accent = '#ea580c'

  // 8 gear teeth as short radial strokes around the hub
  const cx = 17
  const cy = 17
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const r1 = 6.4
    const r2 = 9.2
    return (
      <line
        key={i}
        x1={cx + Math.cos(a) * r1}
        y1={cy + Math.sin(a) * r1}
        x2={cx + Math.cos(a) * r2}
        y2={cy + Math.sin(a) * r2}
        stroke={paper}
        strokeWidth={2.2}
        strokeLinecap="square"
      />
    )
  })

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="FLOWITS logo">
      {/* App tile */}
      <rect x={0.5} y={0.5} width={39} height={39} fill={ink} stroke={ink} />
      {/* Gear */}
      {teeth}
      <circle cx={cx} cy={cy} r={6.4} fill="none" stroke={paper} strokeWidth={2.4} />
      <circle cx={cx} cy={cy} r={2.2} fill={paper} />
      {/* Verified badge */}
      <circle cx={29} cy={29} r={7} fill={accent} stroke={ink} strokeWidth={2} />
      <path
        d="M25.8 29 l2.2 2.2 l4 -4.6"
        fill="none"
        stroke={paper}
        strokeWidth={2.2}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  )
}
