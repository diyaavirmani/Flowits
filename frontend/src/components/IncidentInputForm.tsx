import { isAxiosError } from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { allocate, getLocations, predict } from '../api/client'
import type {
  AllocationResponse,
  IncidentContext,
  IncidentInput,
  LocationOption,
  PredictionResponse,
} from '../types'

interface IncidentInputFormProps {
  onResult: (
    prediction: PredictionResponse,
    allocation: AllocationResponse,
    context: IncidentContext,
  ) => void
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const unplannedCauses = [
  ['Vehicle breakdown', 'vehicle_breakdown'],
  ['Road accident', 'accident'],
  ['Tree fall', 'tree_fall'],
  ['Road damage', 'road_damage'],
  ['Waterlogging', 'waterlogging'],
  ['Sudden gathering / protest', 'protest'],
  ['Other', 'others'],
]

const plannedCauses = [
  ['Sports / IPL event', 'sports_event'],
  ['Concert / celebrity event', 'concert'],
  ['Political rally', 'political_rally'],
  ['Festival / procession', 'festival'],
  ['Construction', 'construction'],
]

const labelClass = 'block font-bold text-ink mb-1'

const backendDownMessage =
  'Cannot reach the FLOWITS service. Start the backend: uvicorn main:app --reload --port 8001'

const getErrorMessage = (error: unknown) => {
  if (isAxiosError(error)) {
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || !error.response) {
      return backendDownMessage
    }
    const detail = error.response?.data?.detail
    return typeof detail === 'string' ? detail : error.message
  }
  return error instanceof Error ? error.message : 'Analysis failed.'
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string
  value: number
  onDec: () => void
  onInc: () => void
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="flex items-center">
        <button type="button" onClick={onDec} className="gv-step" aria-label={`Decrease ${label}`}>
          −
        </button>
        <span className="w-12 h-10 border-y-2 border-ink flex items-center justify-center font-bold tabular-nums">
          {value}
        </span>
        <button type="button" onClick={onInc} className="gv-step" aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  )
}

export default function IncidentInputForm({ onResult }: IncidentInputFormProps) {
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [planned, setPlanned] = useState(false)
  const [eventCause, setEventCause] = useState('vehicle_breakdown')
  const [priority, setPriority] = useState('Medium')
  const [locationIndex, setLocationIndex] = useState<number | ''>('')
  const [hourOfDay, setHourOfDay] = useState(() => new Date().getHours())
  const [dayOfWeek, setDayOfWeek] = useState(() => (new Date().getDay() + 6) % 7)
  const [officers, setOfficers] = useState(5)
  const [barricades, setBarricades] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const causes = planned ? plannedCauses : unplannedCauses

  useEffect(() => {
    let active = true
    getLocations()
      .then((res) => {
        if (active) setLocations(res.data)
      })
      .catch((loadError) => {
        if (active) setError(getErrorMessage(loadError))
      })
    return () => {
      active = false
    }
  }, [])

  const groupedLocations = useMemo(() => {
    const groups: Record<string, { idx: number; name: string }[]> = {}
    locations.forEach((loc, idx) => {
      ;(groups[loc.corridor] ??= []).push({ idx, name: loc.name })
    })
    return groups
  }, [locations])

  const togglePlanned = (next: boolean) => {
    setPlanned(next)
    setEventCause((next ? plannedCauses : unplannedCauses)[0][1])
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      if (locationIndex === '' || !locations[locationIndex]) {
        throw new Error('Select a location.')
      }
      const loc = locations[locationIndex]
      const input: IncidentInput = {
        event_cause: eventCause,
        priority,
        veh_type: 'unknown',
        latitude: loc.latitude,
        longitude: loc.longitude,
        corridor: loc.corridor,
        zone: 'unknown',
        junction: loc.name,
        hour_of_day: hourOfDay,
        day_of_week: dayOfWeek,
        planned,
      }
      const predRes = await predict(input)
      const pred = predRes.data
      const allocRes = await allocate({
        incident_latitude: input.latitude,
        incident_longitude: input.longitude,
        corridor: input.corridor,
        severity_class: pred.impact.effective_severity_class,
        available_officers: officers,
        available_barricades: barricades,
      })
      const eventLabel = causes.find(([, v]) => v === eventCause)?.[0] ?? eventCause
      onResult(pred, allocRes.data, {
        eventLabel,
        planned,
        locationName: loc.name,
        corridor: loc.corridor,
        hour: hourOfDay,
        day: dayOfWeek,
      })
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t-4 border-ink pt-5">
      <h2 className="text-xl font-bold mb-5">Report an incident</h2>

      {error && (
        <div className="border-l-4 border-red bg-white pl-4 py-2 mb-5" role="alert">
          <p className="font-bold text-red">There is a problem</p>
          <p className="text-red">{error}</p>
        </div>
      )}

      {/* Planned / unplanned */}
      <fieldset className="mb-5">
        <legend className={labelClass}>Event type</legend>
        <div className="flex gap-2">
          {[
            { label: 'Unplanned', value: false },
            { label: 'Planned', value: true },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => togglePlanned(opt.value)}
              aria-pressed={planned === opt.value}
              className={`px-4 py-2 font-bold border-2 ${
                planned === opt.value
                  ? 'bg-blue text-white border-blue'
                  : 'bg-white text-ink border-ink hover:bg-grey-light'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-secondary mt-1">
          {planned
            ? 'A scheduled event. Enter it in advance to plan the response.'
            : 'Something happening now, reported from the ground.'}
        </p>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={labelClass} htmlFor="event-cause">
            What is happening
          </label>
          <select
            id="event-cause"
            value={eventCause}
            onChange={(event) => setEventCause(event.target.value)}
            className="gv-select"
          >
            {causes.map(([label, value]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="priority">
            Urgency (optional)
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="gv-select"
          >
            <option value="High">Urgent</option>
            <option value="Medium">Routine</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="location">
            Location
          </label>
          <p className="text-sm text-ink-secondary mb-1">
            Pick the junction or area. The system fills in the coordinates.
          </p>
          <select
            id="location"
            value={locationIndex}
            onChange={(event) =>
              setLocationIndex(event.target.value === '' ? '' : Number(event.target.value))
            }
            className="gv-select"
          >
            <option value="">Select a location</option>
            {Object.entries(groupedLocations).map(([corridor, items]) => (
              <optgroup key={corridor} label={corridor}>
                {items.map((item) => (
                  <option key={item.idx} value={item.idx}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="time-of-incident">
            Time {planned ? '(of the event)' : '(defaults to now)'}
          </label>
          <input
            id="time-of-incident"
            type="time"
            value={`${String(hourOfDay).padStart(2, '0')}:00`}
            onChange={(event) => {
              const hour = Number.parseInt(event.target.value.split(':')[0], 10)
              if (!Number.isNaN(hour)) setHourOfDay(hour)
            }}
            className="gv-input font-mono"
          />
        </div>

        <div>
          <span className={labelClass}>Day</span>
          <div className="flex flex-wrap gap-1">
            {days.map((day, index) => (
              <button
                key={day}
                type="button"
                onClick={() => setDayOfWeek(index)}
                aria-pressed={dayOfWeek === index}
                className={`px-2.5 py-2 text-sm font-bold border-2 ${
                  dayOfWeek === index
                    ? 'bg-blue text-white border-blue'
                    : 'bg-white text-ink border-ink hover:bg-grey-light'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>

      <fieldset className="mt-6 border-t border-mid pt-5">
        <legend className="font-bold mb-3">Available resources</legend>
        <div className="grid grid-cols-2 gap-6">
          <Stepper
            label="Officers"
            value={officers}
            onDec={() => setOfficers((value) => Math.max(0, value - 1))}
            onInc={() => setOfficers((value) => Math.min(20, value + 1))}
          />
          <Stepper
            label="Barricades"
            value={barricades}
            onDec={() => setBarricades((value) => Math.max(0, value - 1))}
            onInc={() => setBarricades((value) => Math.min(10, value + 1))}
          />
        </div>
      </fieldset>

      <button type="button" disabled={loading} onClick={handleSubmit} className="gv-button mt-6 w-full sm:w-auto">
        {loading ? (
          <>
            <span className="spinner" /> Analysing…
          </>
        ) : (
          'Forecast impact and plan response'
        )}
      </button>
    </div>
  )
}
