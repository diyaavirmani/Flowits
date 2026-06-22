export interface IncidentInput {
  event_cause: string
  priority: string
  veh_type: string
  latitude: number
  longitude: number
  corridor: string
  zone: string
  junction: string
  hour_of_day: number
  day_of_week: number
  planned: boolean
}

export interface FeatureImportanceItem {
  feature: string
  importance: number
}

export interface ImpactAssessment {
  effective_severity_class: number
  effective_severity_label: string
  is_planned: boolean
  policy_elevated: boolean
  headline: string
  summary: string
  posture: string
  watch_fors: string[]
}

export interface PredictionResponse {
  severity_class: number
  severity_label: string
  class_probabilities: number[]
  threshold_adjusted: boolean
  estimated_duration_minutes: number
  duration_range_low: number
  duration_range_high: number
  zone_closure_rate: number
  corridor_closure_rate: number
  model_cv_f1_mean: number
  model_cv_f1_std: number
  feature_importances: FeatureImportanceItem[]
  impact: ImpactAssessment
}

export interface NodeAllocation {
  node_id: string
  node_label: string
  impact_score: number
  resource_type: string
  quantity: number
  reason: string
  latitude: number
  longitude: number
}

export interface RoutePoint {
  name: string
  latitude: number
  longitude: number
}

export interface DiversionPlan {
  blocked_junction: string
  has_diversion: boolean
  intercept_at: string | null
  rejoin_at: string | null
  route: string[]
  route_points: RoutePoint[]
  blocked_latitude: number | null
  blocked_longitude: number | null
  direct_minutes: number
  detour_minutes: number
  added_minutes: number
  note: string
}

export interface AllocationRequest {
  incident_latitude: number
  incident_longitude: number
  corridor: string
  severity_class: number
  available_officers: number
  available_barricades: number
}

export interface AllocationResponse {
  deployment_plan: NodeAllocation[]
  risk_score_unmanaged: number
  risk_score_managed: number
  reduction_percent: number
  mitigation_assumption: string
  diversion: DiversionPlan
}

export interface LocationOption {
  name: string
  corridor: string
  latitude: number
  longitude: number
}

export interface CorridorProfile {
  corridor: string
  total_incidents: number
  planned: number
  unplanned: number
  closure_rate: number
  hourly: { hour: number; count: number }[]
}

export interface IncidentContext {
  eventLabel: string
  planned: boolean
  locationName: string
  corridor: string
  hour: number
  day: number
}

export interface UpcomingEvent {
  title: string
  source: 'live' | 'curated'
  url: string | null
  published: string | null
  event_cause: string | null
  planned: boolean
  location_name: string | null
  corridor: string | null
  latitude: number | null
  longitude: number | null
  mappable: boolean
}

export interface UpcomingEventsResponse {
  live_status: string
  live_count: number
  curated_count: number
  events: UpcomingEvent[]
}

export interface FeedbackLogEntry {
  incident_id: string
  incident_date: string
  predicted: number
  actual: number
  correct: boolean
}

export interface SampleIncident {
  id: string
  event_cause: string
  priority: string
  veh_type: string
  latitude: number
  longitude: number
  corridor: string
  zone: string
  junction: string
  address: string
}
