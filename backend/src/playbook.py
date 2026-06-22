"""
playbook.py
A transparent DOMAIN-KNOWLEDGE layer that sits on top of the ML model.

The model forecasts severity and duration statistically from 8,057 historical
incidents. It cannot, however, know that a marquee event (an IPL/cricket rally,
a concert, a political rally) is inherently high-impact, nor predict secondary
risks like theft or scuffles — those signals are not in the training data.

This module encodes that operational knowledge explicitly, the way a duty
officer's playbook would. Every value here is a stated rule, not an ML output,
so the system stays honest: "the model forecasts the traffic impact; this
playbook adds the operational consequences officers plan around."
"""

from typing import Dict, List

# Per-cause operational profile.
#   planned       — is this a pre-known (planned) event?
#   severity_floor— minimum effective severity class (policy), regardless of ML
#   label         — human label
#   watch_fors    — secondary operational risks officers should prepare for
CAUSE_PROFILE: Dict[str, dict] = {
    # ── Planned, high-profile mass gatherings ──
    "sports_event": {
        "planned": True,
        "severity_floor": 3,
        "label": "Sports / IPL event",
        "watch_fors": [
            "Large crowd surge at stadium access points",
            "Elevated pickpocketing and petty-theft risk",
            "Scuffles and road-rage near choke points",
            "Post-event exit wave — second congestion spike",
        ],
    },
    "concert": {
        "planned": True,
        "severity_floor": 3,
        "label": "Concert / celebrity event",
        "watch_fors": [
            "Fan crowd surge and barricade pressure",
            "Elevated petty-theft risk in dense crowds",
            "Sudden dispersal congestion after the event",
        ],
    },
    "political_rally": {
        "planned": True,
        "severity_floor": 3,
        "label": "Political rally",
        "watch_fors": [
            "Crowd surge and procession movement",
            "Risk of altercations and law-and-order escalation",
            "Convoy / VIP movement disruption",
        ],
    },
    "festival": {
        "planned": True,
        "severity_floor": 2,
        "label": "Festival / procession",
        "watch_fors": [
            "Slow procession blocking lanes",
            "Pedestrian spillover onto carriageway",
            "Elevated petty-theft risk in crowds",
        ],
    },
    "construction": {
        "planned": True,
        "severity_floor": 1,
        "label": "Planned construction",
        "watch_fors": [
            "Lane narrowing and merge bottleneck",
            "Reduced visibility around the work zone",
        ],
    },
    # ── Unplanned incidents ──
    "protest": {
        "planned": False,
        "severity_floor": 2,
        "label": "Sudden gathering / protest",
        "watch_fors": [
            "Rapid crowd build-up",
            "Risk of altercations",
            "Possible road blockade",
        ],
    },
    "accident": {
        "planned": False,
        "severity_floor": None,
        "label": "Road accident",
        "watch_fors": [
            "Secondary collisions from rubbernecking",
            "Lane blockage until clearance",
        ],
    },
    "vehicle_breakdown": {
        "planned": False,
        "severity_floor": None,
        "label": "Vehicle breakdown",
        "watch_fors": ["Single-lane blockage", "Slow towing clearance"],
    },
    "tree_fall": {
        "planned": False,
        "severity_floor": 1,
        "label": "Tree fall",
        "watch_fors": ["Full carriageway block until cleared", "Power-line hazard"],
    },
    "waterlogging": {
        "planned": False,
        "severity_floor": 1,
        "label": "Waterlogging",
        "watch_fors": ["Stalled vehicles", "Two-wheeler skid hazard"],
    },
    "road_damage": {
        "planned": False,
        "severity_floor": None,
        "label": "Road damage",
        "watch_fors": ["Sudden braking / lane shifts"],
    },
    "others": {
        "planned": False,
        "severity_floor": None,
        "label": "Other",
        "watch_fors": ["Monitor and reassess on the ground"],
    },
}

_RESPONSE_LABEL = {
    0: "Monitor only",
    1: "Single officer",
    2: "Standard response",
    3: "Maximum response",
}

# Night window where unplanned gatherings carry a higher security risk.
_NIGHT_HOURS = set(range(22, 24)) | set(range(0, 6))


def _headline(effective: int, is_planned: bool) -> str:
    if effective >= 3:
        return "Major disruption expected"
    if effective == 2:
        return "Significant disruption likely"
    if effective == 1:
        return "Moderate, localised disruption"
    return "Minor — monitor only"


def assess_impact(
    event_cause: str,
    planned_flag: bool,
    ml_severity_class: int,
    duration_minutes: float,
    is_peak_hour: bool,
    hour_of_day: int,
    corridor_rate: float,
) -> dict:
    """
    Combine the ML severity with the operational playbook into an
    officer-facing impact assessment.
    """
    profile = CAUSE_PROFILE.get(event_cause, CAUSE_PROFILE["others"])
    is_planned = bool(profile["planned"] or planned_flag)

    floor = profile["severity_floor"]
    effective = ml_severity_class if floor is None else max(ml_severity_class, floor)

    watch_fors: List[str] = list(profile["watch_fors"])
    if is_peak_hour and effective >= 2:
        watch_fors.append("Peak-hour timing amplifies queue build-up")
    if (not is_planned) and hour_of_day in _NIGHT_HOURS and effective >= 2:
        watch_fors.append("Night-time gathering — heightened theft / altercation risk")

    posture = (
        "High alert" if effective >= 3 else "Heightened watch" if effective == 2 else "Standard watch"
    )

    elevated = floor is not None and effective > ml_severity_class
    dur = max(0, round(duration_minutes))
    cause_label = profile["label"].lower()
    if effective >= 3:
        summary = (
            f"A {cause_label} here can escalate fast. Without intervention, expect heavy "
            f"multi-junction gridlock for roughly {dur} minutes, crowd pressure at access points, "
            f"and the secondary risks below. Treat as maximum response."
        )
    elif effective == 2:
        summary = (
            f"A {cause_label} at this location is likely to cause significant queuing for around "
            f"{dur} minutes and needs an active deployment, not just monitoring."
        )
    elif effective == 1:
        summary = (
            f"A {cause_label} here is usually contained but can block a lane for about {dur} "
            f"minutes — a single officer should manage and reassess."
        )
    else:
        summary = (
            f"A {cause_label} here is typically low-impact (~{dur} minutes). Monitor and escalate "
            f"only if it grows."
        )

    return {
        "effective_severity_class": int(effective),
        "effective_severity_label": _RESPONSE_LABEL.get(int(effective), "Unknown"),
        "is_planned": is_planned,
        "policy_elevated": bool(elevated),
        "headline": _headline(effective, is_planned),
        "summary": summary,
        "posture": posture,
        "watch_fors": watch_fors,
    }
