"""
feedback.py
Single responsibility: Load feedback logs, append new feedback entries,
and compute running statistics.
"""

import os
import pandas as pd
from src.schemas import FeedbackEntry

# The expected columns in the feedback log CSV
FEEDBACK_COLUMNS = ["incident_id", "incident_date", "predicted", "actual", "correct", "error"]


def load_history(path: str) -> pd.DataFrame:
    """
    Load the feedback outcomes history from a CSV file.

    If the file does not exist, returns an empty DataFrame with the required schema.

    Parameters
    ----------
    path : str
        File path to the feedback CSV.

    Returns
    -------
    pd.DataFrame
        Loaded history as a pandas DataFrame.
    """
    if not os.path.exists(path):
        return pd.DataFrame(columns=FEEDBACK_COLUMNS)

    try:
        df = pd.read_csv(path)
        # Ensure all columns are present even if file was modified externally
        for col in FEEDBACK_COLUMNS:
            if col not in df.columns:
                df[col] = None
        return df
    except Exception as e:
        # Graceful error handling (Rule 6)
        print(f"Error loading feedback history from '{path}': {e}")
        return pd.DataFrame(columns=FEEDBACK_COLUMNS)


def log_outcome(entry: FeedbackEntry, path: str) -> None:
    """
    Compute correctness metrics and log an outcome by appending it to the CSV.

    Parameters
    ----------
    entry : FeedbackEntry
        Pydantic model containing the incident outcome feedback details.
    path : str
        File path to save the feedback outcome log.
    """
    # ── Step 1: Calculate metrics ──
    predicted_prob = entry.predicted_probability
    actual_val = 1 if entry.actual_required_closure else 0

    # correct = True if rounded predicted probability matches the binary actual value
    correct = bool(round(predicted_prob) == actual_val)

    # error = absolute difference between predicted probability and binary actual value
    error = float(abs(predicted_prob - actual_val))

    # ── Step 2: Build row to append ──
    row_data = {
        "incident_id": entry.incident_id,
        "incident_date": entry.incident_date,
        "predicted": predicted_prob,
        "actual": actual_val,
        "correct": correct,
        "error": error,
    }
    df_new = pd.DataFrame([row_data])

    # ── Step 3: Append to CSV ──
    try:
        # Create directory if it doesn't exist
        dir_name = os.path.dirname(path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)

        # Write header if file does not exist, otherwise append without header
        header_needed = not os.path.exists(path) or os.path.getsize(path) == 0
        df_new.to_csv(path, mode="a", index=False, header=header_needed)
    except Exception as e:
        raise RuntimeError(f"Failed to log feedback outcome to '{path}': {e}")


def compute_running_accuracy(df: pd.DataFrame) -> float:
    """
    Compute the running accuracy fraction of correct predictions in the history.

    Parameters
    ----------
    df : pd.DataFrame
        Feedback history DataFrame.

    Returns
    -------
    float
        Fraction of correct predictions, or 0.0 if history is empty.
    """
    if df.empty:
        return 0.0

    # Ensure "correct" column is cast to boolean
    correct_series = df["correct"].astype(bool)
    accuracy = float(correct_series.mean())

    return accuracy
