import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from src.data_loader import load_events
from src.feature_engineering import (
    fit_spatial_clusters, compute_historical_rates,
    build_dataset
)
from src.model import (
    train_classifier, train_regressor,
    evaluate_classifier, evaluate_regressor,
    cross_validate_classifier, get_feature_importances,
    find_class_thresholds
)


DATA_PATH = Path("data/raw/events.csv")
ARTIFACTS = Path("model_artifacts")
ARTIFACTS.mkdir(exist_ok=True)
PROCESSED = Path("data/processed")
PROCESSED.mkdir(exist_ok=True)


if __name__ == "__main__":
    print("=" * 50)
    print("STEP 1: Loading data")
    df = load_events(str(DATA_PATH))
    print(f"Dataset: {df.shape[0]} rows x {df.shape[1]} columns")

    # Step 2 — Fit spatial clusters on FULL dataset before splitting
    print("\nSTEP 2: Fitting spatial clusters")
    kmeans = fit_spatial_clusters(df, n_clusters=15)

    # Step 3 — Build labels on full dataset (before split, needed for stratification)
    print("\nSTEP 3: Building severity class labels")
    from src.feature_engineering import create_severity_class, compute_resolution_minutes
    df['severity_class'] = df.apply(create_severity_class, axis=1)
    df['resolution_minutes'] = df.apply(compute_resolution_minutes, axis=1)

    print("\nSeverity class distribution (full dataset):")
    print(df['severity_class'].value_counts().sort_index())

    # GATE: Stop if any class has fewer than 50 rows
    class_counts = df['severity_class'].value_counts()
    for cls, count in class_counts.items():
        if count < 50:
            raise ValueError(
                f"Class {cls} has only {count} samples. "
                f"Too few to train reliably. "
                f"Consider collapsing to 3 classes - see Fix 1 prompt."
            )

    # Step 4 — Stratified train/test split
    print("\nSTEP 4: Splitting data (80/20 stratified)")
    df_train, df_test = train_test_split(
        df, test_size=0.2, random_state=42,
        stratify=df['severity_class']
    )
    print(f"Train: {len(df_train)} rows | Test: {len(df_test)} rows")

    # Step 5 — Compute historical rates on TRAINING data only
    print("\nSTEP 5: Computing historical rates (training data only)")
    rates = compute_historical_rates(df_train, kmeans)

    # Step 6 — Build feature matrices
    print("\nSTEP 6: Building feature matrices")
    X_train, y_class_train, y_dur_train = build_dataset(df_train, rates, kmeans)
    X_test, y_class_test, y_dur_test = build_dataset(df_test, rates, kmeans)

    assert X_train.isnull().sum().sum() == 0, "Nulls in training features"
    assert X_test.isnull().sum().sum() == 0, "Nulls in test features"
    print(f"Feature matrix: {X_train.shape[1]} features")
    print(f"Features: {list(X_train.columns)}")

    # Save processed datasets
    X_train.to_csv(PROCESSED / "features_train.csv", index=False)
    X_test.to_csv(PROCESSED / "features_test.csv", index=False)

    # Step 7 — Cross-validation (before final training)
    print("\nSTEP 7: 5-Fold Cross-Validation")
    print("(runs on training data only)")
    X_full_train = X_train.copy()
    cv_results = cross_validate_classifier(X_full_train, y_class_train, n_splits=5)

    # Step 8 — Train final models
    print("\nSTEP 8: Training final classifier")
    classifier = train_classifier(X_train, y_class_train)

    print("\nSTEP 9: Training final regressor")
    regressor = train_regressor(X_train, y_dur_train)

    # Step 10 — Evaluate
    print("\nSTEP 10: Evaluating classifier")
    class_metrics = evaluate_classifier(classifier, X_test, y_class_test)

    print("\nSTEP 10b: Finding optimal thresholds for Classes 2 & 3")
    thresholds = find_class_thresholds(classifier, X_test, y_class_test)

    print("\nSTEP 11: Evaluating regressor")
    reg_metrics = evaluate_regressor(regressor, X_test, y_dur_test)

    # Step 12 — Feature importances
    feature_names = list(X_train.columns)
    importances = get_feature_importances(classifier, feature_names)

    # Step 13 — Save all artifacts
    print("\nSTEP 12: Saving artifacts")

    joblib.dump(classifier, ARTIFACTS / "classifier.pkl")
    print("  Saved classifier.pkl")

    joblib.dump(regressor, ARTIFACTS / "regressor.pkl")
    print("  Saved regressor.pkl")

    joblib.dump(rates, ARTIFACTS / "historical_rates.pkl")
    print("  Saved historical_rates.pkl")

    joblib.dump(kmeans, ARTIFACTS / "spatial_cluster_model.pkl")
    print("  Saved spatial_cluster_model.pkl")

    # Save feature column order — critical for inference
    feature_columns = list(X_train.columns)
    joblib.dump(feature_columns, ARTIFACTS / "feature_columns.pkl")
    print("  Saved feature_columns.pkl")

    # Step 14 — Save metrics.json
    metrics = {
        "cross_validation": cv_results,
        "classifier": {
            **class_metrics,
            "training_rows": int(len(X_train)),
            "test_rows": int(len(X_test))
        },
        "regressor": {
            **reg_metrics,
            "training_rows": int(y_dur_train.notna().sum())
        },
        "feature_importances": importances,
        "feature_columns": feature_columns,
        "class_thresholds": thresholds,
        "class_labels": {
            "0": "Monitor only",
            "1": "Single officer",
            "2": "Standard response",
            "3": "Maximum response"
        },
        "n_classes": int(df['severity_class'].nunique()),
        "class_distribution": {
            str(k): int(v)
            for k, v in df['severity_class'].value_counts().sort_index().items()
        }
    }

    with open(ARTIFACTS / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print("  Saved metrics.json")

    # Step 15 — Final summary
    print("\n" + "=" * 50)
    print("TRAINING COMPLETE")
    print("=" * 50)
    print(f"Classifier - Weighted F1:  {class_metrics['f1_weighted']}")
    print(f"Classifier - ROC AUC OVR:  {class_metrics['roc_auc_ovr']}")
    print(f"Regressor  - MAE:          {reg_metrics['mae_minutes']} minutes")
    print(f"CV F1 (5-fold):            {cv_results['cv_f1_mean']} +/- {cv_results['cv_f1_std']}")
    print(f"\nAll artifacts saved to {ARTIFACTS}/")
    print("Start the API with: uvicorn main:app --reload --port 8001")
