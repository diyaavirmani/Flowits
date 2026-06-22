import { useEffect, useState } from 'react'
import { analyzeEvent, getUpcomingEvents } from '../api/client'
import type {
  AllocationResponse,
  IncidentContext,
  PredictionResponse,
  UpcomingEvent,
  UpcomingEventsResponse,
} from '../types'

interface UpcomingEventsProps {
  onResult: (
    prediction: PredictionResponse,
    allocation: AllocationResponse,
    context: IncidentContext,
  ) => void
}

const causeLabel: Record<string, string> = {
  sports_event: 'Sports / IPL',
  concert: 'Concert',
  political_rally: 'Rally',
  festival: 'Festival',
  construction: 'Construction',
  accident: 'Accident',
  waterlogging: 'Waterlogging',
  vehicle_breakdown: 'Breakdown',
}

export default function UpcomingEvents({ onResult }: UpcomingEventsProps) {
  const [data, setData] = useState<UpcomingEventsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getUpcomingEvents()
      .then((res) => {
        if (active) setData(res.data)
      })
      .catch(() => {
        /* board is non-critical */
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handlePlan = async (ev: UpcomingEvent) => {
    setAnalyzing(ev.title)
    try {
      const r = await analyzeEvent(ev)
      onResult(r.prediction, r.allocation, r.context)
      document.getElementById('analysis-results')?.scrollIntoView({ behavior: 'smooth' })
    } catch {
      /* ignore */
    } finally {
      setAnalyzing(null)
    }
  }

  if (loading || !data) {
    return (
      <section className="border-t-4 border-ink pt-5 mb-10">
        <h2 className="text-xl font-bold mb-1">Upcoming events</h2>
        <p className="text-ink-secondary">Checking the live feed…</p>
      </section>
    )
  }

  const mappable = data.events.filter((e) => e.mappable)
  const rawLive = data.events.filter((e) => e.source === 'live' && !e.mappable).slice(0, 5)

  return (
    <section className="border-t-4 border-ink pt-5 mb-10">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-xl font-bold">Upcoming events</h2>
        <span className="text-sm">
          <span
            className={`font-bold text-xs uppercase tracking-wide px-2 py-1 ${
              data.live_status === 'ok'
                ? 'bg-tag-green-bg text-tag-green-text'
                : 'bg-tag-grey-bg text-tag-grey-text'
            }`}
          >
            Live feed {data.live_status === 'ok' ? 'connected' : 'unavailable'}
          </span>{' '}
          <span className="text-ink-secondary">
            {data.live_count} live · {data.curated_count} watchlist
          </span>
        </span>
      </div>
      <p className="text-ink-secondary mb-4">
        Monitored from a live news feed with a curated watchlist. Events on a supported corridor can
        be pre-planned. (Production auto-populates this from event-listing APIs.)
      </p>

      {/* Mappable — pre-plannable */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {mappable.map((ev, i) => (
          <div key={i} className="border-2 border-ink p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className={`font-bold text-xs uppercase tracking-wide px-2 py-0.5 ${
                  ev.source === 'live'
                    ? 'bg-tag-blue-bg text-tag-blue-text'
                    : 'bg-tag-grey-bg text-tag-grey-text'
                }`}
              >
                {ev.source === 'live' ? 'Live' : 'Watchlist'}
              </span>
              {ev.event_cause && (
                <span className="font-bold text-xs uppercase tracking-wide px-2 py-0.5 bg-tag-orange-bg text-tag-orange-text">
                  {causeLabel[ev.event_cause] ?? ev.event_cause}
                </span>
              )}
              {ev.planned && (
                <span className="font-bold text-xs uppercase tracking-wide px-2 py-0.5 bg-tag-blue-bg text-tag-blue-text">
                  Planned
                </span>
              )}
            </div>
            <p className="font-bold leading-snug mb-1">{ev.title}</p>
            <p className="text-sm text-ink-secondary mb-3">
              {ev.location_name}, {ev.corridor}
            </p>
            <button
              type="button"
              onClick={() => handlePlan(ev)}
              disabled={analyzing !== null}
              className="gv-button mt-auto self-start"
            >
              {analyzing === ev.title ? (
                <>
                  <span className="spinner" /> Planning…
                </>
              ) : (
                'Plan response'
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Raw live signals (not on a supported corridor) */}
      {rawLive.length > 0 && (
        <details className="border border-mid">
          <summary className="cursor-pointer select-none px-4 py-2 font-bold bg-grey-light">
            Other live signals ({rawLive.length}): location not on a supported corridor
          </summary>
          <ul className="px-4 py-2">
            {rawLive.map((ev, i) => (
              <li key={i} className="py-2 border-b border-mid last:border-0 text-sm">
                {ev.event_cause && (
                  <span className="font-bold text-xs uppercase tracking-wide px-1.5 py-0.5 bg-tag-grey-bg text-tag-grey-text mr-2">
                    {causeLabel[ev.event_cause] ?? ev.event_cause}
                  </span>
                )}
                {ev.url ? (
                  <a href={ev.url} target="_blank" rel="noreferrer">
                    {ev.title}
                  </a>
                ) : (
                  ev.title
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
