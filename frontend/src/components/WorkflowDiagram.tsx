// FLOWITS pipeline: data in (event, location, history) -> model -> the brief's
// three outputs (severity, deploy, divert), with a feedback loop that learns.
// Clean panel, no dotted background. Pure SVG + SMIL.

const LEFT = ['EVENT', 'LOCATION', 'HISTORY']
const RIGHT = ['SEVERITY', 'DEPLOY', 'DIVERT']
const cx = 400
const cy = 100
const rowY = (i: number) => 30 + i * 60 + 13

function Pill({ label, x, y }: { label: string; x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={90} height={26} rx={13} fill="#ffffff" stroke="#1a1a1a" strokeWidth={1.4} />
      <text x={x + 45} y={y + 17} textAnchor="middle" fill="#1a1a1a" fontSize={9.5} fontFamily="Inter, sans-serif" fontWeight={600} letterSpacing="0.08em">
        {label}
      </text>
    </g>
  )
}

export default function WorkflowDiagram() {
  return (
    <svg viewBox="0 0 800 250" className="w-full h-auto" role="img" aria-label="FLOWITS pipeline">
      {LEFT.map((_, i) => (
        <line key={`ll${i}`} x1={cx - 40} y1={cy} x2={150} y2={rowY(i)} stroke="#cfccc3" strokeWidth={1} />
      ))}
      {RIGHT.map((_, i) => (
        <line key={`rl${i}`} x1={cx + 40} y1={cy} x2={650} y2={rowY(i)} stroke="#cfccc3" strokeWidth={1} />
      ))}

      <path id="learn-loop" d="M 650 163 C 690 232, 430 236, 400 138" fill="none" stroke="#ea580c" strokeWidth={1.4} strokeDasharray="4 4" opacity={0.6} />

      {LEFT.map((_, i) => (
        <circle key={`lp${i}`} r={3} fill="#ea580c">
          <animate attributeName="cx" values={`150;${cx - 40}`} dur="1.8s" begin={`${0.4 + i * 0.45}s`} repeatCount="indefinite" />
          <animate attributeName="cy" values={`${rowY(i)};${cy}`} dur="1.8s" begin={`${0.4 + i * 0.45}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0" dur="1.8s" begin={`${0.4 + i * 0.45}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {RIGHT.map((_, i) => (
        <circle key={`rp${i}`} r={3} fill="#ea580c">
          <animate attributeName="cx" values={`${cx + 40};650`} dur="1.8s" begin={`${1.4 + i * 0.45}s`} repeatCount="indefinite" />
          <animate attributeName="cy" values={`${cy};${rowY(i)}`} dur="1.8s" begin={`${1.4 + i * 0.45}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0" dur="1.8s" begin={`${1.4 + i * 0.45}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <circle r={3} fill="#ea580c">
        <animateMotion dur="2.6s" begin="2.6s" repeatCount="indefinite">
          <mpath href="#learn-loop" />
        </animateMotion>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur="2.6s" begin="2.6s" repeatCount="indefinite" />
      </circle>
      <g>
        <rect x={476} y={218} width={56} height={16} fill="#f6f5f1" />
        <text x={504} y={230} textAnchor="middle" fill="#ea580c" fontSize={9} fontFamily="Inter, sans-serif" fontWeight={700} letterSpacing="0.18em">
          LEARN
        </text>
      </g>

      {LEFT.map((label, i) => (
        <Pill key={`l${label}`} label={label} x={58} y={30 + i * 60} />
      ))}
      {RIGHT.map((label, i) => (
        <Pill key={`r${label}`} label={label} x={652} y={30 + i * 60} />
      ))}

      <g>
        <rect x={cx - 34} y={cy - 34} width={68} height={68} rx={10} fill="#fff1e9" stroke="#1a1a1a" strokeWidth={1.4} />
        <line x1={cx} y1={cy - 17} x2={cx} y2={cy + 17} stroke="#1a1a1a" strokeWidth={3} />
        <line x1={cx - 17} y1={cy} x2={cx + 17} y2={cy} stroke="#1a1a1a" strokeWidth={3} />
        <line x1={cx - 11} y1={cy - 11} x2={cx + 11} y2={cy + 11} stroke="#1a1a1a" strokeWidth={2} />
        <line x1={cx + 11} y1={cy - 11} x2={cx - 11} y2={cy + 11} stroke="#1a1a1a" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={28} fill="none" stroke="#ea580c" strokeWidth={1}>
          <animate attributeName="r" values="28;32;28" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.15;0.6" dur="3s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  )
}
