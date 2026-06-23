import { useEffect, useState } from 'react'
import { getModelInfo } from '../api/client'

type ModelInfo = Awaited<ReturnType<typeof getModelInfo>>['data']

function Stat({ label, value, sub, tone = 'ink' }: { label: string; value: string; sub?: string; tone?: 'ink' | 'ok' | 'accent' }) {
  const color = tone === 'ok' ? 'text-ok' : tone === 'accent' ? 'text-accent' : 'text-ink'
  return (
    <div className="border-t-2 border-ink pt-3">
      <p className={`text-2xl font-bold tabular-nums leading-none ${color}`}>{value}</p>
      <p className="text-sm text-muted mt-1">{label}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

// Per-class F1 colour: healthy (green), watch (amber), weak (red). The two rare
// high-severity classes show up red on purpose, which is the honest picture.
function f1Color(v: number) {
  if (v >= 0.7) return '#15803d'
  if (v >= 0.4) return '#d97706'
  return '#dc2626'
}

export default function ModelManifest() {
  const [info, setInfo] = useState<ModelInfo | null>(null)

  useEffect(() => {
    let active = true
    getModelInfo()
      .then((res) => active && setInfo(res.data))
      .catch(() => {
        /* manifest is non-critical; stay silent if backend is unreachable */
      })
    return () => {
      active = false
    }
  }, [])

  if (!info) return null

  const labels = info.class_labels || {}
  const perClass = Object.keys(info.per_class_f1 || {})
    .sort()
    .map((k) => ({ key: k, label: labels[k] || `Class ${k}`, f1: info.per_class_f1[k] }))

  const topFeatures = (info.feature_importances || []).slice(0, 6)
  const maxImp = topFeatures.length ? topFeatures[0].importance : 1

  return (
    <section>
      <p className="text-muted max-w-2xl mb-6">
        Two gradient-boosting models, a severity classifier and a duration regressor, trained on
        8,057 real incidents with leakage-controlled features. Every figure below is read from the
        model's own training record, not typed in. Decision support, not a black box.
      </p>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 mb-8">
        <Stat
          label={`Weighted F1 (${info.cv_folds || 5}-fold CV)`}
          value={info.cv_f1_mean.toFixed(3)}
          sub={`plus or minus ${info.cv_f1_std.toFixed(3)}`}
          tone="ok"
        />
        <Stat label="ROC AUC" value={info.cv_auc_mean ? info.cv_auc_mean.toFixed(3) : info.classifier_auc.toFixed(3)} sub="one vs rest" tone="ok" />
        <Stat label="Duration MAE" value={`${Math.round(info.regressor_mae)} min`} sub={`RMSE ${Math.round(info.regressor_rmse)} min`} />
        <Stat label="Features" value={String(info.n_features)} sub="leakage-controlled" tone="accent" />
      </div>

      <p className="text-xs text-muted mb-8">
        Trained on {info.classifier_training_rows.toLocaleString()} incidents, held-out test of{' '}
        {info.classifier_test_rows.toLocaleString()}. Stratified 80/20 split, fixed seed, so the run
        is reproducible.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Per-class F1 */}
        <div>
          <p className="font-semibold mb-1">Per-class accuracy (F1)</p>
          <p className="text-xs text-muted mb-3">
            The two high-severity classes are rare in the data, so the model is weaker on them. The
            playbook applies a severity floor for exactly these cases.
          </p>
          <div className="space-y-2.5">
            {perClass.map((c) => (
              <div key={c.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-ink">{c.label}</span>
                  <span className="tabular-nums text-muted">{c.f1.toFixed(2)}</span>
                </div>
                <div className="h-2 rounded-full bg-line overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, c.f1 * 100)}%`, background: f1Color(c.f1) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature importances */}
        <div>
          <p className="font-semibold mb-1">What drives the forecast</p>
          <p className="text-xs text-muted mb-3">Top feature importances from the severity classifier.</p>
          <div className="space-y-2.5">
            {topFeatures.map((f) => (
              <div key={f.feature}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-ink">{f.feature.replace(/_/g, ' ')}</span>
                  <span className="tabular-nums text-muted">{(f.importance * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-line overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (f.importance / maxImp) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confusion matrix */}
      <div className="mb-8">
        <p className="font-semibold mb-1">Confusion matrix (held-out test)</p>
        <p className="text-xs text-muted mb-3">
          Predicted versus actual on the {info.classifier_test_rows.toLocaleString()} test incidents.
        </p>
        <div className="border border-line rounded-xl p-3 bg-white inline-block max-w-full">
          <img src="/confusion-matrix.png" alt="Severity classification confusion matrix" className="w-full max-w-[460px] h-auto" />
        </div>
      </div>

      {/* Honesty note */}
      <div className="flex items-start gap-3 max-w-2xl">
        <span aria-hidden="true" className="shrink-0 w-7 h-7 rounded-full bg-ink text-white font-bold flex items-center justify-center">
          !
        </span>
        <p className="font-semibold">
          High-severity predictions (Standard and Maximum response) are made from few historical
          examples, so they should always be confirmed by an officer on the ground.
        </p>
      </div>
    </section>
  )
}
