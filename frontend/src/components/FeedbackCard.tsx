import { isAxiosError } from 'axios'
import { useCallback, useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getFeedbackHistory, logFeedback } from '../api/client'
import type { FeedbackLogEntry } from '../types'

const backendDownMessage =
  'Cannot reach FLOWITS backend. Start the server: uvicorn main:app --reload --port 8001'

const labelClass =
  'block text-[10px] tracking-[0.15em] uppercase text-muted-foreground mb-1.5'
const inputClass =
  'w-full bg-background border-2 border-foreground px-3 py-2 text-xs text-foreground font-mono outline-none transition-colors focus:border-[#ea580c]'

const getErrorMessage = (error: unknown) => {
  if (isAxiosError(error)) {
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || !error.response) {
      return backendDownMessage
    }
    const detail = error.response?.data?.detail
    return typeof detail === 'string' ? detail : error.message
  }

  return error instanceof Error ? error.message : 'Feedback update failed.'
}

export default function FeedbackCard() {
  const [history, setHistory] = useState<FeedbackLogEntry[]>([])
  const [accuracy, setAccuracy] = useState(0)
  const [incidentId, setIncidentId] = useState('')
  const [predictedClass, setPredictedClass] = useState(0)
  const [actualClass, setActualClass] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const refreshHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getFeedbackHistory()
      setHistory(res.data.history)
      setAccuracy(res.data.running_accuracy)
      setError('')
    } catch (historyError) {
      setError(getErrorMessage(historyError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      refreshHistory()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [refreshHistory])

  const handleLog = async () => {
    setSubmitting(true)
    setError('')

    try {
      await logFeedback({
        incident_id: incidentId,
        predicted_class: predictedClass,
        actual_class: actualClass,
        incident_date: new Date().toISOString().split('T')[0],
      })

      const res = await getFeedbackHistory()
      setHistory(res.data.history)
      setAccuracy(res.data.running_accuracy)
      setIncidentId('')
    } catch (logError) {
      setError(getErrorMessage(logError))
    } finally {
      setSubmitting(false)
    }
  }

  const classOptions = [
    '0 · Monitor only',
    '1 · Single officer',
    '2 · Standard response',
    '3 · Maximum response',
  ]

  // Plot by logged-outcome sequence, not calendar date — multiple outcomes
  // can be logged on the same day, so a date axis would stack them on one tick.
  const chartData = history.map((entry, index) => ({ ...entry, seq: index + 1 }))

  return (
    <div className="border-2 border-foreground bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          prediction_accuracy.over_time
        </span>
        <span className="h-2 w-2 bg-[#ea580c]" />
      </div>

      <div className="p-6 lg:p-7">
        {error && (
          <div className="mb-4 border-2 border-destructive bg-destructive/10 px-4 py-3 text-destructive text-xs leading-relaxed">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-xs text-muted-foreground uppercase tracking-widest">
            <span className="spinner mr-2" />
            Loading outcomes…
          </div>
        ) : history.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">
              No outcomes logged yet. Use the form below.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                Running Accuracy
              </span>
              <span className="font-mono text-2xl font-bold tabular-nums text-[#ea580c]">
                {(accuracy * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-muted-foreground">
                over {history.length} logged outcome{history.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="h-[220px] border-2 border-foreground p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid stroke="#c4c2b8" strokeDasharray="0" vertical={false} />
                  <XAxis
                    dataKey="seq"
                    tickFormatter={(value) => `#${value}`}
                    tick={{ fill: '#666666', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                    tickLine={false}
                    axisLine={{ stroke: '#0A0A0A' }}
                  />
                  <YAxis
                    domain={[0, 3]}
                    ticks={[0, 1, 2, 3]}
                    tick={{ fill: '#666666', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                    tickLine={false}
                    axisLine={{ stroke: '#0A0A0A' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#F2F1EA',
                      border: '2px solid #0A0A0A',
                      borderRadius: 0,
                      fontFamily: 'JetBrains Mono',
                      fontSize: 11,
                    }}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.incident_date
                        ? `Outcome #${label} · ${payload[0].payload.incident_date}`
                        : `Outcome #${label}`
                    }
                  />
                  <Legend
                    wrapperStyle={{
                      fontFamily: 'JetBrains Mono',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="predicted"
                    stroke="#0A0A0A"
                    strokeWidth={2}
                    dot={{ fill: '#0A0A0A', r: 3 }}
                    name="Predicted"
                  />
                  <Line
                    type="stepAfter"
                    dataKey="actual"
                    stroke="#ea580c"
                    strokeWidth={2}
                    dot={{ fill: '#ea580c', r: 3 }}
                    name="Actual"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Log form */}
        <div className="mt-5 border-t-2 border-foreground pt-5">
          <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
            log_actual_outcome
          </span>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
            <div>
              <label className={labelClass} htmlFor="incident-id">
                Incident ID
              </label>
              <input
                id="incident-id"
                value={incidentId}
                onChange={(event) => setIncidentId(event.target.value)}
                placeholder="FKID007629"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="predicted-class">
                Predicted Class
              </label>
              <select
                id="predicted-class"
                value={predictedClass}
                onChange={(event) => setPredictedClass(Number(event.target.value))}
                className={inputClass}
              >
                {classOptions.map((label, value) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="actual-class">
                Actual Class
              </label>
              <select
                id="actual-class"
                value={actualClass}
                onChange={(event) => setActualClass(Number(event.target.value))}
                className={inputClass}
              >
                {classOptions.map((label, value) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleLog}
                disabled={!incidentId || submitting}
                className="w-full flex items-stretch bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
              >
                <span className="w-9 flex items-center justify-center bg-[#ea580c] text-background font-bold">
                  {submitting ? <span className="spinner" /> : '→'}
                </span>
                <span className="flex-1 py-2 text-[11px] font-bold tracking-[0.12em] uppercase">
                  {submitting ? 'Logging…' : 'Log Outcome'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
