import axios from 'axios'
import type { AxiosResponse } from 'axios'
import type {
  AllocationRequest,
  AllocationResponse,
  CorridorProfile,
  FeedbackLogEntry,
  IncidentContext,
  IncidentInput,
  LocationOption,
  PredictionResponse,
  SampleIncident,
  UpcomingEvent,
  UpcomingEventsResponse,
} from '../types'

interface BackendPredictionResponse {
  severity_class: number
  severity_label: string
  class_probabilities?: number[]
  threshold_adjusted?: boolean
  estimated_duration_minutes: number
  duration_range_low?: number
  duration_range_high?: number
  zone_closure_rate: number
  corridor_closure_rate: number
  model_cv_f1_mean?: number
  model_cv_f1_std?: number
  cv_f1_mean?: number
  cv_f1_std?: number
  feature_importances: PredictionResponse['feature_importances']
  impact: PredictionResponse['impact']
}

interface BackendSampleIncident {
  id: string
  event_cause: string
  priority: string
  veh_type?: string | null
  latitude: number
  longitude: number
  corridor: string
  zone?: string | null
  junction?: string | null
  address?: string | null
  start_datetime?: string
}

interface BackendFeedbackLogEntry {
  incident_id: string
  incident_date: string
  predicted: number
  actual: number
  correct: boolean
}

interface BackendHealthResponse {
  status: string
  model_loaded: boolean
  cv_f1_mean?: number
  cv_f1_std?: number
  metrics?: {
    cv_f1_mean?: number
    cv_f1_std?: number
  }
}

// API base resolution:
//  - VITE_API_URL (if set at build time) always wins — use this to point a
//    separately-hosted frontend at a remote backend.
//  - Otherwise in a production build the frontend is served BY the backend,
//    so calls are same-origin (relative '').
//  - In local dev, fall back to the local backend on :8001.
const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? '' : 'http://127.0.0.1:8001')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

const withData = <T, R>(
  response: AxiosResponse<T>,
  data: R,
): AxiosResponse<R> => ({
  ...response,
  data,
})

const probabilityFallback = (severityClass: number) => {
  const probabilities = [0.05, 0.05, 0.05, 0.05]
  probabilities[severityClass] = Math.max(0.25, severityClass / 3)
  const total = probabilities.reduce((sum, value) => sum + value, 0)
  return probabilities.map((value) => Number((value / total).toFixed(4)))
}

const normalizePrediction = (
  prediction: BackendPredictionResponse,
): PredictionResponse => {
  const low =
    prediction.duration_range_low ??
    Math.max(0, prediction.estimated_duration_minutes - 50)
  const high =
    prediction.duration_range_high ??
    prediction.estimated_duration_minutes + 50

  return {
    severity_class: prediction.severity_class,
    severity_label: prediction.severity_label,
    class_probabilities:
      prediction.class_probabilities ??
      probabilityFallback(prediction.severity_class),
    threshold_adjusted:
      prediction.threshold_adjusted ?? prediction.severity_class >= 2,
    estimated_duration_minutes: prediction.estimated_duration_minutes,
    duration_range_low: Number(low.toFixed(1)),
    duration_range_high: Number(high.toFixed(1)),
    zone_closure_rate: prediction.zone_closure_rate,
    corridor_closure_rate: prediction.corridor_closure_rate,
    model_cv_f1_mean:
      prediction.model_cv_f1_mean ?? prediction.cv_f1_mean ?? 0,
    model_cv_f1_std:
      prediction.model_cv_f1_std ?? prediction.cv_f1_std ?? 0,
    feature_importances: prediction.feature_importances,
    impact: prediction.impact,
  }
}

const normalizeSample = (sample: BackendSampleIncident): SampleIncident => ({
  id: sample.id,
  event_cause: sample.event_cause,
  priority: sample.priority,
  veh_type: sample.veh_type ?? '',
  latitude: sample.latitude,
  longitude: sample.longitude,
  corridor: sample.corridor,
  zone: sample.zone ?? '',
  junction: sample.junction ?? '',
  address: sample.address ?? sample.start_datetime ?? '',
})

const normalizeFeedbackEntry = (
  entry: BackendFeedbackLogEntry,
): FeedbackLogEntry => ({
  incident_id: entry.incident_id,
  incident_date: entry.incident_date,
  predicted: Math.round(Number(entry.predicted) * 3),
  actual: Number(entry.actual) === 1 ? 3 : 0,
  correct: entry.correct,
})

export const getHealth = async () => {
  const response = await api.get<BackendHealthResponse>('/health')
  return withData(response, {
    status: response.data.status,
    model_loaded: response.data.model_loaded,
    cv_f1_mean:
      response.data.cv_f1_mean ?? response.data.metrics?.cv_f1_mean ?? 0,
    cv_f1_std:
      response.data.cv_f1_std ?? response.data.metrics?.cv_f1_std ?? 0,
  } satisfies {
    status: string
    model_loaded: boolean
    cv_f1_mean: number
    cv_f1_std: number
  })
}

export const getModelInfo = () =>
  api.get<{
    classifier_f1: number
    classifier_auc: number
    cv_f1_mean: number
    cv_f1_std: number
    regressor_mae: number
    regressor_rmse: number
    n_features: number
    performance_notes: string[]
  }>('/model-info')

export const getSampleIncidents = async () => {
  const response = await api.get<BackendSampleIncident[]>('/incidents/sample')
  return withData(response, response.data.map(normalizeSample))
}

export const getCorridors = () => api.get<string[]>('/corridors')

export const getLocations = () => api.get<LocationOption[]>('/locations')

export const getCorridorProfile = (corridor: string) =>
  api.get<CorridorProfile>('/corridor-profile', { params: { corridor } })

export const getUpcomingEvents = () =>
  api.get<UpcomingEventsResponse>('/events/upcoming')

const causeLabels: Record<string, string> = {
  sports_event: 'Sports / IPL event',
  concert: 'Concert / celebrity event',
  political_rally: 'Political rally',
  festival: 'Festival / procession',
  construction: 'Construction',
  vehicle_breakdown: 'Vehicle breakdown',
  accident: 'Road accident',
  tree_fall: 'Tree fall',
  road_damage: 'Road damage',
  waterlogging: 'Waterlogging',
  protest: 'Sudden gathering / protest',
  others: 'Other',
}

// Run the full pipeline (predict -> allocate) for a mappable upcoming event.
export async function analyzeEvent(ev: UpcomingEvent): Promise<{
  prediction: PredictionResponse
  allocation: AllocationResponse
  context: IncidentContext
}> {
  const now = new Date()
  const hour = now.getHours()
  const day = (now.getDay() + 6) % 7
  const input: IncidentInput = {
    event_cause: ev.event_cause ?? 'others',
    priority: 'Medium',
    veh_type: 'unknown',
    latitude: ev.latitude ?? 0,
    longitude: ev.longitude ?? 0,
    corridor: ev.corridor ?? 'unknown',
    zone: 'unknown',
    junction: ev.location_name ?? 'unknown',
    hour_of_day: hour,
    day_of_week: day,
    planned: ev.planned,
  }
  const prediction = (await predict(input)).data
  const allocation = (
    await allocate({
      incident_latitude: input.latitude,
      incident_longitude: input.longitude,
      corridor: input.corridor,
      severity_class: prediction.impact.effective_severity_class,
      available_officers: 6,
      available_barricades: 4,
    })
  ).data
  const context: IncidentContext = {
    eventLabel: causeLabels[ev.event_cause ?? 'others'] ?? ev.event_cause ?? 'Event',
    planned: ev.planned,
    locationName: ev.location_name ?? 'Unknown',
    corridor: ev.corridor ?? 'unknown',
    hour,
    day,
  }
  return { prediction, allocation, context }
}

export const predict = async (input: IncidentInput) => {
  const response = await api.post<BackendPredictionResponse>('/predict', input)
  return withData(response, normalizePrediction(response.data))
}

export const allocate = (input: AllocationRequest) =>
  api.post<AllocationResponse>('/allocate', input)

export const logFeedback = (entry: {
  incident_id: string
  predicted_class: number
  actual_class: number
  incident_date: string
}) =>
  api.post<{ logged: boolean; total_logged: number }>('/feedback/log', {
    incident_id: entry.incident_id,
    predicted_probability: entry.predicted_class / 3,
    actual_required_closure: entry.actual_class >= 2,
    incident_date: entry.incident_date,
  })

export const getFeedbackHistory = async () => {
  const response = await api.get<{
    history: BackendFeedbackLogEntry[]
    running_accuracy: number
    total_logged?: number
  }>('/feedback/history')

  return withData(response, {
    history: response.data.history.map(normalizeFeedbackEntry),
    running_accuracy: response.data.running_accuracy,
    total_logged: response.data.total_logged ?? response.data.history.length,
  })
}
