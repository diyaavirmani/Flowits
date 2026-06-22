import type { DiversionPlan } from '../types'

interface DiversionCardProps {
  diversion: DiversionPlan
}

export default function DiversionCard({ diversion }: DiversionCardProps) {
  return (
    <section className="border-t-4 border-ink pt-5">
      <h2 className="text-xl font-bold mb-4">Traffic diversion</h2>

      <dl className="border-t border-mid mb-4">
        <div className="flex justify-between gap-4 py-3 border-b border-mid">
          <dt className="text-ink-secondary">Blocked junction</dt>
          <dd className="font-bold text-right">
            <span className="bg-tag-red-bg text-tag-red-text font-bold text-xs uppercase tracking-wide px-2 py-1">
              {diversion.blocked_junction}
            </span>
          </dd>
        </div>
      </dl>

      {diversion.has_diversion ? (
        <>
          <p className="font-bold mb-2">Recommended reroute</p>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {diversion.route.map((stop, index) => (
              <span key={`${stop}-${index}`} className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold px-2 py-1 border-2 ${
                    index === 0 || index === diversion.route.length - 1
                      ? 'bg-blue text-white border-blue'
                      : 'bg-white text-ink border-ink'
                  }`}
                >
                  {stop}
                </span>
                {index < diversion.route.length - 1 && <span aria-hidden="true">→</span>}
              </span>
            ))}
          </div>

          <dl className="border-t border-mid">
            <div className="flex justify-between gap-4 py-3 border-b border-mid">
              <dt className="text-ink-secondary">Direct route time</dt>
              <dd className="font-bold tabular-nums">{diversion.direct_minutes} min</dd>
            </div>
            <div className="flex justify-between gap-4 py-3 border-b border-mid">
              <dt className="text-ink-secondary">Via diversion</dt>
              <dd className="font-bold tabular-nums">{diversion.detour_minutes} min</dd>
            </div>
            <div className="flex justify-between gap-4 py-3 border-b border-mid">
              <dt className="text-ink-secondary">Added delay</dt>
              <dd className="font-bold tabular-nums">
                <span className="bg-tag-orange-bg text-tag-orange-text px-2 py-1 text-xs uppercase tracking-wide">
                  +{diversion.added_minutes} min
                </span>
              </dd>
            </div>
          </dl>
        </>
      ) : null}

      <p className="text-sm text-ink-secondary mt-4 border-l-4 border-mid pl-4 py-1">{diversion.note}</p>
    </section>
  )
}
