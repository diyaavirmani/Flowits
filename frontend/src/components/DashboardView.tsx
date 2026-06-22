import { useEffect, useState } from 'react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getCorridorProfile, getFeedbackHistory, getModelInfo, getUpcomingEvents } from '../api/client'

interface Metrics {
  f1: number
  features: number
  liveCount: number
  plannable: number
  accuracy: number
}

function Flashcard({ label, value, sub, tone = 'ink' }: { label: string; value: string; sub?: string; tone?: 'ink' | 'accent' | 'ok' }) {
  const valueColor = tone === 'accent' ? 'text-accent' : tone === 'ok' ? 'text-ok' : 'text-ink'
  return (
    <div className="flashcard p-5">
      <p className="text-muted text-sm font-medium">{label}</p>
      <p className={`text-3xl font-bold mt-1 tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="text-muted text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardView() {
  const [m, setM] = useState<Metrics>({ f1: 0, features: 0, liveCount: 0, plannable: 0, accuracy: 0 })
  const [hourly, setHourly] = useState<{ hour: number; count: number }[]>([])
  const [mix, setMix] = useState<{ name: string; value: number }[]>([])

  useEffect(() => {
    let active = true
    const loadEvents = async () => {
      try {
        const ev = await getUpcomingEvents()
        if (!active) return
        setM((prev) => ({
          ...prev,
          liveCount: ev.data.live_count,
          plannable: ev.data.events.filter((e) => e.mappable).length,
        }))
      } catch {
        /* ignore */
      }
    }
    const loadStatic = async () => {
      try {
        const [info, prof, fb] = await Promise.all([
          getModelInfo(),
          getCorridorProfile('Hosur Road'),
          getFeedbackHistory(),
        ])
        if (!active) return
        setM((prev) => ({ ...prev, f1: info.data.classifier_f1, features: info.data.n_features, accuracy: fb.data.running_accuracy }))
        setHourly(prof.data.hourly)
        setMix([
          { name: 'Unplanned', value: 7706 },
          { name: 'Planned', value: 467 },
        ])
      } catch {
        /* ignore */
      }
    }
    loadEvents()
    loadStatic()
    const id = window.setInterval(loadEvents, 30000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  const peakHour = hourly.length ? hourly.reduce((a, b) => (b.count > a.count ? b : a)) : null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Operational dashboard</h1>
      <p className="text-muted mb-6">Live figures update as data arrives.</p>

      {/* Flashcard metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Flashcard label="Incidents analysed" value="8,057" sub="Historical training base" />
        <Flashcard label="Live events monitored" value={String(m.liveCount)} sub="From the live news feed" tone="accent" />
        <Flashcard label="Plannable now" value={String(m.plannable)} sub="On a supported corridor" tone="accent" />
        <Flashcard label="Model accuracy (F1)" value={m.f1 ? m.f1.toFixed(3) : 'n/a'} sub={`${m.features} features`} tone="ok" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="flashcard p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold">Incidents by hour</p>
            <span className="text-xs text-muted">
              Hosur Road{peakHour ? ` · peak ${String(peakHour.hour).padStart(2, '0')}:00` : ''}
            </span>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
                <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e6e4de' }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e6e4de' }} />
                <Tooltip contentStyle={{ border: '1px solid #e6e4de', borderRadius: 10, fontSize: 13 }} labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {hourly.map((e) => (
                    <Cell key={e.hour} fill={peakHour && e.hour === peakHour.hour ? '#ea580c' : '#f0a878'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flashcard p-5">
          <p className="font-semibold mb-2">Event mix (historical)</p>
          <div className="flex items-center gap-6">
            <div className="h-[160px] w-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2}>
                    <Cell fill="#cfccc3" />
                    <Cell fill="#ea580c" />
                  </Pie>
                  <Tooltip contentStyle={{ border: '1px solid #e6e4de', borderRadius: 10, fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-sm">
              <p className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-sm bg-accent inline-block" /> Planned · 467
              </p>
              <p className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#cfccc3' }} /> Unplanned · 7,706
              </p>
              <p className="text-muted text-xs mt-3 max-w-[210px]">
                Both event types are logged. Once enough accrue, they retrain the model.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Learning loop */}
      <div className="flashcard p-5">
        <p className="font-semibold mb-1">Learning loop</p>
        <p className="text-3xl font-bold text-ok tabular-nums">{(m.accuracy * 100).toFixed(1)}%</p>
        <p className="text-muted text-sm">running accuracy on logged outcomes</p>
        <p className="text-muted text-xs mt-2 max-w-xl">
          Every logged outcome sharpens the next forecast. Full model detail is on the About page.
        </p>
      </div>
    </div>
  )
}
