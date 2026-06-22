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
  'Cannot reach the FLOWITS service. Start the backend: uvicorn main:app --reload --port 8001'

const labelClass = 'block font-bold text-ink mb-1'

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

  const chartData = history.map((entry, index) => ({ ...entry, seq: index + 1 }))

  return (
    <section>
      <h2 className="text-2xl font-bold mb-1">Outcome learning</h2>
      <p className="text-ink-secondary mb-5">
        Log what actually happened so the service tracks its accuracy and improves over time.
      </p>

      {error && (
        <div className="border-l-4 border-red bg-white pl-4 py-2 mb-5" role="alert">
          <p className="font-bold text-red">There is a problem</p>
          <p className="text-red">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-ink-secondary py-6">Loading outcomes…</p>
      ) : history.length === 0 ? (
        <p className="text-ink-secondary py-6">No outcomes logged yet. Use the form below.</p>
      ) : (
        <>
          <p className="mb-4">
            <span className="text-2xl font-bold tabular-nums">{(accuracy * 100).toFixed(1)}%</span>
            <span className="text-ink-secondary">
              {' '}
              running accuracy over {history.length} logged outcome{history.length !== 1 ? 's' : ''}
            </span>
          </p>

          <div className="h-[240px] border border-mid p-2 mb-2 bg-white">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="#dcdcd9" vertical={false} />
                <XAxis
                  dataKey="seq"
                  tickFormatter={(value) => `#${value}`}
                  tick={{ fill: '#505a5f', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#0b0c0c' }}
                />
                <YAxis
                  domain={[0, 3]}
                  ticks={[0, 1, 2, 3]}
                  tick={{ fill: '#505a5f', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#0b0c0c' }}
                />
                <Tooltip
                  contentStyle={{ border: '2px solid #0b0c0c', borderRadius: 0, fontSize: 13 }}
                  labelFormatter={(label, payload) =>
                    payload?.[0]?.payload?.incident_date
                      ? `Outcome #${label} · ${payload[0].payload.incident_date}`
                      : `Outcome #${label}`
                  }
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Line
                  type="stepAfter"
                  dataKey="predicted"
                  stroke="#1d70b8"
                  strokeWidth={2}
                  dot={{ fill: '#1d70b8', r: 3 }}
                  name="Predicted"
                />
                <Line
                  type="stepAfter"
                  dataKey="actual"
                  stroke="#0b0c0c"
                  strokeWidth={2}
                  dot={{ fill: '#0b0c0c', r: 3 }}
                  name="Actual"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Log form */}
      <div className="border-t border-mid mt-6 pt-5">
        <h3 className="text-lg font-bold mb-4">Log an actual outcome</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
          <div>
            <label className={labelClass} htmlFor="incident-id">
              Incident ID
            </label>
            <input
              id="incident-id"
              value={incidentId}
              onChange={(event) => setIncidentId(event.target.value)}
              placeholder="e.g. FKID007629"
              className="gv-input"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="predicted-class">
              Predicted class
            </label>
            <select
              id="predicted-class"
              value={predictedClass}
              onChange={(event) => setPredictedClass(Number(event.target.value))}
              className="gv-select"
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
              Actual class
            </label>
            <select
              id="actual-class"
              value={actualClass}
              onChange={(event) => setActualClass(Number(event.target.value))}
              className="gv-select"
            >
              {classOptions.map((label, value) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleLog}
            disabled={!incidentId || submitting}
            className="gv-button"
          >
            {submitting ? (
              <>
                <span className="spinner" /> Logging…
              </>
            ) : (
              'Log outcome'
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
