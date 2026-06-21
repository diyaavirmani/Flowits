"""
allocation.py
Single responsibility: Allocate traffic management resources to graph nodes
based on impact scores.

Uses a greedy algorithm: highest-impact nodes get officers first,
bottleneck junctions (in-degree >= 2) get barricades.
No ML, no I/O — pure allocation logic.
"""

import networkx as nx


# ═══════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════

# Minimum in-degree for a node to be considered a "bottleneck junction".
# Nodes with >= 2 incoming edges are convergence points where multiple
# traffic streams merge, making them priority candidates for barricades.
BOTTLENECK_IN_DEGREE = 2  # stated assumption for prototype

# Mitigation factor: estimated fraction of delay reduction achieved
# by deploying resources to a node.
# 0.35 = 35% reduction in impact score per resourced node.
# This is a stated assumption for the prototype — to be calibrated
# against real deployment outcome data in production.
MITIGATION_FACTOR = 0.35


# ═══════════════════════════════════════════════════════════════════
# Public functions
# ═══════════════════════════════════════════════════════════════════

def get_resource_pool(severity_class: int) -> dict:
    # Resource pools are operational constants derived from standard
    # Bengaluru traffic police deployment guidelines for incident severity.
    # These are stated assumptions for the prototype — to be calibrated
    # against real deployment records in production.
    if severity_class == 0:
        return {"officers": 0, "barricades": 0}
        # No deployment — monitoring only

    if severity_class == 1:
        return {"officers": 1, "barricades": 0}
        # Single officer dispatched, no barricades

    if severity_class == 2:
        return {"officers": 3, "barricades": 2}
        # Standard road closure response

    if severity_class == 3:
        return {"officers": 6, "barricades": 4}
        # Maximum response — high priority closure

    return {"officers": 0, "barricades": 0}


def allocate_resources(
    node_impact_scores: dict,
    severity_class: int,
    graph: nx.DiGraph,
    available_officers: int = None,
    available_barricades: int = None,
) -> list:
    """
    Allocate officers and barricades to nodes using a greedy strategy.

    Algorithm:
      1. Sort nodes by impact score (highest first)
      2. Assign officers to top-impact nodes (1 per node, until exhausted)
      3. Assign barricades to bottleneck nodes (in_degree >= 2), sorted
         by impact score, until barricades are exhausted
      4. Build a human-readable reason string for each assignment

    Parameters
    ----------
    node_impact_scores : dict
        {node_id: impact_score} from get_node_impact_scores.
    severity_class : int
        Incident severity class (0, 1, 2, or 3).
    graph : nx.DiGraph
        Corridor graph (used for in-degree lookups and node labels).
    available_officers : int, optional
        Operator-supplied officer count. When None, the severity-based
        default pool is used. When provided, the plan never exceeds it.
    available_barricades : int, optional
        Operator-supplied barricade count. Same fallback semantics.

    Returns
    -------
    list[dict]
        Each dict has keys: node_id, node_label, impact_score,
        resource_type, quantity, reason.
    """
    pool = get_resource_pool(severity_class)
    available_officers = (
        pool["officers"] if available_officers is None else available_officers
    )
    available_barricades = (
        pool["barricades"] if available_barricades is None else available_barricades
    )

    allocations = []

    # ── Step 1: Sort node_ids by impact_score descending ──
    sorted_nodes = sorted(
        node_impact_scores.items(),
        key=lambda item: item[1],  # sort by impact_score
        reverse=True,              # highest first
    )

    # ── Step 2: Officers — assign to top nodes, highest impact first ──
    officers_remaining = available_officers
    officer_assigned_nodes = set()

    for rank, (node_id, score) in enumerate(sorted_nodes, start=1):
        if officers_remaining <= 0:
            break  # no more officers to assign

        # Assign 1 officer per node (minimum deployment unit)
        officers_to_assign = 1  # 1 officer per node minimum
        node_label = graph.nodes[node_id].get("label", node_id)

        allocations.append({
            "node_id": node_id,
            "node_label": node_label,
            "impact_score": score,
            "resource_type": "officer",
            "quantity": officers_to_assign,
            "reason": (
                f"Ranked #{rank} by impact ({score:.2f}). "
                f"Assigned officer due to high proximity impact."
            ),
        })

        officer_assigned_nodes.add(node_id)
        officers_remaining -= officers_to_assign

    # ── Step 3: Barricades — assign to bottleneck nodes ──
    # Bottleneck = in_degree >= BOTTLENECK_IN_DEGREE (convergence point)
    bottleneck_nodes = [
        node_id
        for node_id in node_impact_scores
        if graph.in_degree(node_id) >= BOTTLENECK_IN_DEGREE
    ]

    # Sort bottleneck nodes by impact score descending
    bottleneck_nodes.sort(
        key=lambda nid: node_impact_scores[nid],
        reverse=True,
    )

    barricades_remaining = available_barricades
    for node_id in bottleneck_nodes:
        if barricades_remaining <= 0:
            break  # no more barricades to assign

        # Assign 1 barricade per bottleneck node
        barricades_to_assign = 1  # 1 barricade per bottleneck
        node_label = graph.nodes[node_id].get("label", node_id)
        score = node_impact_scores[node_id]

        # Determine rank from original sorted order
        rank = next(
            i for i, (nid, _) in enumerate(sorted_nodes, start=1)
            if nid == node_id
        )

        allocations.append({
            "node_id": node_id,
            "node_label": node_label,
            "impact_score": score,
            "resource_type": "barricade",
            "quantity": barricades_to_assign,
            "reason": (
                f"Ranked #{rank} by impact ({score:.2f}). "
                f"Assigned barricade due to bottleneck junction "
                f"(in-degree >= {BOTTLENECK_IN_DEGREE})."
            ),
        })

        barricades_remaining -= barricades_to_assign

    return allocations


def compute_before_after(
    node_impact_scores: dict,
    allocated_node_ids: list,
) -> tuple:
    """
    Compute total impact before and after resource allocation.

    Parameters
    ----------
    node_impact_scores : dict
        {node_id: impact_score} for all nodes.
    allocated_node_ids : list[str]
        Node IDs that received resources.

    Returns
    -------
    tuple[float, float]
        (unmanaged_impact, managed_impact) where managed < unmanaged
        for any valid input with at least one allocated node.
    """
    # Unmanaged: sum of all impact scores with no intervention
    unmanaged = sum(node_impact_scores.values())

    # Managed: reduce impact at resourced nodes by MITIGATION_FACTOR.
    # Each resourced node's impact is reduced by 35% (stated assumption).
    reduction = MITIGATION_FACTOR * sum(
        node_impact_scores[nid]
        for nid in allocated_node_ids
        if nid in node_impact_scores  # safety check for valid node IDs
    )

    managed = unmanaged - reduction

    return (round(unmanaged, 3), round(managed, 3))


# ═══════════════════════════════════════════════════════════════════
# Self-test — run with: python -m src.allocation (from backend/)
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    from src.graph_builder import build_graph, get_node_impact_scores

    print("=" * 60)
    print("allocation.py — Self-test")
    print("=" * 60)

    # Build a test graph
    corridor = "Hosur Road"
    graph = build_graph(corridor)
    print(f"\nCorridor: {corridor}")
    print(f"Nodes: {graph.number_of_nodes()}, Edges: {graph.number_of_edges()}")

    # Fake historical rates for testing
    test_rates = {
        "corridor_closure_rate": {"Hosur Road": 0.10},  # 10% closure rate
        "global_mean": 0.08,
    }

    # Simulate an incident near Silk Board Junction
    test_lat = 12.9197   # Silk Board lat
    test_lng = 77.6211   # Silk Board lng
    test_probability = 0.75  # severity_class=2 -> 2/3 ~= 0.67, rounded up for test

    # Compute impact scores
    scores = get_node_impact_scores(
        graph, test_probability, test_lat, test_lng, test_rates, corridor
    )
    print(f"\nImpact scores (incident at Silk Board, probability={test_probability}):")
    for nid, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
        print(f"  {graph.nodes[nid]['label']:>40s}: {score:.4f}")

    # ── Test 1: Determinism ──
    print("\n-- Test 1: Determinism (two identical calls) --")
    alloc1 = allocate_resources(scores, severity_class=2, graph=graph)
    alloc2 = allocate_resources(scores, severity_class=2, graph=graph)

    # Compare serialised output
    match = all(
        a1["node_id"] == a2["node_id"]
        and a1["resource_type"] == a2["resource_type"]
        and a1["quantity"] == a2["quantity"]
        for a1, a2 in zip(alloc1, alloc2)
    )
    print(f"  Identical output: {match}")
    assert match, "FAIL: allocate_resources is not deterministic!"

    print("\n  Allocations:")
    for a in alloc1:
        print(f"    {a['node_label']:>40s} | {a['resource_type']:>9s} x{a['quantity']} | score={a['impact_score']:.4f}")
        print(f"      Reason: {a['reason']}")

    # ── Test 2: Before/After ──
    print("\n-- Test 2: Before/After impact --")
    allocated_ids = list({a["node_id"] for a in alloc1})
    unmanaged, managed = compute_before_after(scores, allocated_ids)
    print(f"  Unmanaged impact: {unmanaged}")
    print(f"  Managed impact:   {managed}")
    print(f"  Managed < Unmanaged: {managed < unmanaged}")
    assert managed < unmanaged, "FAIL: managed impact should be less than unmanaged!"

    print(f"\n{'=' * 60}")
    print("All tests passed.")
    print(f"{'=' * 60}")
