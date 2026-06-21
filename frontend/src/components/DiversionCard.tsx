import type { DiversionPlan } from '../types'

interface DiversionCardProps {
  diversion: DiversionPlan
}

export default function DiversionCard({ diversion }: DiversionCardProps) {
  return (
    <div className="border-2 border-foreground bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          diversion.route
        </span>
        <span className="h-2 w-2 bg-[#ea580c]" />
      </div>

      {/* Blocked junction */}
      <div className="flex items-center justify-between border-b-2 border-foreground px-5 py-3">
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          Blocked Junction
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 bg-destructive" />
          <span className="text-sm font-bold uppercase tracking-tight">
            {diversion.blocked_junction}
          </span>
        </span>
      </div>

      {diversion.has_diversion ? (
        <>
          {/* Reroute chain */}
          <div className="px-5 py-4 border-b-2 border-foreground">
            <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
              Recommended Reroute
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {diversion.route.map((stop, index) => (
                <span key={`${stop}-${index}`} className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 border-2 border-foreground ${
                      index === 0 || index === diversion.route.length - 1
                        ? 'bg-[#ea580c] text-background'
                        : 'bg-background text-foreground'
                    }`}
                  >
                    {stop}
                  </span>
                  {index < diversion.route.length - 1 && (
                    <span className="text-foreground font-bold">→</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Travel-time comparison */}
          <div className="grid grid-cols-3 border-b-2 border-foreground">
            <div className="border-r-2 border-foreground px-4 py-4 text-center">
              <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
                Direct
              </p>
              <p className="font-mono text-xl font-bold tabular-nums">
                {diversion.direct_minutes}
                <span className="text-xs font-normal text-muted-foreground"> min</span>
              </p>
            </div>
            <div className="border-r-2 border-foreground px-4 py-4 flex flex-col items-center justify-center">
              <span className="bg-[#ea580c] text-background text-[10px] font-bold tracking-[0.15em] uppercase px-2 py-1">
                +{diversion.added_minutes} min
              </span>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
                Via Detour
              </p>
              <p className="font-mono text-xl font-bold tabular-nums">
                {diversion.detour_minutes}
                <span className="text-xs font-normal text-muted-foreground"> min</span>
              </p>
            </div>
          </div>
        </>
      ) : null}

      {/* Note */}
      <div className="px-4 py-3">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="text-[#ea580c] font-bold">* </span>
          {diversion.note}
        </p>
      </div>
    </div>
  )
}
