# FLOWITS — Approach & Methodology

> **Problem statement.** *How can historical and real-time data be used to forecast event-related
> traffic impact and recommend optimal manpower, barricading, and diversion plans?*

FLOWITS answers this with a single, coherent pipeline that mirrors how an experienced traffic
officer reasons — but backed by **8,057 real incidents** instead of one person's memory, and with a
loop that makes it sharper after every call:

```
clean data + spatial clustering  →  severity + duration models  →  graph scoring for
manpower & barricades  →  shortest-path diversion  →  outcomes loop back as new training data
```

**Design principle:** *decision support, not autopilot.* Every prediction ships with its confidence,
the signals behind it, an uncertainty range, and stated assumptions. The officer always decides.

---

## How the approach maps to the problem statement

| Requirement in the brief | How FLOWITS delivers it |
|---|---|
| **Historical data** | 8,057 cleaned incidents; closure-rate features by zone / junction / corridor / cause; K-Means spatial clusters |
| **Real-time data** | Acts the instant an incident is reported — instant severity + plan, not post-jam analysis |
| **Forecast impact** | 4-class severity classifier + duration regressor (impact proxied by severity, since the data has no delay column) |
| **Optimal manpower** | Greedy allocation of officers to highest-impact junctions on the corridor graph |
| **Barricading** | Barricades placed at bottleneck (high-convergence) junctions |
| **Diversion plans** | Shortest-path reroute around the blocked junction, with added-delay estimate |
| **(Beyond the brief) Learning** | Feedback loop logs outcomes, tracks accuracy, and feeds future retraining |

---

## 1. Data Foundation & Feature Engineering

The raw dataset is an **incident management log, not traffic-flow data** — so there is no ready-made
"impact score" or "delay minutes" to predict. Two engineering decisions bridge that gap:

- **Constructing the target.** A 4-level **severity label** is derived from two reliable, near-zero-null
  columns — whether a road closure was required, and the human-assigned priority
  (Monitor → Single officer → Standard response → Maximum response).
- **Filling the location gap.** The `zone` field is **57% null**, so it can't be relied on. Instead,
  **K-Means clustering on latitude/longitude** partitions the city into 15 geographic clusters, and a
  closure-rate is computed per cluster. This gives a **location-aware risk signal for *every*
  incident** — not just the 43% with a recorded zone.

From this, **11 features** feed the models:

- **Temporal:** hour of day, day of week, is-weekend, is-peak-hour
- **Categorical encoding:** priority (High/Medium/Low → 2/1/0)
- **Historical closure rates:** by zone, junction, corridor, and incident cause
- **Spatial:** K-Means cluster closure rate; zone incident count

**Leakage control:** all historical rates and spatial clusters are fit on the **training split only**
and applied to the test split via fixed lookup tables, so the model never sees test outcomes.

---

## 2. Severity Forecasting — two Gradient Boosting models

| Model | Task | Key metric |
|---|---|---|
| **GradientBoostingClassifier** | 4-class severity (with probabilities) | Weighted **F1 0.856**, ROC-AUC **0.975**, CV F1 **0.859 ± 0.01** |
| **GradientBoostingRegressor** | Resolution time (minutes) | **MAE ~52 min** (shown as a range, not false precision) |

**Why Gradient Boosting over a neural network:** for ~8k rows of mixed tabular features it trains in
seconds, needs no normalization, and — critically for a decision-support tool — produces
**feature importances** that justify every prediction. The tiny gap between test F1 and
cross-validated F1 confirms the model generalises rather than overfits.

**Handling class imbalance honestly.** High-severity incidents (classes 2 & 3) are only ~7% of the
data. FLOWITS addresses this with:
- **Balanced sample weights** during training, and
- **Lowered confidence thresholds** for the high-severity classes — catching more true road-closure
  cases at the cost of some false positives (the correct trade-off when a missed closure costs far
  more than an unnecessary deployment).
- Any prediction that crossed only because of the lowered threshold is **flagged for human review.**

---

## 3. Resource Allocation — corridor graph + greedy scoring

Each supported corridor is modelled as a **directed graph (NetworkX)** — junctions are nodes, road
segments are travel-time-weighted edges.

1. **Score every junction:**
   `impact = predicted severity × proximity to the incident × corridor historical risk`
2. **Allocate greedily:** officers go to the highest-impact junctions first; **barricades go to
   bottleneck junctions** (high in-degree merge points). Allocation stops when the operator-set
   officer/barricade pool is exhausted.
3. **Quantify the benefit:** a before-vs-after total risk score (a stated **35% mitigation per managed
   junction**), de-duplicated so a junction receiving both an officer and a barricade is not
   double-counted.

Every assignment carries a one-line reason, making the plan auditable rather than opaque.

---

## 4. Traffic Diversion — shortest-path reroute

Reusing the same corridor graph:

1. **Identify the blocked junction** — the node nearest the incident.
2. **Augment with bypass edges** — parallel roads connecting the junctions on either side of the
   blockage, with travel time scaled by a **1.6× detour factor** (a stated assumption; parallel
   routes are slower).
3. **Reroute** — remove the blocked node and run **shortest-path (Dijkstra)** from the busier
   neighbour (intercept point) to the far neighbour (rejoin point).
4. **Output** — the reroute path plus the **extra minutes** the detour costs. Incidents at a corridor
   endpoint (no through-traffic) correctly return "no diversion required — manage on-site."

---

## 5. Continuous Learning — the feedback loop

This directly answers the brief's stated gap — *no post-event learning today.*

- After an incident resolves, the officer **logs the actual outcome.**
- FLOWITS recomputes a **running accuracy** (predicted vs actual), charted over time.
- The accumulated outcomes become the **training set for future retraining** — the loop literally
  closes, and the system measurably improves with use.

---

## Honest limitations (stated, not hidden)

- **Impact is proxied by severity.** The dataset records outcomes, not delay-minutes, so severity +
  duration stand in for raw congestion impact.
- **Rare-class recall.** High-severity classes are under-represented; the threshold strategy mitigates
  this but trades in some false positives, which are flagged.
- **Duration uncertainty.** The regressor's error is ~half the mean resolution time, so duration is
  always shown as a range.
- **Stated modelling assumptions.** The 35% mitigation factor and 1.6× detour factor are prototype
  estimates, displayed openly and pending calibration against real deployment records.
- **Event coverage.** The dataset is incident-heavy (few large planned events), so planned-event
  modelling is a roadmap item, not a finished claim.

---

## Technology stack

| Layer | Choice | Rationale |
|---|---|---|
| ML | scikit-learn (Gradient Boosting) | Best for tabular data; explainable; fast |
| Spatial | K-Means clustering | Fills the 57% null-zone gap |
| Graph & routing | NetworkX (greedy + Dijkstra) | Lightweight, deterministic, explainable |
| Backend | FastAPI | Async, typed, auto-documented API |
| Frontend | React + Vite + TypeScript + Tailwind | Full control over the operational UI |
| Charts | Recharts | Feedback-accuracy visualisation |

---

*FLOWITS is a first-pass triage tool that augments officer judgment — it does not replace it.*
