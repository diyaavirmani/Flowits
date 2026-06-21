"""
model.py
Single responsibility: Train, evaluate, and load/save ML models.
Follows HELM Prompt C exactly.
"""

import numpy as np


def train_classifier(X_train, y_train):
    """
    Trains a GradientBoostingClassifier with balanced class weights.
    GradientBoostingClassifier does not accept class_weight directly,
    so we compute per-sample weights and pass them to fit().
    """
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.utils.class_weight import compute_class_weight

    # Compute balanced sample weights
    classes = np.unique(y_train)
    weights = compute_class_weight(
        class_weight='balanced',
        classes=classes,
        y=y_train
    )
    weight_dict = dict(zip(classes, weights))
    sample_weights = np.array([weight_dict[label] for label in y_train])

    print(f"Class weights: {weight_dict}")

    model = GradientBoostingClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42
    )
    model.fit(X_train, y_train, sample_weight=sample_weights)
    print("Classifier trained.")
    return model


def train_regressor(X_train, y_duration_train):
    """
    Trains a GradientBoostingRegressor on incident resolution time.
    Filters to rows where y_duration_train is not NaN before training.
    """
    from sklearn.ensemble import GradientBoostingRegressor

    mask = y_duration_train.notna()
    X_reg = X_train[mask]
    y_reg = y_duration_train[mask]

    print(f"Regressor training on {len(y_reg)} rows "
          f"({(~mask).sum()} excluded - null duration)")

    if len(y_reg) < 500:
        raise ValueError(
            f"Too few rows for regression: {len(y_reg)}. "
            f"Check compute_resolution_minutes() filtering logic."
        )

    model = GradientBoostingRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42
    )
    model.fit(X_reg, y_reg)
    print("Regressor trained.")
    return model


def evaluate_classifier(model, X_test, y_test) -> dict:
    """
    Evaluates the classifier on held-out test data.
    Returns all metrics as a dict. Prints confusion matrix.
    Uses weighted averaging for multi-class metrics.
    """
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score,
        f1_score, roc_auc_score, ConfusionMatrixDisplay,
        classification_report
    )

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision_weighted": round(
            float(precision_score(y_test, y_pred, average='weighted', zero_division=0)), 4
        ),
        "recall_weighted": round(
            float(recall_score(y_test, y_pred, average='weighted', zero_division=0)), 4
        ),
        "f1_weighted": round(
            float(f1_score(y_test, y_pred, average='weighted', zero_division=0)), 4
        ),
        "roc_auc_ovr": round(
            float(roc_auc_score(
                y_test, y_prob,
                multi_class='ovr',
                average='weighted'
            )), 4
        ),
        "per_class_f1": {}
    }

    # Per-class F1 scores
    per_class = f1_score(y_test, y_pred, average=None, zero_division=0)
    for i, score in enumerate(per_class):
        metrics["per_class_f1"][str(i)] = round(float(score), 4)
        status = "LOW" if score < 0.10 else "OK"
        print(f"  Class {i} F1: {score:.3f} {status}")

    print(f"\nWeighted F1:  {metrics['f1_weighted']}")
    print(f"ROC AUC OVR:  {metrics['roc_auc_ovr']}")
    print(f"\nClassification Report:\n{classification_report(y_test, y_pred, zero_division=0)}")

    # Stop and warn if any class has very low F1
    low_classes = [k for k, v in metrics["per_class_f1"].items() if v < 0.10]
    if low_classes:
        print(f"\nWARNING: Classes {low_classes} have F1 < 0.10")
        print("Consider collapsing to 3 classes (see Fix 1 prompt)")

    return metrics


def evaluate_regressor(model, X_test, y_duration_test) -> dict:
    """
    Evaluates the regressor on held-out test data.
    Filters to non-null rows before evaluating.
    """
    from sklearn.metrics import mean_absolute_error, mean_squared_error

    mask = y_duration_test.notna()
    X_reg_test = X_test[mask]
    y_reg_test = y_duration_test[mask]

    if len(y_reg_test) == 0:
        raise ValueError("No valid rows in test set for regression evaluation.")

    y_pred = model.predict(X_reg_test)

    mae = float(mean_absolute_error(y_reg_test, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_reg_test, y_pred)))

    metrics = {
        "mae_minutes": round(mae, 2),
        "rmse_minutes": round(rmse, 2),
        "test_rows": int(len(y_reg_test))
    }

    print(f"\nRegressor - MAE: {mae:.1f} min | RMSE: {rmse:.1f} min")
    print(f"Evaluated on {len(y_reg_test)} rows")
    return metrics


def cross_validate_classifier(X, y, n_splits=5) -> dict:
    """
    Runs stratified K-Fold cross-validation on the full dataset.
    Call this BEFORE the train/test split to get stable metrics.
    Returns mean and std of F1 and AUC across folds.
    """
    from sklearn.model_selection import StratifiedKFold
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.utils.class_weight import compute_class_weight
    from sklearn.metrics import f1_score, roc_auc_score
    import numpy as np

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    fold_f1s = []
    fold_aucs = []

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y)):
        X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

        classes = np.unique(y_tr)
        weights = compute_class_weight('balanced', classes=classes, y=y_tr)
        weight_dict = dict(zip(classes, weights))
        sw = np.array([weight_dict[label] for label in y_tr])

        m = GradientBoostingClassifier(
            n_estimators=100, max_depth=4,
            learning_rate=0.1, subsample=0.8, random_state=42
        )
        m.fit(X_tr, y_tr, sample_weight=sw)

        y_pred = m.predict(X_val)
        y_prob = m.predict_proba(X_val)

        f1 = f1_score(y_val, y_pred, average='weighted', zero_division=0)
        auc = roc_auc_score(
            y_val, y_prob, multi_class='ovr', average='weighted'
        )
        fold_f1s.append(f1)
        fold_aucs.append(auc)
        print(f"  Fold {fold+1}: F1={f1:.3f} | AUC={auc:.3f}")

    result = {
        "cv_f1_mean": round(float(np.mean(fold_f1s)), 4),
        "cv_f1_std": round(float(np.std(fold_f1s)), 4),
        "cv_auc_mean": round(float(np.mean(fold_aucs)), 4),
        "cv_auc_std": round(float(np.std(fold_aucs)), 4),
        "n_folds": n_splits
    }
    print(f"\nCV F1:  {result['cv_f1_mean']:.3f} +/- {result['cv_f1_std']:.3f}")
    print(f"CV AUC: {result['cv_auc_mean']:.3f} +/- {result['cv_auc_std']:.3f}")

    if result['cv_f1_std'] > 0.10:
        print("WARNING: High variance across folds. Model may be unstable.")

    return result


def get_feature_importances(model, feature_names) -> list[dict]:
    """
    Returns feature importances sorted by importance descending.
    """
    importances = model.feature_importances_
    paired = sorted(
        zip(feature_names, importances),
        key=lambda x: x[1],
        reverse=True
    )
    result = [{"feature": f, "importance": round(float(i), 6)} for f, i in paired]
    print("\nTop 5 feature importances:")
    for item in result[:5]:
        print(f"  {item['feature']}: {item['importance']:.4f}")
    return result


def find_class_thresholds(model, X_val, y_val,
                           target_recall_high=0.60,
                           max_f1_drop_low=0.05) -> dict:
    """
    Finds lower probability thresholds for Classes 2 and 3
    to improve recall on high-severity incidents.
    
    Balances the tradeoff:
    - Improves recall on Classes 2/3
    - But doesn't hurt Classes 0/1 F1 by more than max_f1_drop_low
    
    Uses a smarter search: evaluates all-class F1 impact, not just individual class.
    """
    from sklearn.metrics import f1_score, recall_score

    probs = model.predict_proba(X_val)

    # Get baseline (argmax) predictions
    y_pred_baseline = np.argmax(probs, axis=1)
    f1_baseline_0 = f1_score(y_val, y_pred_baseline, labels=[0], average='macro', zero_division=0)
    f1_baseline_1 = f1_score(y_val, y_pred_baseline, labels=[1], average='macro', zero_division=0)

    # Search thresholds: try coarser grid first
    best = {"class_2": 0.5, "class_3": 0.5}
    best_recall_sum = 0.0
    best_rec_2 = 0.0
    best_rec_3 = 0.0

    thresholds = np.arange(0.20, 0.51, 0.05)  # Start higher, move gradually lower

    for t in thresholds:
        y_pred_adjusted = []
        for prob_row in probs:
            if prob_row[3] >= t:
                y_pred_adjusted.append(3)
            elif prob_row[2] >= t:
                y_pred_adjusted.append(2)
            else:
                y_pred_adjusted.append(int(np.argmax(prob_row)))

        # Check low-class F1 impact
        f1_0 = f1_score(y_val, y_pred_adjusted, labels=[0], average='macro', zero_division=0)
        f1_1 = f1_score(y_val, y_pred_adjusted, labels=[1], average='macro', zero_division=0)
        f1_drop_0 = f1_baseline_0 - f1_0
        f1_drop_1 = f1_baseline_1 - f1_1

        # Skip if drop is too large
        if f1_drop_0 > max_f1_drop_low or f1_drop_1 > max_f1_drop_low:
            continue

        # Compute recalls for high classes
        rec_2 = recall_score(y_val, y_pred_adjusted, labels=[2], average='macro', zero_division=0)
        rec_3 = recall_score(y_val, y_pred_adjusted, labels=[3], average='macro', zero_division=0)
        recall_sum = rec_2 + rec_3

        # Track best threshold that meets constraints
        if recall_sum > best_recall_sum:
            best_recall_sum = recall_sum
            best["class_2"] = float(t)
            best["class_3"] = float(t)
            best_rec_2 = rec_2
            best_rec_3 = rec_3

    print(f"Threshold search complete:")
    print(f"  Best balanced threshold: {best['class_2']:.2f}")
    print(f"  Class 2 recall: {best_rec_2:.3f}")
    print(f"  Class 3 recall: {best_rec_3:.3f}")
    print(f"  Constraint: Class 0/1 F1 drop < {max_f1_drop_low:.2f}")

    return best


if __name__ == "__main__":
    import numpy as np
    import pandas as pd
    from model import train_classifier, train_regressor

    X_dummy = pd.DataFrame(np.random.rand(200, 11),
                          columns=[f"f{i}" for i in range(11)])
    y_class = pd.Series(np.random.randint(0, 4, 200))
    y_dur = pd.Series(np.where(np.random.rand(200) > 0.2,
                    np.random.rand(200) * 120, np.nan))

    clf = train_classifier(X_dummy, y_class)
    reg = train_regressor(X_dummy, y_dur)
    print("model.py: dummy training passed")
