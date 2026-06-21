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
}

export interface FeatureImportanceItem {
  feature: string
  importance: number
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
}

export interface NodeAllocation {
  node_id: string
  node_label: string
  impact_score: number
  resource_type: string
  quantity: number
  reason: string
}

export interface AllocationRequest {
  incident_latitude: number
  incident_longitude: number
  corridor: string
  severity_class: number
  available_officers: number
  available_barricades: number
}

export interface DiversionPlan {
  blocked_junction: string
  has_diversion: boolean
  intercept_at: string | null
  rejoin_at: string | null
  route: string[]
  direct_minutes: number
  detour_minutes: number
  added_minutes: number
  note: string
}

export interface AllocationResponse {
  deployment_plan: NodeAllocation[]
  risk_score_unmanaged: number
  risk_score_managed: number
  reduction_percent: number
  mitigation_assumption: string
  diversion: DiversionPlan
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
