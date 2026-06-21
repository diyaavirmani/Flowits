// FLOWITS pipeline diagram — maps the problem statement end to end:
// historical + real-time data in, the brief's three outputs out
// (forecast severity, deploy manpower/barricades, divert traffic),
// and a feedback loop that learns from every outcome.
// Pure SVG + SMIL animation, no extra dependencies.

const LEFT_LABELS = ['EVENT', 'LOCATION', 'HISTORY']
const RIGHT_LABELS = ['SEVERITY', 'DEPLOY', 'DIVERT']

const centerX = 400
const centerY = 100

const rowY = (i: number) => 30 + i * 60 + 13 // vertical centre of pill row i

function PillLabel({ label, x, y }: { label: string; x: number; y: number }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={88}
        height={26}
        rx={13}
        fill="hsl(var(--background))"
        stroke="hsl(var(--foreground))"
        strokeWidth={1.5}
      />
      <text
        x={x + 44}
        y={y + 17}
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize={9.5}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight={600}
        letterSpacing="0.08em"
      >
        {label}
      </text>
    </g>
  )
}

export default function WorkflowDiagram() {
  return (
    <div className="relative w-full max-w-[760px] mx-auto">
      <svg
        viewBox="0 0 800 248"
        className="w-full h-auto"
        role="img"
        aria-label="FLOWITS pipeline: event, location and history data feed the model, which outputs severity, deployment and diversion, then learns from logged outcomes via a feedback loop."
      >
        {/* Connector lines: inputs -> hub */}
        {LEFT_LABELS.map((_, i) => (
          <line key={`ll-${i}`} x1={centerX - 40} y1={centerY} x2={148} y2={rowY(i)} stroke="hsl(var(--border))" strokeWidth={1} />
        ))}
        {/* Connector lines: hub -> outputs */}
        {RIGHT_LABELS.map((_, i) => (
          <line key={`rl-${i}`} x1={centerX + 40} y1={centerY} x2={652} y2={rowY(i)} stroke="hsl(var(--border))" strokeWidth={1} />
        ))}

        {/* Feedback loop path: outputs -> back into the model */}
        <path
          id="learn-loop"
          d="M 652 163 C 690 232, 430 236, 400 138"
          fill="none"
          stroke="#ea580c"
          strokeWidth={1.3}
          strokeDasharray="4 4"
          opacity={0.55}
        />

        {/* Data packets: inputs -> hub */}
        {LEFT_LABELS.map((_, i) => (
          <circle key={`lp-${i}`} r={3} fill="#ea580c">
            <animate attributeName="cx" values={`148;${centerX - 40}`} dur="1.8s" begin={`${0.4 + i * 0.45}s`} repeatCount="indefinite" />
            <animate attributeName="cy" values={`${rowY(i)};${centerY}`} dur="1.8s" begin={`${0.4 + i * 0.45}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;1;0" dur="1.8s" begin={`${0.4 + i * 0.45}s`} repeatCount="indefinite" />
          </circle>
        ))}
        {/* Data packets: hub -> outputs */}
        {RIGHT_LABELS.map((_, i) => (
          <circle key={`rp-${i}`} r={3} fill="#ea580c">
            <animate attributeName="cx" values={`${centerX + 40};652`} dur="1.8s" begin={`${1.4 + i * 0.45}s`} repeatCount="indefinite" />
            <animate attributeName="cy" values={`${centerY};${rowY(i)}`} dur="1.8s" begin={`${1.4 + i * 0.45}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;1;0" dur="1.8s" begin={`${1.4 + i * 0.45}s`} repeatCount="indefinite" />
          </circle>
        ))}
        {/* Feedback packet travelling back along the loop */}
        <circle r={3} fill="#ea580c">
          <animateMotion dur="2.6s" begin="2.6s" repeatCount="indefinite">
            <mpath href="#learn-loop" />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur="2.6s" begin="2.6s" repeatCount="indefinite" />
        </circle>

        {/* LEARN label on the loop */}
        <g>
          <rect x={476} y={218} width={56} height={16} fill="hsl(var(--background))" />
          <text x={504} y={230} textAnchor="middle" fill="#ea580c" fontSize={9} fontFamily="'JetBrains Mono', monospace" fontWeight={700} letterSpacing="0.18em">
            LEARN
          </text>
        </g>

        {/* Pill labels */}
        {LEFT_LABELS.map((label, i) => (
          <PillLabel key={`l-${label}`} label={label} x={60} y={30 + i * 60} />
        ))}
        {RIGHT_LABELS.map((label, i) => (
          <PillLabel key={`r-${label}`} label={label} x={652} y={30 + i * 60} />
        ))}

        {/* Center model hub */}
        <g>
          <rect x={centerX - 36} y={centerY - 36} width={72} height={72} fill="hsl(var(--muted))" stroke="hsl(var(--foreground))" strokeWidth={1.5} />
          {/* asterisk mark */}
          <line x1={centerX} y1={centerY - 18} x2={centerX} y2={centerY + 18} stroke="hsl(var(--foreground))" strokeWidth={3} />
          <line x1={centerX - 18} y1={centerY} x2={centerX + 18} y2={centerY} stroke="hsl(var(--foreground))" strokeWidth={3} />
          <line x1={centerX - 12} y1={centerY - 12} x2={centerX + 12} y2={centerY + 12} stroke="hsl(var(--foreground))" strokeWidth={2} />
          <line x1={centerX + 12} y1={centerY - 12} x2={centerX - 12} y2={centerY + 12} stroke="hsl(var(--foreground))" strokeWidth={2} />
          {/* slow-rotating "processing" ring */}
          <circle cx={centerX} cy={centerY} r={26} fill="none" stroke="#ea580c" strokeWidth={1} strokeDasharray="3 5" opacity={0.7}>
            <animateTransform attributeName="transform" type="rotate" from={`0 ${centerX} ${centerY}`} to={`360 ${centerX} ${centerY}`} dur="12s" repeatCount="indefinite" />
          </circle>
          {/* breathing pulse ring */}
          <circle cx={centerX} cy={centerY} r={30} fill="none" stroke="#ea580c" strokeWidth={1}>
            <animate attributeName="r" values="30;34;30" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0.15;0.6" dur="3s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    </div>
  )
}
