import { useEffect, useState } from 'react'
import { getHealth } from '../api/client'

type State = 'checking' | 'active' | 'down'

// Live backend status — polls /health so the indicator reflects reality
// (model loaded + real cross-validated F1), instead of a hardcoded light.
export default function SystemStatus() {
  const [state, setState] = useState<State>('checking')
  const [f1, setF1] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    const check = async () => {
      try {
        const res = await getHealth()
        if (!active) return
        setState(res.data.model_loaded ? 'active' : 'down')
        setF1(typeof res.data.cv_f1_mean === 'number' ? res.data.cv_f1_mean : null)
      } catch {
        if (active) setState('down')
      }
    }

    check()
    const id = window.setInterval(check, 15000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  const config = {
    checking: { border: 'border-foreground', square: 'bg-muted-foreground', text: 'Connecting' },
    active: { border: 'border-foreground', square: 'bg-[#ea580c] animate-blink', text: 'Model Active' },
    down: { border: 'border-destructive', square: 'bg-destructive', text: 'Backend Offline' },
  }[state]

  return (
    <div className={`flex items-stretch border-2 ${config.border}`}>
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className={`h-2 w-2 ${config.square}`} />
        <span className="text-[10px] tracking-[0.2em] uppercase font-bold whitespace-nowrap">
          {config.text}
        </span>
      </div>
      {state === 'active' && f1 !== null && (
        <div className="hidden sm:flex items-center border-l-2 border-foreground px-3 py-1.5">
          <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground tabular-nums whitespace-nowrap">
            F1 {f1.toFixed(3)}
          </span>
        </div>
      )}
    </div>
  )
}
