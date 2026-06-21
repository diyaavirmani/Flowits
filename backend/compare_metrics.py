"""
Compare classifier metrics before and after threshold adjustment.
Quantifies the tradeoff: higher recall for Classes 2/3 vs precision loss in Classes 0/1.

Run with: python compare_metrics.py
"""

import joblib
import json
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, f1_score, recall_score
from src.data_loader import load_events
from src.feature_engineering import (
    fit_spatial_clusters, compute_historical_rates,
    build_dataset, create_severity_class, compute_resolution_minutes
)
from sklearn.model_selection import train_test_split

# ── Load everything ──────────────────────────────────────
print("Loading artifacts...")
classifier  = joblib.load("model_artifacts/classifier.pkl")
kmeans      = joblib.load("model_artifacts/spatial_cluster_model.pkl")
rates       = joblib.load("model_artifacts/historical_rates.pkl")
metrics     = json.load(open("model_artifacts/metrics.json"))

df = load_events("data/raw/events.csv")
df['severity_class']     = df.apply(create_severity_class, axis=1)
df['resolution_minutes'] = df.apply(compute_resolution_minutes, axis=1)

_, df_test = train_test_split(
    df, test_size=0.2, random_state=42,
    stratify=df['severity_class']
)

X_test, y_test, _ = build_dataset(df_test, rates, kmeans)
probs = classifier.predict_proba(X_test)

print(f"Test set size: {len(y_test)} rows\n")

# ── BEFORE: standard argmax prediction ───────────────────
y_pred_before = np.argmax(probs, axis=1)

# ── AFTER: threshold-adjusted prediction ─────────────────
t2 = metrics["class_thresholds"]["class_2"]
t3 = metrics["class_thresholds"]["class_3"]

print(f"Using thresholds: Class 2={t2:.2f}, Class 3={t3:.2f}\n")

y_pred_after = []
for prob_row in probs:
    if prob_row[3] >= t3:
        y_pred_after.append(3)
    elif prob_row[2] >= t2:
        y_pred_after.append(2)
    else:
        y_pred_after.append(int(np.argmax(prob_row)))

y_pred_after = np.array(y_pred_after)

# ── PRINT COMPARISON ──────────────────────────────────────
labels    = ["0-Monitor", "1-SingleOfficer", "2-Standard", "3-Maximum"]
classes   = [0, 1, 2, 3]

print("=" * 70)
print("BEFORE threshold adjustment (standard argmax)")
print("=" * 70)
print(classification_report(y_test, y_pred_before,
      target_names=labels, zero_division=0))

print("=" * 70)
print("AFTER threshold adjustment")
print("=" * 70)
print(classification_report(y_test, y_pred_after,
      target_names=labels, zero_division=0))

print("=" * 70)
print("DELTA — what changed")
print("=" * 70)
for cls, name in zip(classes, labels):
    f1_before = f1_score(y_test, y_pred_before,
                         labels=[cls], average='macro', zero_division=0)
    f1_after  = f1_score(y_test, y_pred_after,
                         labels=[cls], average='macro', zero_division=0)
    rec_before = recall_score(y_test, y_pred_before,
                              labels=[cls], average='macro', zero_division=0)
    rec_after  = recall_score(y_test, y_pred_after,
                              labels=[cls], average='macro', zero_division=0)
    delta_f1  = f1_after - f1_before
    delta_rec = rec_after - rec_before
    sign_f1   = "▲" if delta_f1  > 0 else "▼" if delta_f1  < 0 else "─"
    sign_rec  = "▲" if delta_rec > 0 else "▼" if delta_rec < 0 else "─"
    print(f"\n{name}")
    print(f"  F1:     {f1_before:.3f} → {f1_after:.3f}  {sign_f1} {abs(delta_f1):+.3f}")
    print(f"  Recall: {rec_before:.3f} → {rec_after:.3f}  {sign_rec} {abs(delta_rec):+.3f}")

print("\n" + "=" * 70)
print("✓ Comparison complete")
print("=" * 70)
