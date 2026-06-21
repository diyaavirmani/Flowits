"""
schemas.py
Single responsibility: Define Pydantic v2 models for FastAPI request/response validation.
Every model has complete type annotations and no extra fields.
"""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class IncidentInput(BaseModel):
    """Describes a single incident request payload."""
    event_cause: str
    priority: str = Field(..., example="High")
    veh_type: str = Field(default="unknown", example="Car")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    corridor: str
    zone: str
    junction: str
    hour_of_day: int = Field(..., ge=0, le=23, example=14)
    day_of_week: int = Field(..., ge=0, le=6, example=2)


class FeatureImportanceItem(BaseModel):
    """Item representing a feature name and its calculated model importance."""
    feature: str
    importance: float


class PredictionResponse(BaseModel):
    """Response returned from the /predict endpoint."""
    model_config = ConfigDict(protected_namespaces=())

    severity_class: int
    severity_label: str
    class_probabilities: List[float]
    threshold_adjusted: bool
    estimated_duration_minutes: float
    zone_closure_rate: float
    corridor_closure_rate: float
    model_f1_weighted: float
    model_mae_minutes: float
    cv_f1_mean: float
    cv_f1_std: float
    feature_importances: List[FeatureImportanceItem]


class NodeAllocation(BaseModel):
    """Represents a single resource allocation on a corridor junction node."""
    node_id: str
    node_label: str
    impact_score: float
    resource_type: str       # "officer" | "barricade"
    quantity: int
    reason: str


class AllocationRequest(BaseModel):
    """Request payload for resource allocation."""
    incident_latitude: float = Field(..., ge=-90.0, le=90.0)
    incident_longitude: float = Field(..., ge=-180.0, le=180.0)
    corridor: str
    severity_class: int
    # Optional operator-supplied resource caps. When provided, the allocation
    # engine plans against these instead of the severity-based defaults.
    available_officers: Optional[int] = Field(default=None, ge=0, le=100)
    available_barricades: Optional[int] = Field(default=None, ge=0, le=100)


class DiversionPlan(BaseModel):
    """Traffic diversion (reroute) around the blocked junction."""
    blocked_junction: str
    has_diversion: bool
    intercept_at: Optional[str] = None
    rejoin_at: Optional[str] = None
    route: List[str]
    direct_minutes: float
    detour_minutes: float
    added_minutes: float
    note: str


class AllocationResponse(BaseModel):
    """Response returned from the /allocate endpoint."""
    deployment_plan: List[NodeAllocation]
    risk_score_unmanaged: float
    risk_score_managed: float
    reduction_percent: float
    mitigation_assumption: str
    diversion: DiversionPlan


class FeedbackEntry(BaseModel):
    """Feedback payload for logging incident prediction outcome."""
    incident_id: str
    predicted_probability: float
    actual_required_closure: bool
    incident_date: str


class FeedbackLogEntry(BaseModel):
    """Log entry details for logged feedback history."""
    incident_id: str
    incident_date: str
    predicted: float
    actual: int
    correct: bool
    error: float


class FeedbackHistoryResponse(BaseModel):
    """Response returned from the /feedback/history endpoint."""
    history: List[FeedbackLogEntry]
    running_accuracy: float


class SampleIncident(BaseModel):
    """Sample incident used for form prefilling in the frontend."""
    id: str
    event_cause: str
    priority: str
    veh_type: Optional[str] = None
    latitude: float
    longitude: float
    corridor: str
    zone: Optional[str] = None
    junction: Optional[str] = None
    start_datetime: str
