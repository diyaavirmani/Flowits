import type { PredictionResponse } from '../types'

interface SeverityCardProps {
  prediction: PredictionResponse
}

const featureNameMap: Record<string, string> = {
  corridor_closure_rate: 'Road Corridor History',
  spatial_cluster_closure_rate: 'Area Risk Pattern',
  cause_closure_rate: 'Incident Type History',
  hour_of_day: 'Time of Day',
  is_peak_hour: 'Peak Hour',
  priority_encoded: 'Priority Level',
  zone_closure_rate: 'Zone History',
  is_weekend: 'Weekend Pattern',
  day_of_week: 'Day Pattern',
  zone_incident_count: 'Zone Activity',
  junction_closure_rate: 'Junction History',
}

// Severity coded within the brutalist palette: gray → ink → orange → red.
const severityBlock: Record<number, string> = {
  0: 'bg-secondary text-foreground',
  1: 'bg-foreground text-background',
  2: 'bg-[#ea580c] text-background',
  3: 'bg-destructive text-destructive-foreground',
}

const getFeatureLabel = (feature: string) =>
  featureNameMap[feature] ?? 'Model Signal'

export default function SeverityCard({ prediction }: SeverityCardProps) {
  const top4 = prediction.feature_importances.slice(0, 4)
  const maxImportance = top4[0]?.importance || 1
  const predictedProbability =
    prediction.class_probabilities?.[prediction.severity_class]
  const block = severityBlock[prediction.severity_class] ?? 'bg-secondary text-foreground'

  return (
    <div className="border-2 border-foreground bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          severity.prediction
        </span>
        <span className="h-2 w-2 bg-[#ea580c]" />
      </div>

      {/* Predicted response */}
      <div className="flex items-stretch border-b-2 border-foreground">
        <div className={`w-24 shrink-0 flex flex-col items-center justify-center border-r-2 border-foreground ${block}`}>
          <span className="text-[9px] tracking-[0.2em] uppercase opacity-70">Class</span>
          <span className="font-pixel text-5xl leading-none">{prediction.severity_class}</span>
        </div>
        <div className="flex-1 flex flex-col justify-center px-5 py-4">
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            Predicted Response
          </span>
          <span className="text-2xl font-bold tracking-tight uppercase mt-1">
            {prediction.severity_label}
          </span>
        </div>
      </div>

      {/* Threshold-adjusted review flag */}
      {prediction.threshold_adjusted && prediction.severity_class >= 2 && (
        <div className="flex items-start gap-3 border-b-2 border-foreground bg-[#ea580c]/10 px-5 py-3">
          <span className="mt-0.5 h-4 w-4 shrink-0 bg-[#ea580c] text-background text-[11px] font-bold flex items-center justify-center">
            !
          </span>
          <p className="text-[11px] leading-relaxed text-foreground">
            High-severity detection below standard confidence threshold.
            <span className="font-bold"> Human review recommended</span> before deployment.
          </p>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 border-b-2 border-foreground">
        <div className="border-r-2 border-foreground px-5 py-4">
          <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Estimated Duration
          </p>
          {prediction.estimated_duration_minutes === -1 ? (
            <p className="text-sm text-muted-foreground">Unavailable</p>
          ) : (
            <>
              <p className="font-mono text-2xl font-bold tabular-nums">
                {prediction.duration_range_low} to {prediction.duration_range_high}
                <span className="text-sm font-normal text-muted-foreground"> min</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">±50 min estimate</p>
            </>
          )}
        </div>

        <div className="px-5 py-4">
          <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
            Prediction Confidence
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#ea580c]">
            {predictedProbability !== undefined
              ? `${(predictedProbability * 100).toFixed(0)}%`
              : 'n/a'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            model F1 {prediction.model_cv_f1_mean.toFixed(3)} ± {prediction.model_cv_f1_std.toFixed(3)}
          </p>
        </div>
      </div>

      {/* Feature importances */}
      <div className="px-5 py-4">
        <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
          Why this prediction
        </p>
        <div className="flex flex-col gap-2.5">
          {top4.map((feature, index) => {
            const pct = Math.max(6, Math.round((feature.importance / maxImportance) * 100))
            return (
              <div key={feature.feature} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-[11px] text-foreground truncate">
                  {getFeatureLabel(feature.feature)}
                </span>
                <div className="flex-1 h-3 border border-foreground">
                  <div
                    className={`h-full ${index === 0 ? 'bg-[#ea580c]' : 'bg-foreground'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
