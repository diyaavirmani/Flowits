"""
data_loader.py
Single responsibility: load events.csv, validate schema, and clean nulls.
"""

import pandas as pd
from pathlib import Path


def load_events(path: str) -> pd.DataFrame:
    """
    Load and validate events.csv.
    Returns a cleaned DataFrame ready for feature engineering.
    Raises ValueError with specific message if required columns are missing.
    """

    REQUIRED_COLUMNS = [
        'id', 'event_cause', 'latitude', 'longitude',
        'requires_road_closure', 'start_datetime', 'modified_datetime',
        'priority', 'veh_type', 'corridor', 'zone', 'junction',
        'police_station'
    ]

    # Step 1 — Read CSV
    df = pd.read_csv(path, low_memory=False)

    # Step 2 — Validate schema
    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Step 3 — Parse datetimes
    df['start_datetime'] = pd.to_datetime(df['start_datetime'], utc=True, errors='coerce')
    df['modified_datetime'] = pd.to_datetime(df['modified_datetime'], utc=True, errors='coerce')

    # Step 4 — Cast label to integer
    df['requires_road_closure'] = df['requires_road_closure'].astype(int)

    # Step 5 — Fill nulls with "unknown" (string columns only)
    for col in ['veh_type', 'corridor', 'zone', 'junction']:
        df[col] = df[col].fillna('unknown')

    # Step 6 — Fill priority nulls with "Medium"
    df['priority'] = df['priority'].fillna('Medium')

    # Step 7 — Drop rows where lat or lng is null or zero
    df = df[
        df['latitude'].notna() & df['longitude'].notna() &
        (df['latitude'] != 0.0) & (df['longitude'] != 0.0)
    ]

    # Step 8 — Drop rows where start_datetime could not be parsed
    df = df[df['start_datetime'].notna()]

    # Step 9 — Print summary before returning
    print(f"Loaded {len(df)} rows after cleaning.")
    print(f"requires_road_closure distribution:\n{df['requires_road_closure'].value_counts()}")
    print(f"Null counts in key columns:\n{df[REQUIRED_COLUMNS].isnull().sum()}")

    # Step 10 — Return df
    return df


if __name__ == "__main__":
    df = load_events("data/raw/events.csv")
    assert len(df) > 8000, "Too few rows survived cleaning"
    assert df['requires_road_closure'].isnull().sum() == 0
    assert df['latitude'].isnull().sum() == 0
    print("data_loader.py: all assertions passed")
