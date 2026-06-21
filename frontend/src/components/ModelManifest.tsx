import { useEffect, useState } from 'react'
import { getModelInfo } from '../api/client'

interface ModelInfo {
  classifier_f1: number
  classifier_auc: number
  regressor_mae: number
  n_features: number
  performance_notes: string[]
}

function Stat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 px-5 py-5 ${className}`}>
      <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        {label}
      </span>
      <span className="text-2xl lg:text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </span>
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
    <div className="flex flex-col lg:flex-row gap-0 border-2 border-foreground bg-background">
      {/* Left: manifest copy */}
      <div className="flex flex-col w-full lg:w-1/2 lg:border-r-2 border-foreground">
        <div className="flex items-center justify-between px-5 py-2 border-b-2 border-foreground">
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            manifest.md
          </span>
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            v1.0.0
          </span>
        </div>
        <div className="flex-1 flex flex-col gap-5 px-6 py-7">
          <h2 className="text-2xl lg:text-3xl font-bold tracking-tight uppercase leading-tight">
            Decision support, <span className="text-[#ea580c]">not a black box</span>
          </h2>
          <p className="text-xs lg:text-sm text-muted-foreground leading-relaxed">
            Two gradient-boosting models, a severity classifier and a duration
            regressor, trained on 8,057 real incidents with leakage-controlled
            features. Every prediction ships with its confidence and the signals
            behind it.
          </p>
          <div className="flex items-center gap-3 py-3 border-t-2 border-b-2 border-foreground">
            <span className="h-1.5 w-1.5 bg-[#ea580c]" />
            <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Trained on:
            </span>
            <span className="text-[#ea580c] font-bold tabular-nums">8,057 incidents</span>
          </div>
          {info.performance_notes?.[2] && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {info.performance_notes[2]}
            </p>
          )}
        </div>
      </div>

      {/* Right: real metrics grid */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <div className="flex items-center justify-between px-5 py-2 border-b-2 border-foreground">
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            model.metrics
          </span>
          <span className="h-2 w-2 bg-[#ea580c]" />
        </div>
        <div className="flex-1 grid grid-cols-2 gap-0">
          <Stat label="Weighted F1" value={info.classifier_f1.toFixed(3)} className="border-r-2 border-b-2 border-foreground" />
          <Stat label="ROC AUC" value={info.classifier_auc.toFixed(3)} className="border-b-2 border-foreground" />
          <Stat label="Duration MAE" value={`${Math.round(info.regressor_mae)}m`} className="border-r-2 border-foreground" />
          <Stat label="Features" value={String(info.n_features)} />
        </div>
      </div>
    </div>
  )
}
