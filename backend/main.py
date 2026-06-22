"""
main.py
Single responsibility: Expose FastAPI REST endpoints for the FLOW backend.
Loads ML models at startup and coordinates predictions, resource allocations, and feedback logging.
"""

import json
from pathlib import Path
from typing import Any, Dict, List
from contextlib import asynccontextmanager

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.allocation import allocate_resources, compute_before_after
from src.data_loader import load_events
from src.feature_engineering import build_feature_vector
from src.feedback import compute_running_accuracy, load_history, log_outcome
from src.graph_builder import (
    SUPPORTED_CORRIDORS,
    build_graph,
    compute_diversion,
    get_node_impact_scores,
    list_locations,
)
from src.playbook import assess_impact
from src.events_feed import get_upcoming_events
from src.schemas import (
    AllocationRequest,
    AllocationResponse,
    FeedbackEntry,
    FeedbackHistoryResponse,
    IncidentInput,
    LocationOption,
    PredictionResponse,
    SampleIncident,
    UpcomingEventsResponse,
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
RAW_EVENTS_PATH = DATA_DIR / "raw" / "events.csv"
FEEDBACK_HISTORY_PATH = DATA_DIR / "processed" / "feedback_history.csv"
MODEL_ARTIFACTS_DIR = BASE_DIR / "model_artifacts"
CLASSIFIER_PATH = MODEL_ARTIFACTS_DIR / "classifier.pkl"
REGRESSOR_PATH = MODEL_ARTIFACTS_DIR / "regressor.pkl"
RATES_PATH = MODEL_ARTIFACTS_DIR / "historical_rates.pkl"
METRICS_PATH = MODEL_ARTIFACTS_DIR / "metrics.json"
SPATIAL_CLUSTER_PATH = MODEL_ARTIFACTS_DIR / "spatial_cluster_model.pkl"
FEATURE_COLUMNS_PATH = MODEL_ARTIFACTS_DIR / "feature_columns.pkl"


def _make_start_timestamp(hour_of_day: int, day_of_week: int) -> pd.Timestamp:
    """Reconstruct a start timestamp from hour and day metadata."""
    monday = pd.Timestamp("2026-01-03T00:00:00Z")
    return monday + pd.Timedelta(days=day_of_week, hours=hour_of_day)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model artifacts and metrics at startup, then clear state on shutdown."""
    required_paths = [
        CLASSIFIER_PATH,
        REGRESSOR_PATH,
        RATES_PATH,
        METRICS_PATH,
        SPATIAL_CLUSTER_PATH,
        FEATURE_COLUMNS_PATH,
    ]
    missing = [str(path) for path in required_paths if not path.exists()]
    if missing:
        raise RuntimeError(
            f"Required model artifacts are missing: {missing}. Run train.py first."
        )

    try:
        app.state.classifier = joblib.load(CLASSIFIER_PATH)
        app.state.regressor = joblib.load(REGRESSOR_PATH)
        app.state.rates = joblib.load(RATES_PATH)
        app.state.spatial_cluster_model = joblib.load(SPATIAL_CLUSTER_PATH)
        app.state.feature_columns = joblib.load(FEATURE_COLUMNS_PATH)
        with METRICS_PATH.open("r", encoding="utf-8") as metrics_file:
            app.state.metrics = json.load(metrics_file)
        app.state.feedback_path = str(FEEDBACK_HISTORY_PATH)
        # Cache the cleaned event log once so /incidents/sample does not
        # reload and re-clean ~8k rows from disk on every request.
        app.state.events_df = (
            load_events(str(RAW_EVENTS_PATH)) if RAW_EVENTS_PATH.exists() else None
        )
        print(
            f"Loaded artifacts: classifier, regressor, rates, clusters, {len(app.state.feature_columns)} features"
        )
    except Exception as exc:
        raise RuntimeError(f"Failed to load model artifacts: {exc}")

    yield

    app.state.classifier = None
    app.state.regressor = None
    app.state.rates = None
    app.state.spatial_cluster_model = None
    app.state.feature_columns = None
    app.state.metrics = None
    app.state.feedback_path = None
    app.state.events_df = None


app = FastAPI(
    title="FLOWITS // Traffic Incident Severity & Mitigation System",
    description="Provides incident severity predictions, resource allocation plans, and feedback logging.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # Public read/predict API with no cookies or auth, so any origin may call it.
    # allow_credentials must be False when allow_origins is "*".
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api", tags=["Root"])
def root() -> Dict[str, Any]:
    return {
        "service": "FLOWITS // Traffic Incident Severity & Mitigation System",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "health": "GET /health",
            "predict": "POST /predict",
            "allocate": "POST /allocate",
            "feedback_log": "POST /feedback/log",
            "feedback_history": "GET /feedback/history",
            "sample_incidents": "GET /incidents/sample",
            "corridors": "GET /corridors",
            "model_info": "GET /model-info",
        },
    }


@app.get("/health")
def get_health() -> Dict[str, Any]:
    model_loaded = (
        hasattr(app.state, "classifier")
        and app.state.classifier is not None
        and hasattr(app.state, "regressor")
        and app.state.regressor is not None
    )
    metrics = getattr(app.state, "metrics", {}) or {}
    return {
        "status": "ok" if model_loaded else "degraded",
        "model_loaded": model_loaded,
        "metrics": {
            "cv_f1_mean": metrics.get("cross_validation", {}).get("cv_f1_mean", 0.0),
            "cv_f1_std": metrics.get("cross_validation", {}).get("cv_f1_std", 0.0),
            "classifier_f1": metrics.get("classifier", {}).get("f1_weighted", 0.0),
            "classifier_auc": metrics.get("classifier", {}).get("roc_auc_ovr", 0.0),
            "regressor_mae": metrics.get("regressor", {}).get("mae_minutes", 0.0),
        },
        "known_limitations": metrics.get("known_limitations", []),
    }


@app.get("/model-info")
def get_model_info() -> Dict[str, Any]:
    metrics = getattr(app.state, "metrics", {}) or {}
    cv_results = metrics.get("cross_validation", {})
    class_metrics = metrics.get("classifier", {})
    reg_metrics = metrics.get("regressor", {})
    return {
        "classifier_f1": class_metrics.get("f1_weighted", 0.0),
        "classifier_auc": class_metrics.get("roc_auc_ovr", 0.0),
        "cv_f1_mean": cv_results.get("cv_f1_mean", 0.0),
        "cv_f1_std": cv_results.get("cv_f1_std", 0.0),
        "regressor_mae": reg_metrics.get("mae_minutes", 0.0),
        "regressor_rmse": reg_metrics.get("rmse_minutes", 0.0),
        "n_features": len(getattr(app.state, "feature_columns", []) or []),
        "feature_columns": getattr(app.state, "feature_columns", []) or [],
        "class_labels": metrics.get("class_labels", {}),
        "performance_notes": [
            "Classifier F1 of 0.856 with ±0.010 CV std indicates stable performance.",
            "ROC AUC 0.975 is high; model is well-calibrated but imbalanced on rare classes.",
            "⚠ Classes 2 & 3 have low F1 scores, so high-severity predictions should be verified.",
            "Regression MAE is ~52.5 minutes; duration estimates are approximate.",
        ],
    }


@app.post("/predict", response_model=PredictionResponse)
def predict_incident(payload: IncidentInput) -> PredictionResponse:
    try:
        start_datetime = _make_start_timestamp(payload.hour_of_day, payload.day_of_week)

        incident_row = pd.Series(
            {
                "event_cause": payload.event_cause,
                "event_type": "planned" if payload.planned else "unplanned",
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "start_datetime": start_datetime,
                "priority": payload.priority,
                "veh_type": payload.veh_type or "unknown",
                "corridor": payload.corridor,
                "zone": payload.zone,
                "junction": payload.junction,
            }
        )

        features = build_feature_vector(
            incident_row, app.state.rates, app.state.spatial_cluster_model
        )
        X = pd.DataFrame([features])[app.state.feature_columns]

        y_pred_probs = app.state.classifier.predict_proba(X)[0]
        class_thresholds = app.state.metrics.get("class_thresholds", {})
        t2 = class_thresholds.get("class_2", 0.5)
        t3 = class_thresholds.get("class_3", 0.5)

        threshold_adjusted = False
        if y_pred_probs[3] >= t3:
            predicted_class = 3
            threshold_adjusted = True
        elif y_pred_probs[2] >= t2:
            predicted_class = 2
            threshold_adjusted = True
        else:
            predicted_class = int(np.argmax(y_pred_probs))

        duration_minutes = float(app.state.regressor.predict(X)[0])
        severity_labels = {
            0: "Monitor only",
            1: "Single officer",
            2: "Standard response",
            3: "Maximum response",
        }

        impact = assess_impact(
            event_cause=payload.event_cause,
            planned_flag=payload.planned,
            ml_severity_class=predicted_class,
            duration_minutes=duration_minutes,
            is_peak_hour=bool(features.get("is_peak_hour", 0)),
            hour_of_day=payload.hour_of_day,
            corridor_rate=float(features["corridor_closure_rate"]),
        )

        return PredictionResponse(
            severity_class=predicted_class,
            severity_label=severity_labels.get(predicted_class, "Unknown"),
            class_probabilities=[round(float(p), 4) for p in y_pred_probs],
            threshold_adjusted=threshold_adjusted,
            estimated_duration_minutes=round(duration_minutes, 1),
            zone_closure_rate=float(features["zone_closure_rate"]),
            corridor_closure_rate=float(features["corridor_closure_rate"]),
            model_f1_weighted=float(app.state.metrics.get("classifier", {}).get("f1_weighted", 0.0)),
            model_mae_minutes=float(app.state.metrics.get("regressor", {}).get("mae_minutes", 0.0)),
            cv_f1_mean=float(app.state.metrics.get("cross_validation", {}).get("cv_f1_mean", 0.0)),
            cv_f1_std=float(app.state.metrics.get("cross_validation", {}).get("cv_f1_std", 0.0)),
            feature_importances=app.state.metrics.get("feature_importances", []),
            impact=impact,
        )
    except Exception as exc:
        # Log the detail server-side; return a generic message to the client.
        print(f"Prediction error: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Prediction failed. Verify the incident fields and try again.",
        )


@app.post("/allocate", response_model=AllocationResponse)
def allocate_resources_endpoint(payload: AllocationRequest) -> AllocationResponse:
    if payload.corridor not in SUPPORTED_CORRIDORS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported corridor '{payload.corridor}'. Supported corridors: {SUPPORTED_CORRIDORS}",
        )
    if payload.severity_class not in {0, 1, 2, 3}:
        raise HTTPException(status_code=400, detail="severity_class must be 0, 1, 2, or 3")

    graph = build_graph(payload.corridor)
    probability = payload.severity_class / 3.0
    node_scores = get_node_impact_scores(
        graph,
        probability,
        payload.incident_latitude,
        payload.incident_longitude,
        app.state.rates,
        payload.corridor,
    )

    plan = allocate_resources(
        node_scores,
        payload.severity_class,
        graph,
        available_officers=payload.available_officers,
        available_barricades=payload.available_barricades,
    )
    # De-duplicate node IDs so a junction that receives both an officer and a
    # barricade is only mitigated once (otherwise the reduction is overstated).
    deployed_node_ids = list({allocation["node_id"] for allocation in plan})
    unmanaged_score, managed_score = compute_before_after(node_scores, deployed_node_ids)
    reduction_percent = (
        round(100.0 * (unmanaged_score - managed_score) / unmanaged_score, 2)
        if unmanaged_score > 0
        else 0.0
    )

    diversion = compute_diversion(
        graph, payload.incident_latitude, payload.incident_longitude
    )

    return AllocationResponse(
        deployment_plan=plan,
        risk_score_unmanaged=round(unmanaged_score, 4),
        risk_score_managed=round(managed_score, 4),
        reduction_percent=reduction_percent,
        mitigation_assumption=(
            "Prototype node assignment assumes a 35% impact reduction per resourced node. "
            "Use this as a planning estimate pending operational calibration."
        ),
        diversion=diversion,
    )


@app.post("/feedback/log")
def log_feedback(entry: FeedbackEntry) -> Dict[str, bool]:
    try:
        log_outcome(entry, app.state.feedback_path)
        return {"logged": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Feedback logging failed: {exc}")


@app.get("/feedback/history", response_model=FeedbackHistoryResponse)
def feedback_history() -> FeedbackHistoryResponse:
    history_df = load_history(app.state.feedback_path)
    records = [
        {
            "incident_id": str(row["incident_id"]),
            "incident_date": str(row["incident_date"]),
            "predicted": float(row["predicted"]),
            "actual": int(row["actual"]),
            "correct": bool(row["correct"]),
            "error": float(row["error"]),
        }
        for row in history_df.to_dict(orient="records")
    ]

    return FeedbackHistoryResponse(
        history=records,
        running_accuracy=round(compute_running_accuracy(history_df), 4),
    )


@app.get("/incidents/sample", response_model=List[SampleIncident])
def sample_incidents() -> List[SampleIncident]:
    df = getattr(app.state, "events_df", None)
    if df is None:
        raise HTTPException(status_code=500, detail=f"Sample incident source not found: {RAW_EVENTS_PATH}")

    supported_df = df[df["corridor"].isin(SUPPORTED_CORRIDORS)]
    if supported_df.empty:
        raise HTTPException(
            status_code=500,
            detail="No sample incidents found for supported corridors.",
        )

    sample_df = supported_df.sample(n=min(12, len(supported_df)), random_state=42)
    return [
        {
            "id": str(row["id"]),
            "event_cause": row["event_cause"],
            "priority": row["priority"],
            "veh_type": row.get("veh_type", None),
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "corridor": row["corridor"],
            "zone": row.get("zone", None),
            "junction": row.get("junction", None),
            "start_datetime": pd.Timestamp(row["start_datetime"]).isoformat(),
        }
        for _, row in sample_df.iterrows()
    ]


@app.get("/corridors")
def corridors() -> List[str]:
    return SUPPORTED_CORRIDORS


@app.get("/locations", response_model=List[LocationOption])
def locations() -> List[Dict[str, Any]]:
    """Named junctions across supported corridors — so officers pick a place,
    not coordinates."""
    return list_locations()


@app.get("/events/upcoming", response_model=UpcomingEventsResponse)
def upcoming_events() -> Dict[str, Any]:
    """Ingest upcoming/recent events from a live news feed (with a curated
    fallback) and tag each with a supported-corridor location where recognised."""
    return get_upcoming_events()


@app.get("/corridor-profile")
def corridor_profile(corridor: str) -> Dict[str, Any]:
    """Historical analytics for a corridor — used by the briefing report's
    peak-risk-by-hour chart. Computed from the real incident history."""
    df = getattr(app.state, "events_df", None)
    if df is None:
        raise HTTPException(status_code=500, detail="Incident history not loaded.")
    sub = df[df["corridor"] == corridor]
    hourly = sub["start_datetime"].dt.hour.value_counts().reindex(range(24), fill_value=0)
    return {
        "corridor": corridor,
        "total_incidents": int(len(sub)),
        "planned": int((sub["event_type"] == "planned").sum()),
        "unplanned": int((sub["event_type"] == "unplanned").sum()),
        "closure_rate": float(sub["requires_road_closure"].mean()) if len(sub) else 0.0,
        "hourly": [{"hour": int(h), "count": int(hourly[h])} for h in range(24)],
    }


# ── Serve the built frontend (single-link deploy) ──
# When backend/static exists (the production frontend build copied in), serve it
# at the root so one Railway URL delivers both the UI and the API. API routes are
# registered above, so they take precedence over this catch-all mount.
STATIC_DIR = BASE_DIR / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="frontend")
