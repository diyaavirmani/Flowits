import ModelManifest from './ModelManifest'
import FeedbackCard from './FeedbackCard'

export default function AboutView() {
  return (
    <div className="max-w-[920px]">
      <h1 className="text-2xl font-bold mb-1">About the model</h1>
      <p className="text-muted mb-8">
        How FLOWITS forecasts, what it can and cannot do, and how it learns from outcomes.
      </p>

      {/* How it works */}
      <div className="flashcard p-6 mb-8">
        <h2 className="text-lg font-semibold mb-3">How it works</h2>
        <p className="text-ink mb-3 leading-relaxed">
          FLOWITS pairs a statistical model with an operational playbook. The model forecasts
          severity and duration from 8,057 historical incidents using gradient boosting. The playbook
          is a transparent rule layer that adds the operational consequences officers plan around
          (crowd surge, theft, scuffles) and treats marquee events such as rallies and concerts as
          high impact. These signals are not in the data, so they are encoded as stated rules, never
          presented as model output.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {[
            ['Severity model', 'Gradient-boosting classifier, four classes, with class probabilities.'],
            ['Duration model', 'Gradient-boosting regressor, shown as a range.'],
            ['Allocation', 'Greedy scoring on a NetworkX corridor graph for officers and barricades.'],
            ['Diversion', 'Shortest-path reroute around the blocked junction.'],
          ].map(([t, d]) => (
            <div key={t} className="border border-line rounded-xl p-4">
              <p className="font-semibold text-sm">{t}</p>
              <p className="text-muted text-sm mt-1">{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Performance */}
      <div className="flashcard p-6 mb-8">
        <h2 className="text-lg font-semibold mb-3">Performance</h2>
        <ModelManifest />
      </div>

      {/* Outcome learning */}
      <div className="flashcard p-6">
        <FeedbackCard />
      </div>
    </div>
  )
}
