import { useEffect, useState } from 'react'
import { getModelInfo } from '../api/client'

interface ModelInfo {
  classifier_f1: number
  classifier_auc: number
  regressor_mae: number
  n_features: number
  performance_notes: string[]
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t-2 border-ink pt-3">
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="text-sm text-ink-secondary mt-1">{label}</p>
    </div>
  )
}

export default function ModelManifest() {
  const [info, setInfo] = useState<ModelInfo | null>(null)

  useEffect(() => {
    let active = true
    getModelInfo()
      .then((res) => {
        if (active) setInfo(res.data)
      })
      .catch(() => {
        /* manifest is non-critical; stay silent if backend is unreachable */
      })
    return () => {
      active = false
    }
  }, [])

  if (!info) return null

  return (
    <section>
      <h2 className="text-2xl font-bold mb-2">About the model</h2>
      <p className="text-ink-secondary max-w-2xl mb-6">
        Two gradient-boosting models, a severity classifier and a duration regressor, trained on
        8,057 real incidents with leakage-controlled features. Every prediction ships with its
        confidence and the signals behind it. Decision support, not a black box.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 mb-6">
        <Stat label="Weighted F1" value={info.classifier_f1.toFixed(3)} />
        <Stat label="ROC AUC" value={info.classifier_auc.toFixed(3)} />
        <Stat label="Duration MAE" value={`${Math.round(info.regressor_mae)} min`} />
        <Stat label="Features" value={String(info.n_features)} />
      </div>

      {info.performance_notes?.[2] && (
        <div className="flex items-start gap-3 max-w-2xl">
          <span
            aria-hidden="true"
            className="shrink-0 w-7 h-7 rounded-full bg-ink text-white font-bold flex items-center justify-center"
          >
            !
          </span>
          <p className="font-bold">
            Classes 2 and 3 (high severity) are rare in the data, so those predictions should always
            be verified by an officer.
          </p>
        </div>
      )}
    </section>
  )
}
