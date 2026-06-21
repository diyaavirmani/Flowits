import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { allocate, getCorridors, getSampleIncidents, predict } from '../api/client'
import type {
  AllocationResponse,
  IncidentInput,
  PredictionResponse,
  SampleIncident,
} from '../types'

interface IncidentInputFormProps {
  onResult: (prediction: PredictionResponse, allocation: AllocationResponse) => void
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const eventCauseOptions = [
  ['Vehicle Breakdown', 'vehicle_breakdown'],
  ['Road Accident', 'accident'],
  ['Tree Fall', 'tree_fall'],
  ['Road Damage', 'road_damage'],
  ['Waterlogging', 'waterlogging'],
  ['Public Gathering', 'protest'],
  ['Construction', 'construction'],
  ['Other', 'others'],
]

const vehicleOptions = [
  ['Private Car', 'private_car'],
  ['Truck', 'truck'],
  ['Bus', 'bus'],
  ['Motorbike', 'motorbike'],
  ['Auto Rickshaw', 'auto'],
  ['Not specified', 'unknown'],
]

const labelClass =
  'block text-[10px] tracking-[0.15em] uppercase text-muted-foreground mb-1.5'
const inputClass =
  'w-full bg-background border-2 border-foreground px-3 py-2.5 text-sm text-foreground font-mono outline-none transition-colors focus:border-[#ea580c]'

const backendDownMessage =
  'Cannot reach FLOWITS backend. Start the server: uvicorn main:app --reload --port 8001'

const displayCause = (value: string) =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')

const normalizeEventCauseForSelect = (value: string) => {
  if (eventCauseOptions.some(([, raw]) => raw === value)) {
    return value
  }
  if (value === 'pot_holes' || value === 'road_conditions') {
    return 'road_damage'
  }
  return 'others'
}

const normalizeVehicleForSelect = (value: string) => {
  if (vehicleOptions.some(([, raw]) => raw === value)) {
    return value
  }
  if (value.includes('bus')) {
    return 'bus'
  }
  if (value.includes('truck') || value.includes('heavy') || value === 'lcv') {
    return 'truck'
  }
  return 'unknown'
}

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
  const btn =
    'w-9 h-9 border-2 border-foreground bg-background text-foreground font-mono text-lg leading-none flex items-center justify-center hover:bg-foreground hover:text-background transition-colors'
  return (
    <div className="flex flex-col gap-2">
      <span className={labelClass}>{label}</span>
      <div className="flex items-center">
        <button type="button" onClick={onDec} className={btn}>
          −
        </button>
        <span className="w-12 h-9 border-y-2 border-foreground flex items-center justify-center font-mono text-lg font-bold tabular-nums text-[#ea580c]">
          {value}
        </span>
        <button type="button" onClick={onInc} className={btn}>
          +
        </button>
      </div>
    </div>
  )
}

export default function IncidentInputForm({ onResult }: IncidentInputFormProps) {
  const [samples, setSamples] = useState<SampleIncident[]>([])
  const [corridors, setCorridors] = useState<string[]>([])
  const [eventCause, setEventCause] = useState('vehicle_breakdown')
  const [priority, setPriority] = useState('High')
  const [vehType, setVehType] = useState('unknown')
  const [latitude, setLatitude] = useState<number | ''>('')
  const [longitude, setLongitude] = useState<number | ''>('')
  const [corridor, setCorridor] = useState('')
  const [zone, setZone] = useState('')
  const [junction, setJunction] = useState('')
  const [hourOfDay, setHourOfDay] = useState(12)
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [officers, setOfficers] = useState(5)
  const [barricades, setBarricades] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadOptions = async () => {
      try {
        const [sampleRes, corridorRes] = await Promise.all([
          getSampleIncidents(),
          getCorridors(),
        ])

        if (!active) {
          return
        }

        setSamples(sampleRes.data)
        setCorridors(corridorRes.data)
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError))
        }
      }
    }

    loadOptions()

    return () => {
      active = false
    }
  }, [])

  const handleSampleSelect = (sampleId: string) => {
    const sample = samples.find((item) => item.id === sampleId)
    if (!sample) {
      return
    }

    setEventCause(normalizeEventCauseForSelect(sample.event_cause))
    setPriority(sample.priority)
    setVehType(normalizeVehicleForSelect(sample.veh_type || 'unknown'))
    setLatitude(sample.latitude)
    setLongitude(sample.longitude)
    setCorridor(sample.corridor || '')
    setZone(sample.zone || '')
    setJunction(sample.junction || '')
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    try {
      const input: IncidentInput = {
        event_cause: eventCause,
        priority,
        veh_type: vehType,
        latitude: Number(latitude),
        longitude: Number(longitude),
        corridor: corridor || 'unknown',
        zone: zone || 'unknown',
        junction: junction || 'unknown',
        hour_of_day: hourOfDay,
        day_of_week: dayOfWeek,
      }

      if (!latitude || !longitude || Number.isNaN(input.latitude) || Number.isNaN(input.longitude)) {
        throw new Error('Latitude and longitude are required.')
      }

      if (!corridor) {
        throw new Error('Select a road corridor before analysis.')
      }

      const predRes = await predict(input)
      const pred = predRes.data
      const allocRes = await allocate({
        incident_latitude: input.latitude,
        incident_longitude: input.longitude,
        corridor: input.corridor,
        severity_class: pred.severity_class,
        available_officers: officers,
        available_barricades: barricades,
      })

      onResult(pred, allocRes.data)
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-2 border-foreground bg-background">
      {/* Card header */}
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          incident.parameters
        </span>
        <span className="h-2 w-2 bg-[#ea580c]" />
      </div>

      <div className="p-6 lg:p-7">
        {/* Sample loader */}
        <div className="mb-6">
          <label className={labelClass} htmlFor="sample-loader">
            Load a real incident
          </label>
          <select
            id="sample-loader"
            className={inputClass}
            defaultValue=""
            onChange={(event) => handleSampleSelect(event.target.value)}
          >
            <option value="">Fill in manually below</option>
            {samples.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.id} · {displayCause(sample.event_cause)} ({sample.priority})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass} htmlFor="event-cause">
              Event Cause
            </label>
            <select
              id="event-cause"
              value={eventCause}
              onChange={(event) => setEventCause(event.target.value)}
              className={inputClass}
            >
              {eventCauseOptions.map(([label, value]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="priority">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className={inputClass}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="latitude">
              Latitude
            </label>
            <input
              id="latitude"
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value === '' ? '' : Number(event.target.value))}
              placeholder="12.9716"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="longitude">
              Longitude
            </label>
            <input
              id="longitude"
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value === '' ? '' : Number(event.target.value))}
              placeholder="77.5946"
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="corridor">
              Road Corridor
            </label>
            <select
              id="corridor"
              value={corridor}
              onChange={(event) => setCorridor(event.target.value)}
              className={inputClass}
            >
              <option value="">Select corridor</option>
              {corridors.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="time-of-incident">
              Time of Incident
            </label>
            <input
              id="time-of-incident"
              type="time"
              defaultValue="12:00"
              onChange={(event) => {
                const hour = Number.parseInt(event.target.value.split(':')[0], 10)
                if (!Number.isNaN(hour)) {
                  setHourOfDay(hour)
                }
              }}
              className={inputClass}
            />
          </div>

          <div>
            <span className={labelClass}>Day of Week</span>
            <div className="grid grid-cols-7 gap-0 border-2 border-foreground">
              {days.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setDayOfWeek(index)}
                  className={`py-2 text-[10px] font-bold uppercase transition-colors ${
                    index < days.length - 1 ? 'border-r-2 border-foreground' : ''
                  } ${
                    dayOfWeek === index
                      ? 'bg-foreground text-background'
                      : 'bg-background text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {day[0]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="vehicle-type">
              Vehicle Type
            </label>
            <select
              id="vehicle-type"
              value={vehType}
              onChange={(event) => setVehType(event.target.value)}
              className={inputClass}
            >
              {vehicleOptions.map(([label, value]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="zone">
              Zone
            </label>
            <input
              id="zone"
              value={zone}
              onChange={(event) => setZone(event.target.value)}
              placeholder="Central Zone 1"
              className={inputClass}
            />
          </div>
        </div>

        {/* Available resources */}
        <div className="mt-6 border-t-2 border-foreground pt-5">
          <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
            available_resources
          </span>
          <div className="grid grid-cols-2 gap-6 mt-3">
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
        </div>

        {error && (
          <div className="mt-5 border-2 border-destructive bg-destructive/10 px-4 py-3 text-destructive text-xs leading-relaxed">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          disabled={loading}
          onClick={handleSubmit}
          className="group mt-6 w-full flex items-stretch bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
        >
          <span className="w-12 flex items-center justify-center bg-[#ea580c] text-background text-lg font-bold">
            {loading ? <span className="spinner" /> : '→'}
          </span>
          <span className="flex-1 py-3 text-sm font-bold tracking-[0.15em] uppercase">
            {loading ? 'Analysing…' : 'Analyse Incident'}
          </span>
        </button>
      </div>
    </div>
  )
}
