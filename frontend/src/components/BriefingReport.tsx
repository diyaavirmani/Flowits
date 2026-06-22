import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getCorridorProfile } from '../api/client'
import type {
  AllocationResponse,
  CorridorProfile,
  IncidentContext,
  PredictionResponse,
} from '../types'

interface BriefingReportProps {
  prediction: PredictionResponse
  allocation: AllocationResponse
  context: IncidentContext
  onClose: () => void
}

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function BriefingReport({
  prediction,
  allocation,
  context,
  onClose,
}: BriefingReportProps) {
  const [profile, setProfile] = useState<CorridorProfile | null>(null)
  const { impact } = prediction
  const generated = new Date().toLocaleString('en-GB')

  useEffect(() => {
    let active = true
    getCorridorProfile(context.corridor)
      .then((res) => {
        if (active) setProfile(res.data)
      })
      .catch(() => {
        /* chart is non-critical */
      })
    return () => {
      active = false
    }
  }, [context.corridor])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-auto">
      <div className="briefing-report bg-white max-w-[840px] mx-auto my-8 p-8 sm:p-12">
        {/* Controls (hidden when printing) */}
        <div className="no-print flex justify-end gap-3 mb-6">
          <button type="button" onClick={() => window.print()} className="gv-button">
            Print / save as PDF
          </button>
          <button type="button" onClick={onClose} className="gv-button gv-button-secondary">
            Close
          </button>
        </div>

        {/* Header */}
        <div className="border-b-4 border-ink pb-4 mb-6">
          <p className="font-bold text-ink-secondary">FLOWITS</p>
          <h1 className="text-3xl font-bold">Incident response briefing</h1>
          <p className="text-ink-secondary mt-1">
            {context.planned ? 'Planned event' : 'Unplanned incident'} · Generated {generated}
          </p>
        </div>

        {/* Event summary */}
        <h2 className="text-xl font-bold mb-3">Event</h2>
        <dl className="border-t border-mid mb-8">
          {[
            ['Type', context.planned ? 'Planned event' : 'Unplanned incident'],
            ['Event', context.eventLabel],
            ['Location', `${context.locationName}, ${context.corridor}`],
            ['Time', `${String(context.hour).padStart(2, '0')}:00, ${dayNames[context.day]}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2 border-b border-mid">
              <dt className="text-ink-secondary">{k}</dt>
              <dd className="font-bold text-right">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Impact */}
        <h2 className="text-xl font-bold mb-3">Forecast impact</h2>
        <div className="border-l-4 border-red bg-grey-light px-4 py-3 mb-3">
          <p className="text-lg font-bold">
            {impact.headline}. {impact.posture}
          </p>
          <p className="mt-1">{impact.summary}</p>
        </div>
        <p className="font-bold mb-1">Watch for</p>
        <ul className="mb-8 space-y-1">
          {impact.watch_fors.map((w, i) => (
            <li key={i} className="flex items-start gap-2">
              <span aria-hidden="true" className="text-red font-bold">
                •
              </span>
              <span>{w}</span>
            </li>
          ))}
        </ul>

        {/* Peak risk chart */}
        {profile && (
          <>
            <h2 className="text-xl font-bold mb-1">Historical risk by hour</h2>
            <p className="text-ink-secondary mb-3">
              Past incidents on {context.corridor} by time of day ({profile.total_incidents} records).
              The event hour is highlighted.
            </p>
            <div className="h-[220px] border border-mid mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profile.hourly} margin={{ top: 10, right: 12, bottom: 0, left: -20 }}>
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: '#505a5f', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#0b0c0c' }}
                  />
                  <YAxis
                    tick={{ fill: '#505a5f', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#0b0c0c' }}
                  />
                  <Tooltip
                    contentStyle={{ border: '2px solid #0b0c0c', borderRadius: 0, fontSize: 13 }}
                    labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                  />
                  <Bar dataKey="count" isAnimationActive={false}>
                    {profile.hourly.map((entry) => (
                      <Cell
                        key={entry.hour}
                        fill={entry.hour === context.hour ? '#d4351c' : '#1d70b8'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Deployment */}
        <h2 className="text-xl font-bold mb-3">Recommended deployment</h2>
        <p className="mb-2">
          Predicted disruption risk reduced from{' '}
          <span className="font-bold tabular-nums">{allocation.risk_score_unmanaged.toFixed(2)}</span>{' '}
          to{' '}
          <span className="font-bold tabular-nums">{allocation.risk_score_managed.toFixed(2)}</span> (
          −{allocation.reduction_percent}%).
        </p>
        <table className="w-full text-left border-collapse mb-8">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="py-2 pr-3 font-bold">Junction</th>
              <th className="py-2 font-bold text-right">Resource</th>
            </tr>
          </thead>
          <tbody>
            {allocation.deployment_plan.map((n) => (
              <tr key={`${n.node_id}-${n.resource_type}`} className="border-b border-mid">
                <td className="py-2 pr-3 font-bold">{n.node_label}</td>
                <td className="py-2 text-right">
                  {n.quantity} {n.resource_type}
                  {n.quantity > 1 ? 's' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Diversion */}
        <h2 className="text-xl font-bold mb-3">Traffic diversion</h2>
        {allocation.diversion.has_diversion ? (
          <p className="mb-2">
            Reroute via <span className="font-bold">{allocation.diversion.route.join(' to ')}</span>,
            about <span className="font-bold">+{allocation.diversion.added_minutes} min</span> versus
            the direct route.
          </p>
        ) : (
          <p className="mb-2">{allocation.diversion.note}</p>
        )}

        {/* Footer */}
        <div className="border-t-2 border-ink mt-8 pt-4 text-sm text-ink-secondary">
          <p className="mb-1">
            Model confidence: cross-validated F1 {prediction.model_cv_f1_mean.toFixed(3)}. Severity
            and duration are statistical forecasts; the response level reflects operational policy for
            this event type.
          </p>
          <p>
            FLOWITS is a prototype decision-support tool. It augments officer judgment and does not
            replace it. All deployment figures are planning estimates.
          </p>
        </div>
      </div>
    </div>
  )
}
