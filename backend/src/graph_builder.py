"""
graph_builder.py
Single responsibility: Build networkx DiGraphs for Bengaluru traffic corridors.
Each corridor is modelled as a directed graph of real junctions with
baseline traffic volumes and travel times.

Supported corridors (confirmed present in events.csv):
  - Hosur Road        (298 incidents)
  - Bellary Road 1    (610 incidents)
  - Tumkur Road       (458 incidents)

No ML, no I/O beyond raising errors. Pure graph construction and scoring.
"""

import math

import networkx as nx


# ═══════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════

# Earth radius in kilometres — used for haversine distance calculation.
EARTH_RADIUS_KM = 6371.0  # mean radius, WGS-84 standard

# Supported corridor names — these are the exact strings from the
# 'corridor' column in events.csv, verified by data exploration.
SUPPORTED_CORRIDORS = ["Hosur Road", "Bellary Road 1", "Tumkur Road"]


# ═══════════════════════════════════════════════════════════════════
# Haversine helper
# ═══════════════════════════════════════════════════════════════════

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Compute great-circle distance between two points in kilometres.

    Parameters
    ----------
    lat1, lng1 : float
        Latitude and longitude of point 1 (degrees).
    lat2, lng2 : float
        Latitude and longitude of point 2 (degrees).

    Returns
    -------
    float
        Distance in kilometres.
    """
    # Convert degrees to radians
    rlat1, rlng1 = math.radians(lat1), math.radians(lng1)
    rlat2, rlng2 = math.radians(lat2), math.radians(lng2)

    dlat = rlat2 - rlat1  # difference in latitude (radians)
    dlng = rlng2 - rlng1  # difference in longitude (radians)

    # Haversine formula — computes central angle between two points
    a = (math.sin(dlat / 2) ** 2
         + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))  # central angle

    return EARTH_RADIUS_KM * c


# ═══════════════════════════════════════════════════════════════════
# Corridor definitions
# ═══════════════════════════════════════════════════════════════════
# All lat/lng values are medians computed from real incident locations
# in events.csv for each junction name.
# baseline_volume values are ESTIMATED — there is no measured traffic
# count data in the dataset. Values are rough approximations based on
# known Bengaluru traffic patterns for these junction types.
# distance_from_incident is initialised to 0.0 and set dynamically
# by get_node_impact_scores at prediction time.
# ═══════════════════════════════════════════════════════════════════

def _build_hosur_road() -> nx.DiGraph:
    """Build graph for Hosur Road corridor (south Bengaluru, NH44)."""
    G = nx.DiGraph()

    # -- Nodes: 8 real junctions along Hosur Road, north to south --
    nodes = [
        ("CMP_Gate", {
            "label": "CMP Gate Junction",
            "lat": 12.9577, "lng": 77.6059,
            "baseline_volume": 3200,  # estimated: major military junction, moderate flow
            "distance_from_incident": 0.0,
        }),
        ("Anepalya", {
            "label": "Anepalya Junction",
            "lat": 12.9521, "lng": 77.6054,
            "baseline_volume": 2800,  # estimated: residential feeder, moderate flow
            "distance_from_incident": 0.0,
        }),
        ("SarjapurRd_StJohns", {
            "label": "Sarjapur Rd - St Johns Rd Junction",
            "lat": 12.9276, "lng": 77.6159,
            "baseline_volume": 3500,  # estimated: major cross-road intersection, high flow
            "distance_from_incident": 0.0,
        }),
        ("AyyappaTemple", {
            "label": "Ayyappa Temple Junction",
            "lat": 12.9238, "lng": 77.6187,
            "baseline_volume": 4000,  # estimated: highest incident count junction, very high flow
            "distance_from_incident": 0.0,
        }),
        ("SilkBoard", {
            "label": "Silk Board Junction",
            "lat": 12.9197, "lng": 77.6211,
            "baseline_volume": 5000,  # estimated: notorious bottleneck, highest volume on corridor
            "distance_from_incident": 0.0,
        }),
        ("Bommanahalli", {
            "label": "Bommanahalli",
            "lat": 12.9069, "lng": 77.6281,
            "baseline_volume": 3800,  # estimated: major bus terminal area, high flow
            "distance_from_incident": 0.0,
        }),
        ("KudluGate", {
            "label": "Kudlu Gate Junction",
            "lat": 12.8892, "lng": 77.6396,
            "baseline_volume": 2500,  # estimated: peripheral junction, moderate flow
            "distance_from_incident": 0.0,
        }),
        ("Naganathapura", {
            "label": "Naganathapura Junction",
            "lat": 12.8698, "lng": 77.6532,
            "baseline_volume": 2000,  # estimated: outer junction near Electronic City, lower flow
            "distance_from_incident": 0.0,
        }),
    ]
    G.add_nodes_from(nodes)

    # -- Edges: directed north-to-south + south-to-north --
    # Travel times are ESTIMATED based on typical Bengaluru congestion
    # patterns for ~2-3 km urban arterial segments.
    edges = [
        ("CMP_Gate", "Anepalya", {"weight": 3.0}),           # estimated: ~1 km, 3 min in traffic
        ("Anepalya", "CMP_Gate", {"weight": 3.5}),           # estimated: uphill return, slightly slower
        ("Anepalya", "SarjapurRd_StJohns", {"weight": 5.0}), # estimated: ~2.5 km, signal-heavy
        ("SarjapurRd_StJohns", "Anepalya", {"weight": 5.5}), # estimated: return with gradient
        ("SarjapurRd_StJohns", "AyyappaTemple", {"weight": 2.0}),  # estimated: ~0.5 km, short link
        ("AyyappaTemple", "SarjapurRd_StJohns", {"weight": 2.5}),  # estimated: return
        ("AyyappaTemple", "SilkBoard", {"weight": 4.0}),     # estimated: ~1 km, heavy congestion zone
        ("SilkBoard", "AyyappaTemple", {"weight": 4.5}),     # estimated: return through bottleneck
        ("SilkBoard", "Bommanahalli", {"weight": 6.0}),      # estimated: ~2 km, elevated + merge
        ("Bommanahalli", "SilkBoard", {"weight": 7.0}),      # estimated: return, uphill merge slower
        ("Bommanahalli", "KudluGate", {"weight": 5.0}),      # estimated: ~2 km, moderate
        ("KudluGate", "Bommanahalli", {"weight": 5.5}),      # estimated: return
        ("KudluGate", "Naganathapura", {"weight": 6.0}),     # estimated: ~3 km, outskirts
        ("Naganathapura", "KudluGate", {"weight": 6.5}),     # estimated: return
    ]
    G.add_edges_from(edges)

    return G


def _build_bellary_road_1() -> nx.DiGraph:
    """Build graph for Bellary Road 1 corridor (north Bengaluru, NH7)."""
    G = nx.DiGraph()

    # -- Nodes: 7 real junctions along Bellary Road 1, south to north --
    nodes = [
        ("Basaweshwara", {
            "label": "Basaweshwara Circle",
            "lat": 12.9844, "lng": 77.5882,
            "baseline_volume": 3000,  # estimated: circle junction near Vidhana Soudha
            "distance_from_incident": 0.0,
        }),
        ("LRDE", {
            "label": "LRDE Junction",
            "lat": 12.9874, "lng": 77.5878,
            "baseline_volume": 2500,  # estimated: defence area, restricted flow
            "distance_from_incident": 0.0,
        }),
        ("MekhriCircle", {
            "label": "Mekhri Circle",
            "lat": 13.0146, "lng": 77.5839,
            "baseline_volume": 4500,  # estimated: major interchange, very high volume
            "distance_from_incident": 0.0,
        }),
        ("HebbalFlyover", {
            "label": "Hebbal Flyover Junction",
            "lat": 13.0426, "lng": 77.5906,
            "baseline_volume": 5000,  # estimated: airport road merge, highest on corridor
            "distance_from_incident": 0.0,
        }),
        ("KodigehalliCross", {
            "label": "Kodigehalli Cross",
            "lat": 13.0544, "lng": 77.5934,
            "baseline_volume": 3200,  # estimated: residential feeder junction
            "distance_from_incident": 0.0,
        }),
        ("YelhankaCircle", {
            "label": "Yelahanka Circle",
            "lat": 13.0976, "lng": 77.5919,
            "baseline_volume": 2800,  # estimated: satellite town junction, moderate
            "distance_from_incident": 0.0,
        }),
        ("YeshwanthpuraCircle", {
            "label": "Yeshwanthpura Circle",
            "lat": 13.0179, "lng": 77.5557,
            "baseline_volume": 3500,  # estimated: railway crossing area, high flow
            "distance_from_incident": 0.0,
        }),
    ]
    G.add_nodes_from(nodes)

    # -- Edges: directed along Bellary Road corridor --
    edges = [
        ("Basaweshwara", "LRDE", {"weight": 2.0}),           # estimated: ~0.5 km, short link
        ("LRDE", "Basaweshwara", {"weight": 2.5}),           # estimated: return
        ("LRDE", "MekhriCircle", {"weight": 6.0}),           # estimated: ~3 km, moderate traffic
        ("MekhriCircle", "LRDE", {"weight": 6.5}),           # estimated: return
        ("MekhriCircle", "HebbalFlyover", {"weight": 7.0}),  # estimated: ~3 km, signal-heavy
        ("HebbalFlyover", "MekhriCircle", {"weight": 8.0}),  # estimated: return, downhill merge
        ("HebbalFlyover", "KodigehalliCross", {"weight": 4.0}),  # estimated: ~1.5 km, flyover exit
        ("KodigehalliCross", "HebbalFlyover", {"weight": 4.5}),  # estimated: return
        ("KodigehalliCross", "YelhankaCircle", {"weight": 10.0}),  # estimated: ~5 km, long stretch
        ("YelhankaCircle", "KodigehalliCross", {"weight": 10.5}),  # estimated: return
        ("MekhriCircle", "YeshwanthpuraCircle", {"weight": 5.0}),  # estimated: ~3 km, cross-link
        ("YeshwanthpuraCircle", "MekhriCircle", {"weight": 5.5}),  # estimated: return
    ]
    G.add_edges_from(edges)

    return G


def _build_tumkur_road() -> nx.DiGraph:
    """Build graph for Tumkur Road corridor (northwest Bengaluru, NH48)."""
    G = nx.DiGraph()

    # -- Nodes: 8 real junctions along Tumkur Road, south to north --
    nodes = [
        ("YeshwanthpuraCircle", {
            "label": "Yeshwanthpura Circle",
            "lat": 13.0178, "lng": 77.5573,
            "baseline_volume": 4000,  # estimated: railway + metro interchange, high volume
            "distance_from_incident": 0.0,
        }),
        ("Marappanapalya", {
            "label": "Tumkur Rd Marappanapalya Junction",
            "lat": 13.0196, "lng": 77.5527,
            "baseline_volume": 2800,  # estimated: residential feeder, moderate
            "distance_from_incident": 0.0,
        }),
        ("GoruguntepalyaJunc", {
            "label": "Goruguntepalya Junction",
            "lat": 13.0291, "lng": 77.5402,
            "baseline_volume": 3200,  # estimated: industrial area feeder
            "distance_from_incident": 0.0,
        }),
        ("GokuldasImages", {
            "label": "Gokuldas Images Junction",
            "lat": 13.0302, "lng": 77.5370,
            "baseline_volume": 3000,  # estimated: factory zone, steady flow
            "distance_from_incident": 0.0,
        }),
        ("SRS_Peenya", {
            "label": "SRS Peenya Junction",
            "lat": 13.0346, "lng": 77.5299,
            "baseline_volume": 3500,  # estimated: Peenya industrial hub, truck-heavy
            "distance_from_incident": 0.0,
        }),
        ("JalahalliCross", {
            "label": "Jalahalli Cross (SM Circle)",
            "lat": 13.0400, "lng": 77.5183,
            "baseline_volume": 3800,  # estimated: highest incidents on corridor, busy cross-road
            "distance_from_incident": 0.0,
        }),
        ("Chokasandra", {
            "label": "Chokasandra (Tumkur Road)",
            "lat": 13.0423, "lng": 77.5149,
            "baseline_volume": 2500,  # estimated: outer area, moderate
            "distance_from_incident": 0.0,
        }),
        ("Hesaraghatta", {
            "label": "Hesaraghatta Junction",
            "lat": 13.0454, "lng": 77.5079,
            "baseline_volume": 2200,  # estimated: peripheral, lower urban density
            "distance_from_incident": 0.0,
        }),
    ]
    G.add_nodes_from(nodes)

    # -- Edges: directed along Tumkur Road --
    edges = [
        ("YeshwanthpuraCircle", "Marappanapalya", {"weight": 3.0}),   # estimated: ~1 km, urban
        ("Marappanapalya", "YeshwanthpuraCircle", {"weight": 3.5}),   # estimated: return
        ("Marappanapalya", "GoruguntepalyaJunc", {"weight": 4.0}),    # estimated: ~1.5 km
        ("GoruguntepalyaJunc", "Marappanapalya", {"weight": 4.5}),    # estimated: return
        ("GoruguntepalyaJunc", "GokuldasImages", {"weight": 2.0}),    # estimated: ~0.5 km, short
        ("GokuldasImages", "GoruguntepalyaJunc", {"weight": 2.5}),    # estimated: return
        ("GokuldasImages", "SRS_Peenya", {"weight": 3.0}),            # estimated: ~1 km
        ("SRS_Peenya", "GokuldasImages", {"weight": 3.5}),            # estimated: return
        ("SRS_Peenya", "JalahalliCross", {"weight": 4.0}),            # estimated: ~1.5 km
        ("JalahalliCross", "SRS_Peenya", {"weight": 4.5}),            # estimated: return
        ("JalahalliCross", "Chokasandra", {"weight": 2.0}),           # estimated: ~0.5 km
        ("Chokasandra", "JalahalliCross", {"weight": 2.5}),           # estimated: return
        ("Chokasandra", "Hesaraghatta", {"weight": 3.0}),             # estimated: ~1 km
        ("Hesaraghatta", "Chokasandra", {"weight": 3.5}),             # estimated: return
    ]
    G.add_edges_from(edges)

    return G


# ═══════════════════════════════════════════════════════════════════
# Builder registry
# ═══════════════════════════════════════════════════════════════════

_CORRIDOR_BUILDERS = {
    "Hosur Road": _build_hosur_road,
    "Bellary Road 1": _build_bellary_road_1,
    "Tumkur Road": _build_tumkur_road,
}


# ═══════════════════════════════════════════════════════════════════
# Public functions
# ═══════════════════════════════════════════════════════════════════

def build_graph(corridor: str) -> nx.DiGraph:
    """
    Build a directed graph for the given corridor.

    Parameters
    ----------
    corridor : str
        Corridor name — must be one of: "Hosur Road", "Bellary Road 1",
        "Tumkur Road".

    Returns
    -------
    nx.DiGraph
        Graph with junction nodes and travel-time edges.

    Raises
    ------
    ValueError
        If corridor is not in the supported set.
    """
    if corridor not in _CORRIDOR_BUILDERS:
        raise ValueError(
            f"Unsupported corridor: '{corridor}'. "
            f"Supported: {SUPPORTED_CORRIDORS}"
        )

    return _CORRIDOR_BUILDERS[corridor]()


def _nearest_node(graph: nx.DiGraph, lat: float, lng: float):
    """Return (node_id, distance_km) of the junction closest to the incident."""
    best_id = None
    best_dist = float("inf")
    for node_id, data in graph.nodes(data=True):
        dist = _haversine(lat, lng, data["lat"], data["lng"])
        if dist < best_dist:
            best_dist = dist
            best_id = node_id
    return best_id, best_dist


def _augment_with_bypasses(graph: nx.DiGraph, detour_factor: float = 1.6) -> nx.DiGraph:
    """
    Return a copy of the corridor graph with parallel 'bypass' edges that skip
    each junction. A bypass from the junction before a node to the junction after
    it represents the local parallel road traffic would use if that node is
    blocked. Its travel time is the through-time scaled by detour_factor (a stated
    modeling assumption — parallel routes are longer/slower than the main line).
    """
    augmented = graph.copy()
    for node in list(graph.nodes()):
        for predecessor in graph.predecessors(node):
            for successor in graph.successors(node):
                if predecessor == successor or predecessor == node or successor == node:
                    continue
                if augmented.has_edge(predecessor, successor):
                    continue
                through = graph[predecessor][node]["weight"] + graph[node][successor]["weight"]
                augmented.add_edge(
                    predecessor,
                    successor,
                    weight=round(through * detour_factor, 2),
                    bypass=True,
                )
    return augmented


def compute_diversion(graph: nx.DiGraph, incident_lat: float, incident_lng: float) -> dict:
    """
    Compute a traffic diversion plan around the junction nearest the incident.

    The blocked junction is the corridor node closest to the incident. For
    through-traffic, FLOW intercepts at the busier adjacent junction and reroutes
    to the junction on the far side via the parallel bypass network, quantifying
    the extra travel time the detour costs.

    Returns a dict matching the DiversionPlan schema.
    """
    blocked, _dist = _nearest_node(graph, incident_lat, incident_lng)
    blocked_label = graph.nodes[blocked].get("label", blocked)

    neighbors = (set(graph.predecessors(blocked)) | set(graph.successors(blocked))) - {blocked}
    if len(neighbors) < 2:
        return {
            "blocked_junction": blocked_label,
            "has_diversion": False,
            "intercept_at": None,
            "rejoin_at": None,
            "route": [],
            "direct_minutes": 0.0,
            "detour_minutes": 0.0,
            "added_minutes": 0.0,
            "note": (
                f"Incident sits at the corridor endpoint ({blocked_label}); "
                "through-traffic is unaffected. Manage on-site, no diversion required."
            ),
        }

    # Intercept on the higher-volume side; rejoin on the other.
    ordered = sorted(
        neighbors,
        key=lambda nid: graph.nodes[nid].get("baseline_volume", 0),
        reverse=True,
    )
    upstream, downstream = ordered[0], ordered[1]

    direct_minutes = 0.0
    if graph.has_edge(upstream, blocked) and graph.has_edge(blocked, downstream):
        direct_minutes = graph[upstream][blocked]["weight"] + graph[blocked][downstream]["weight"]

    augmented = _augment_with_bypasses(graph)
    augmented.remove_node(blocked)

    try:
        path = nx.shortest_path(augmented, upstream, downstream, weight="weight")
        detour_minutes = nx.shortest_path_length(augmented, upstream, downstream, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return {
            "blocked_junction": blocked_label,
            "has_diversion": False,
            "intercept_at": graph.nodes[upstream].get("label", upstream),
            "rejoin_at": graph.nodes[downstream].get("label", downstream),
            "route": [],
            "direct_minutes": round(direct_minutes, 1),
            "detour_minutes": 0.0,
            "added_minutes": 0.0,
            "note": (
                f"No viable bypass around {blocked_label}; the corridor is severed here. "
                "Recommend contraflow or a hold until the junction clears."
            ),
        }

    route_labels = [graph.nodes[n].get("label", n) for n in path]
    added_minutes = max(0.0, detour_minutes - direct_minutes)

    return {
        "blocked_junction": blocked_label,
        "has_diversion": True,
        "intercept_at": graph.nodes[upstream].get("label", upstream),
        "rejoin_at": graph.nodes[downstream].get("label", downstream),
        "route": route_labels,
        "direct_minutes": round(direct_minutes, 1),
        "detour_minutes": round(detour_minutes, 1),
        "added_minutes": round(added_minutes, 1),
        "note": (
            f"Divert through-traffic at {graph.nodes[upstream].get('label', upstream)} onto the "
            f"parallel route, rejoining at {graph.nodes[downstream].get('label', downstream)}. "
            "Bypass travel time is a planning estimate."
        ),
    }


def get_node_impact_scores(
    graph: nx.DiGraph,
    probability: float,
    incident_lat: float,
    incident_lng: float,
    historical_rates: dict,
    corridor: str,
) -> dict:
    """
    Compute impact scores for every node in the graph based on
    proximity to the incident and historical corridor closure rate.

    Parameters
    ----------
    graph : nx.DiGraph
        Corridor graph from build_graph.
    probability : float
        Incident severity probability (0.0 to 1.0).
        For 4-class severity, this is severity_class / 3.0.
    incident_lat, incident_lng : float
        Latitude and longitude of the incident.
    historical_rates : dict
        Historical rates dict from compute_historical_rates.
    corridor : str
        Corridor name for rate lookup.

    Returns
    -------
    dict[str, float]
        {node_id: impact_score} for every node in the graph.
    """
    # Global mean closure rate — fallback for corridors not seen in training
    global_mean = historical_rates.get("global_mean", 0.08)  # 0.08 = overall dataset average

    # Corridor-specific closure rate from training data
    corridor_rate = historical_rates.get(
        "corridor_closure_rate", {}
    ).get(corridor, global_mean)  # fallback to global mean if corridor unseen

    scores = {}
    for node_id, node_data in graph.nodes(data=True):
        # Distance from incident to this junction (km)
        distance_km = _haversine(
            incident_lat, incident_lng,
            node_data["lat"], node_data["lng"],
        )

        # Update node attribute for downstream use
        graph.nodes[node_id]["distance_from_incident"] = distance_km

        # Proximity factor: inverse-distance weighting.
        # Nodes closer to the incident get a higher factor (max = 1.0 at distance 0).
        # The +1 in the denominator prevents division by zero and ensures
        # the factor is always in (0, 1].
        proximity_factor = 1.0 / (1.0 + distance_km)

        # Impact score formula:
        # - probability: how severe is the incident (0-1 scale)
        # - proximity_factor: how close is this node to the incident
        # - (1 + corridor_rate): amplifies score for corridors with
        #   historically higher closure rates. A corridor with 20% closure
        #   rate gets a 1.2x multiplier vs 1.0x for a 0% rate corridor.
        impact_score = probability * proximity_factor * (1.0 + corridor_rate)

        scores[node_id] = round(impact_score, 6)

    return scores
