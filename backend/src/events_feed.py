"""
events_feed.py
Ingests UPCOMING / RECENT events from a real live source (Google News RSS,
no API key) and falls back to a curated watchlist so the board is never empty.

Each item is keyword-matched to a known junction on a supported corridor and to
an event type. Mappable items can be turned into a full pre-plan by the model;
unmappable ones are surfaced as raw signal. The live fetch is wrapped in a short
timeout + try/except and cached, so a slow or blocked source degrades to the
curated list instead of breaking the app.
"""

import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import List, Optional

# Area keyword -> (junction label, corridor, lat, lng). Broadened so real news
# mentioning a recognisable area near a supported corridor becomes plannable.
_HOSUR = ("Silk Board Junction", "Hosur Road", 12.9197, 77.6211)
_BELLARY = ("Hebbal Flyover Junction", "Bellary Road 1", 13.0426, 77.5906)
_TUMKUR = ("SRS Peenya Junction", "Tumkur Road", 13.0346, 77.5299)

LOCATION_ALIASES = [
    # ── Hosur Road corridor (south / south-east) ──
    (["silk board", "silkboard"], ("Silk Board Junction", "Hosur Road", 12.9197, 77.6211)),
    (["bommanahalli"], ("Bommanahalli", "Hosur Road", 12.9069, 77.6281)),
    (["kudlu"], ("Kudlu Gate Junction", "Hosur Road", 12.8892, 77.6396)),
    (["electronic city", "electronics city", "e-city", "bommasandra"], ("Naganathapura Junction", "Hosur Road", 12.8698, 77.6532)),
    (["hosur road", "koramangala", "btm", "hsr", "madiwala", "sarjapur", "begur"], _HOSUR),
    (["chinnaswamy", "cubbon", "mg road"], _HOSUR),
    # ── Bellary Road corridor (north) ──
    (["hebbal"], ("Hebbal Flyover Junction", "Bellary Road 1", 13.0426, 77.5906)),
    (["mekhri"], ("Mekhri Circle", "Bellary Road 1", 13.0146, 77.5839)),
    (["yelahanka"], ("Yelahanka Circle", "Bellary Road 1", 13.0976, 77.5919)),
    (["bellary road", "airport road", "hennur", "sadashivanagar", "sanjaynagar", "jakkur", "devanahalli"], _BELLARY),
    # ── Tumkur Road corridor (north-west) ──
    (["peenya"], ("SRS Peenya Junction", "Tumkur Road", 13.0346, 77.5299)),
    (["jalahalli"], ("Jalahalli Cross (SM Circle)", "Tumkur Road", 13.0400, 77.5183)),
    (["yeshwanthpur", "yeshwantpur"], ("Yeshwanthpura Circle", "Tumkur Road", 13.0178, 77.5573)),
    (["tumkur road", "goraguntepalya", "goruguntepalya", "dasarahalli", "nagasandra", "nelamangala", "rajajinagar"], _TUMKUR),
]

# keyword group -> (event_cause, planned)
EVENT_KEYWORDS = [
    (["ipl", "rcb", "cricket", "match", "stadium"], ("sports_event", True)),
    (["concert", "live show", "music show"], ("concert", True)),
    (["festival", "jatre", "utsav", "habba", "parade"], ("festival", True)),
    (["rally", "protest", "bandh", "march", "procession", "dharna", "agitation"], ("political_rally", True)),
    (["accident", "collision", "crash", "pile-up", "pileup"], ("accident", False)),
    (["waterlog", "flood", "rain"], ("waterlogging", False)),
    (["breakdown", "stalled", "overturn"], ("vehicle_breakdown", False)),
    (["construction", "roadwork", "metro work"], ("construction", True)),
]

_NEWS_RSS = (
    "https://news.google.com/rss/search?q="
    "Bengaluru%20(rally%20OR%20match%20OR%20concert%20OR%20festival%20OR%20protest%20"
    "OR%20accident%20OR%20traffic%20OR%20procession)%20when:7d"
    "&hl=en-IN&gl=IN&ceid=IN:en"
)

_CACHE: dict = {"ts": 0.0, "items": None}
_CACHE_TTL = 300  # seconds


def _match_location(text: str):
    low = text.lower()
    for keys, loc in LOCATION_ALIASES:
        if any(k in low for k in keys):
            return loc
    return None


def _match_event(text: str):
    low = text.lower()
    for keys, ev in EVENT_KEYWORDS:
        if any(k in low for k in keys):
            return ev
    return None


def _to_event(title: str, source: str, url: Optional[str], published: Optional[str]) -> dict:
    title = title.replace("—", "-").replace("–", "-").strip()
    loc = _match_location(title)
    ev = _match_event(title)
    event_cause = ev[0] if ev else None
    planned = bool(ev[1]) if ev else False
    return {
        "title": title.strip(),
        "source": source,
        "url": url,
        "published": published,
        "event_cause": event_cause,
        "planned": planned,
        "location_name": loc[0] if loc else None,
        "corridor": loc[1] if loc else None,
        "latitude": loc[2] if loc else None,
        "longitude": loc[3] if loc else None,
        "mappable": bool(loc and event_cause),
    }


def fetch_live_events(limit: int = 12) -> List[dict]:
    """Fetch + parse real Google News RSS. Returns [] on any failure."""
    try:
        req = urllib.request.Request(_NEWS_RSS, headers={"User-Agent": "Mozilla/5.0 FLOWITS"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            raw = resp.read()
        root = ET.fromstring(raw)
        items = []
        for item in root.findall(".//item")[:limit]:
            title_el = item.find("title")
            if title_el is None or not title_el.text:
                continue
            link_el = item.find("link")
            date_el = item.find("pubDate")
            items.append(
                _to_event(
                    title_el.text,
                    "live",
                    link_el.text if link_el is not None else None,
                    date_el.text if date_el is not None else None,
                )
            )
        return items
    except Exception as exc:
        print(f"Live events fetch failed (using curated fallback): {exc}")
        return []


def curated_events() -> List[dict]:
    """A maintained watchlist of plausible upcoming events on supported corridors.
    Clearly labelled 'curated' — production would auto-populate this from event APIs."""
    seed = [
        ("IPL match this weekend. Heavy fan movement expected toward the stadium via Silk Board", None),
        ("Political rally and procession announced near Mekhri Circle on Bellary Road", None),
        ("Industrial-area festival procession scheduled at Peenya, Tumkur Road", None),
        ("Concert at city venue. Late-night dispersal expected around Hebbal", None),
    ]
    return [_to_event(title, "curated", url, "Upcoming") for title, url in seed]


_STALE_AFTER = 4 * 86400  # an event older than this is treated as over


def _parse_ts(published: Optional[str]) -> Optional[float]:
    if not published:
        return None
    try:
        dt = parsedate_to_datetime(published)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.timestamp()
    except Exception:
        return None


def _humanize(ts: float, now: float) -> str:
    diff = ts - now
    future = diff > 0
    s = abs(diff)
    if s < 3600:
        val, unit = max(1, int(s / 60)), "min"
    elif s < 86400:
        val, unit = int(s / 3600), "h"
    else:
        val, unit = int(s / 86400), "d"
    return f"in {val}{unit}" if future else f"{val}{unit} ago"


def get_upcoming_events() -> dict:
    now = time.time()
    if _CACHE["items"] is None or now - _CACHE["ts"] > _CACHE_TTL:
        _CACHE["items"] = fetch_live_events()
        _CACHE["ts"] = now
    live_raw = _CACHE["items"] or []

    events = []
    # Live items: drop anything older than the stale window (event is over).
    for e in live_raw:
        ts = _parse_ts(e.get("published"))
        if ts is None:
            ts = now
        if now - ts > _STALE_AFTER:
            continue
        events.append({**e, "ts": ts, "when": _humanize(ts, now)})

    # Curated watchlist: future-dated so it reads as upcoming and never expires.
    for i, c in enumerate(curated_events()):
        ts = now + (i + 1) * 86400
        events.append({**c, "ts": ts, "when": _humanize(ts, now)})

    # Chronological order (soonest in time first).
    events.sort(key=lambda e: e["ts"])

    live_final = [e for e in events if e["source"] == "live"]
    curated_final = [e for e in events if e["source"] == "curated"]
    return {
        "live_status": "ok" if live_raw else "unavailable",
        "live_count": len(live_final),
        "curated_count": len(curated_final),
        "events": events,
    }
