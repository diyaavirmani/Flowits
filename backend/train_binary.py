"""
train_binary.py
Helper script to train the binary classifier model (requires_road_closure)
and save it as model_artifacts/model.pkl and metrics.json, without modifying
any Phase 1 or Phase 2 files.
"""

import os
import sys
import json
import pickle
import pandas as pd
from sklearn.model_selection import StratifiedShuffleSplit
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
)

# Insert src directory to path to import loaded files
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "src")))

from data_loader import load_events
from feature_engineering import (
    compute_historical_rates,
    build_feature_vector,
    PRIORITY_MAP,
    PRIORITY_DEFAULT
)

# ═══════════════════════════════════════════════════════════════════
# Configuration & Stated Assumptions
# ═══════════════════════════════════════════════════════════════════
DATA_PATH = os.path.join("data", "raw", "events.csv")
ARTIFACTS_DIR = os.path.join("model_artifacts")

TEST_SIZE = 0.2          # stated assumption: 20% test split
RANDOM_STATE = 42        # stated assumption: reproducibility seed
IMBALANCE_THRESHOLD = 0.2  # stated assumption: minority class imbalance check

# GradientBoosting parameters (user-specified, not auto-tuned)
GBC_PARAMS = {
    "n_estimators": 100,      # stated assumption: 100 boosting stages
    "max_depth": 4,           # stated assumption: max tree depth of 4
    "learning_rate": 0.1,     # stated assumption: shrinkage/learning rate of 0.1
    "subsample": 0.8,         # stated assumption: subsampling rate of 0.8
    "random_state": RANDOM_STATE,
}


def build_dataset_binary(df: pd.DataFrame, rates: dict) -> tuple:
    """
    Build features and target vector for binary classification.
    """
    # Pre-encode priority for mapping feature values
    df_work = df.copy()
    df_work["priority_encoded"] = (
        df_work["priority"]
        .map(PRIORITY_MAP)
        .fillna(PRIORITY_DEFAULT)
        .astype(int)
    )

    feature_rows = []
    targets = []

    for _, row in df_work.iterrows():
        feature_rows.append(build_feature_vector(row, rates))
        targets.append(row["requires_road_closure"])

    X = pd.DataFrame(feature_rows)
    X = X[sorted(X.columns)]  # sort features alphabetically for consistency
    y = pd.Series(targets, name="requires_road_closure")

    return X, y


def main():
    print("=" * 60)
    print("FLOW -- Binary Training Pipeline")
    print("=" * 60)

    # == Step 1: Load data ==========================================
    print(f"\nStep 1: Loading data from {DATA_PATH}")
    try:
        df = load_events(DATA_PATH)
    except Exception as e:
        print(f"Error loading events: {e}")
        sys.exit(1)
    print(f"  Loaded {len(df)} rows.\n")

    # == Step 2: Imbalance check & Split =============================
    target_dist = df["requires_road_closure"].value_counts(normalize=True)
    minority_pct = float(target_dist.min())
    print("Class distribution of requires_road_closure:")
    for cls, pct in target_dist.items():
        print(f"  Class {cls}: {pct:.4f}")

    class_weight = None
    if minority_pct < IMBALANCE_THRESHOLD:
        print(f"  [WARNING] Minority class fraction {minority_pct:.4f} < {IMBALANCE_THRESHOLD}")
        print("  Setting class_weight='balanced' (simulated via sample_weight during fit)")
        class_weight = "balanced"

    splitter = StratifiedShuffleSplit(
        n_splits=1,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
    )
    train_idx, test_idx = next(splitter.split(df, df["requires_road_closure"]))
    df_train = df.iloc[train_idx].reset_index(drop=True)
    df_test = df.iloc[test_idx].reset_index(drop=True)

    # == Step 3: Compute Rates ======================================
    print("\nStep 3: Computing historical rates...")
    rates = compute_historical_rates(df_train)

    # == Step 4: Build datasets =====================================
    print("\nStep 4: Building datasets...")
    X_train, y_train = build_dataset_binary(df_train, rates)
    X_test, y_test = build_dataset_binary(df_test, rates)
    print(f"  X_train shape: {X_train.shape}, X_test shape: {X_test.shape}")

    # == Step 5: Train Model ========================================
    print("\nStep 5: Training GradientBoostingClassifier...")
    model = GradientBoostingClassifier(**GBC_PARAMS)

    if class_weight == "balanced":
        # Calculate sample weights for imbalance mitigation
        from sklearn.utils.class_weight import compute_sample_weight
        sample_weights = compute_sample_weight("balanced", y_train)
        model.fit(X_train, y_train, sample_weight=sample_weights)
    else:
        model.fit(X_train, y_train)
    print("  Model training complete.")

    # == Step 6: Evaluate ===========================================
    print("\nStep 6: Evaluating model on test set...")
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, average="binary"))
    rec = float(recall_score(y_test, y_pred, average="binary"))
    f1 = float(f1_score(y_test, y_pred, average="binary"))
    auc = float(roc_auc_score(y_test, y_prob))

    print(f"  Accuracy:  {acc:.4f}")
    print(f"  Precision: {prec:.4f}")
    print(f"  Recall:    {rec:.4f}")
    print(f"  F1 Score:  {f1:.4f}")
    print(f"  ROC AUC:   {auc:.4f}")

    # == Step 7: Feature Importances ===============================
    importances = model.feature_importances_
    features = list(X_train.columns)
    importance_list = [
        {"feature": name, "importance": round(float(imp), 6)}
        for name, imp in zip(features, importances)
    ]
    # Sort descending
    importance_list.sort(key=lambda x: x["importance"], reverse=True)

    print("\nTop 5 features:")
    for item in importance_list[:5]:
        print(f"  {item['feature']}: {item['importance']:.4f}")

    # == Step 8: Save Artifacts =====================================
    print("\nStep 8: Saving artifacts...")
    try:
        os.makedirs(ARTIFACTS_DIR, exist_ok=True)

        model_path = os.path.join(ARTIFACTS_DIR, "model.pkl")
        with open(model_path, "wb") as f:
            pickle.dump(model, f)
        print(f"  Saved model to {model_path}")

        rates_path = os.path.join(ARTIFACTS_DIR, "historical_rates.pkl")
        with open(rates_path, "wb") as f:
            pickle.dump(rates, f)
        print(f"  Saved historical rates to {rates_path}")

        metrics_path = os.path.join(ARTIFACTS_DIR, "metrics.json")
        metrics_json = {
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "f1": f1,
            "roc_auc": auc,
            "feature_importances": importance_list,
        }
        with open(metrics_path, "w", encoding="utf-8") as f:
            json.dump(metrics_json, f, indent=2)
        print(f"  Saved metrics to {metrics_path}")

    except Exception as e:
        print(f"Error saving model artifacts: {e}")
        sys.exit(1)

    print("\nAll binary model training artifacts created successfully.")


if __name__ == "__main__":
    main()
