import type { PredictionResponse } from '../types'

interface ImpactCardProps {
  prediction: PredictionResponse
}

const featureNameMap: Record<string, string> = {
  corridor_closure_rate: 'Road corridor history',
  spatial_cluster_closure_rate: 'Area risk pattern',
  cause_closure_rate: 'Incident type history',
  hour_of_day: 'Time of day',
  is_peak_hour: 'Peak hour',
  priority_encoded: 'Priority level',
  zone_closure_rate: 'Zone history',
  is_weekend: 'Weekend pattern',
  day_of_week: 'Day pattern',
  zone_incident_count: 'Zone activity',
  junction_closure_rate: 'Junction history',
}

const severityBar: Record<number, string> = {
  0: 'border-mid',
  1: 'border-blue',
  2: 'border-[#c2570a]',
  3: 'border-red',
}

const postureTag: Record<string, string> = {
  'High alert': 'bg-tag-red-bg text-tag-red-text',
  'Heightened watch': 'bg-tag-orange-bg text-tag-orange-text',
  'Standard watch': 'bg-tag-grey-bg text-tag-grey-text',
}

const getFeatureLabel = (feature: string) => featureNameMap[feature] ?? 'Model signal'

export default function ImpactCard({ prediction }: ImpactCardProps) {
  const { impact } = prediction
  const top4 = prediction.feature_importances.slice(0, 4)
  const maxImportance = top4[0]?.importance || 1
  const predictedProbability = prediction.class_probabilities?.[prediction.severity_class]
  const bar = severityBar[impact.effective_severity_class] ?? 'border-mid'
  const tag = postureTag[impact.posture] ?? 'bg-tag-grey-bg text-tag-grey-text'

  return (
    <section className="border-t-4 border-ink pt-5">
      <h2 className="text-xl font-bold mb-4">Forecast impact</h2>

      {/* Headline + posture */}
      <div className={`border-l-4 ${bar} bg-grey-light px-4 py-4 mb-4`}>
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <span className="text-xl font-bold">{impact.headline}</span>
          <span className={`${tag} font-bold text-xs uppercase tracking-wide px-2 py-1`}>
            {impact.posture}
          </span>
          {impact.is_planned && (
            <span className="bg-tag-blue-bg text-tag-blue-text font-bold text-xs uppercase tracking-wide px-2 py-1">
              Planned event
            </span>
          )}
        </div>
        <p>{impact.summary}</p>
      </div>

      {/* Watch for */}
      <p className="font-bold mb-2">Watch for</p>
      <ul className="mb-5 space-y-1.5">
        {impact.watch_fors.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span aria-hidden="true" className="text-red font-bold mt-0.5">
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {/* Model detail (severity demoted to here) */}
      <details className="border border-mid">
        <summary className="cursor-pointer select-none px-4 py-2 font-bold bg-grey-light">
          Model detail
        </summary>
        <div className="px-4 py-2">
          {impact.policy_elevated && (
            <p className="text-sm text-ink-secondary mb-3">
              Statistically the model rated this{' '}
              <span className="font-bold">{prediction.severity_label}</span> (class{' '}
              {prediction.severity_class}); operational policy raises it to{' '}
              <span className="font-bold">{impact.effective_severity_label}</span> because planned
              mass-gatherings are inherently high-impact.
            </p>
          )}
          <dl>
            <div className="flex justify-between gap-4 py-2 border-b border-mid">
              <dt className="text-ink-secondary">Response level</dt>
              <dd className="font-bold text-right">
                {impact.effective_severity_label} (class {impact.effective_severity_class})
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-2 border-b border-mid">
              <dt className="text-ink-secondary">Estimated duration</dt>
              <dd className="font-bold tabular-nums text-right">
                {prediction.duration_range_low} to {prediction.duration_range_high} min
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-2 border-b border-mid">
              <dt className="text-ink-secondary">Model confidence</dt>
              <dd className="font-bold tabular-nums text-right">
                {predictedProbability !== undefined
                  ? `${(predictedProbability * 100).toFixed(0)}%`
                  : 'n/a'}{' '}
                · F1 {prediction.model_cv_f1_mean.toFixed(3)}
              </dd>
            </div>
          </dl>

          <p className="font-bold mt-4 mb-2">Why this forecast</p>
          <div className="flex flex-col gap-2 mb-2">
            {top4.map((feature) => {
              const pct = Math.max(6, Math.round((feature.importance / maxImportance) * 100))
              return (
                <div key={feature.feature} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-sm">{getFeatureLabel(feature.feature)}</span>
                  <div className="flex-1 h-3 bg-grey-light">
                    <div className="h-full bg-blue" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </details>
    </section>
  )
}
