"""
feature_engineering.py
Single responsibility: Compute all features and labels from the
cleaned DataFrame.
"""

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans


def create_severity_class(row: pd.Series) -> int:
    """
    Constructs the 4-class severity label from two existing columns.
    Class meanings:
      0 = Monitor only       (no closure, low/medium priority)
      1 = Single officer     (no closure, high priority)
      2 = Standard response  (closure, low/medium priority)
      3 = Maximum response   (closure, high priority)
    """
    priority_encoded = {"High": 2, "Medium": 1, "Low": 0}.get(row['priority'], 1)
    closure = int(row['requires_road_closure'])
    if closure == 0 and priority_encoded <= 1:
        return 0
    if closure == 0 and priority_encoded == 2:
        return 1
    if closure == 1 and priority_encoded <= 1:
        return 2
    return 3


def compute_resolution_minutes(row: pd.Series):
    """
    Computes incident duration in minutes from start to last modification.
    Returns None for rows where duration is invalid or unreliable.
    Excluded: duration <= 0 (data error), duration > 720 (12 hours, likely error).
    """
    if pd.isna(row['modified_datetime']) or pd.isna(row['start_datetime']):
        return None
    duration = (row['modified_datetime'] - row['start_datetime']).total_seconds() / 60
    if duration <= 0 or duration > 720:
        return None
    return round(duration, 2)


def fit_spatial_clusters(df: pd.DataFrame, n_clusters: int = 15) -> KMeans:
    """
    Fits K-Means on latitude/longitude to create spatial clusters.
    This fills the 57% null gap in the zone column by assigning every
    incident to a geographic cluster, regardless of zone availability.
    n_clusters=15 chosen to provide finer granularity than the 10
    administrative zones while keeping clusters large enough to compute
    reliable closure rates.
    """
    coords = df[['latitude', 'longitude']].values
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    kmeans.fit(coords)

    # Verify cluster sizes — warn if any cluster is too small
    labels = kmeans.labels_
    unique, counts = np.unique(labels, return_counts=True)
    print("Spatial cluster sizes:")
    for cluster_id, count in zip(unique, counts):
        status = "SMALL" if count < 100 else "OK"
        print(f"  Cluster {cluster_id}: {count} incidents {status}")

    return kmeans


def compute_historical_rates(df: pd.DataFrame, kmeans) -> dict:
    """
    Computes historical road closure rates per category.
    CRITICAL: This must only be called on TRAINING data.
    Calling it on the full dataset would leak test labels into training.
    """
    # Assign spatial clusters to this DataFrame
    import numpy as np
    coords = df[['latitude', 'longitude']].values
    df = df.copy()
    df['spatial_cluster'] = kmeans.predict(coords)

    global_mean = float(df['requires_road_closure'].mean())

    def rate_dict(df, col):
        return df.groupby(col)['requires_road_closure'].mean().to_dict()

    rates = {
        "zone_closure_rate": rate_dict(df, 'zone'),
        "junction_closure_rate": rate_dict(df, 'junction'),
        "corridor_closure_rate": rate_dict(df, 'corridor'),
        "cause_closure_rate": rate_dict(df, 'event_cause'),
        "spatial_cluster_closure_rate": rate_dict(df, 'spatial_cluster'),
        "zone_incident_count": df.groupby('zone').size().to_dict(),
        "global_mean": global_mean
    }

    print(f"Historical rates computed from {len(df)} training rows.")
    print(f"Global mean closure rate: {global_mean:.3f}")
    return rates


def build_feature_vector(row: pd.Series, rates: dict, kmeans) -> dict:
    """
    Builds a single feature vector for one incident.
    All rate lookups fall back to global_mean for unseen categories.
    """
    import numpy as np
    fallback = rates["global_mean"]

    # Spatial cluster for this row
    coords = np.array([[row['latitude'], row['longitude']]])
    cluster_id = int(kmeans.predict(coords)[0])

    hour = row['start_datetime'].hour
    dow = row['start_datetime'].dayofweek

    return {
        "hour_of_day": int(hour),
        "day_of_week": int(dow),
        "is_weekend": int(dow in [5, 6]),
        "is_peak_hour": int(hour in [7, 8, 9, 17, 18, 19, 20]),
        "priority_encoded": {"High": 2, "Medium": 1, "Low": 0}.get(
            str(row['priority']), 1
        ),
        "zone_closure_rate": rates["zone_closure_rate"].get(
            row['zone'], fallback
        ),
        "junction_closure_rate": rates["junction_closure_rate"].get(
            row['junction'], fallback
        ),
        "corridor_closure_rate": rates["corridor_closure_rate"].get(
            row['corridor'], fallback
        ),
        "cause_closure_rate": rates["cause_closure_rate"].get(
            row['event_cause'], fallback
        ),
        "zone_incident_count": float(
            rates["zone_incident_count"].get(row['zone'], 0)
        ),
        "spatial_cluster_closure_rate": rates[
            "spatial_cluster_closure_rate"
        ].get(cluster_id, fallback),
    }


def build_dataset(df: pd.DataFrame, rates: dict, kmeans) -> tuple:
    """
    Applies build_feature_vector to every row.
    Returns (X, y_class, y_duration) as (DataFrame, Series, Series).
    Feature columns are alphabetically sorted for consistency.
    """
    feature_rows = []
    y_class_list = []
    y_duration_list = []

    for _, row in df.iterrows():
        features = build_feature_vector(row, rates, kmeans)
        feature_rows.append(features)
        y_class_list.append(create_severity_class(row))
        y_duration_list.append(compute_resolution_minutes(row))

    X = pd.DataFrame(feature_rows)
    X = X.reindex(sorted(X.columns), axis=1)  # alphabetical sort
    y_class = pd.Series(y_class_list, name='severity_class')
    y_duration = pd.Series(y_duration_list, name='resolution_minutes')

    print(f"\nDataset built: {X.shape[0]} rows x {X.shape[1]} features")
    print(f"Severity class distribution:\n{y_class.value_counts().sort_index()}")
    print(f"Resolution minutes: {y_duration.notna().sum()} valid rows "
          f"({y_duration.isna().sum()} excluded)")

    return X, y_class, y_duration



if __name__ == "__main__":
    from data_loader import load_events

    df = load_events("data/raw/events.csv")

    # Use first 80% as fake training data for testing
    train_df = df.iloc[:int(len(df)*0.8)]
    test_df = df.iloc[int(len(df)*0.8):]

    kmeans = fit_spatial_clusters(train_df, n_clusters=15)
    rates = compute_historical_rates(train_df, kmeans)
    X, y_class, y_dur = build_dataset(train_df, rates, kmeans)

    assert X.shape[1] == 11, f"Expected 11 features, got {X.shape[1]}"
    assert X.isnull().sum().sum() == 0, "Feature matrix has null values"
    assert y_class.between(0, 3).all(), "Severity class out of range"
    assert len(X) == len(y_class) == len(y_dur)
    print("feature_engineering.py: all assertions passed")
