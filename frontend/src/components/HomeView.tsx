import WorkflowDiagram from './WorkflowDiagram'

export default function HomeView() {
  return (
    <div className="max-w-[920px] mx-auto text-center pt-6">
      <h1 className="font-pixel text-4xl sm:text-6xl lg:text-7xl tracking-tight leading-none mb-8">
        PREDICT. DEPLOY. MITIGATE.
      </h1>

      <div className="flashcard p-6 max-w-3xl mx-auto mb-8">
        <p className="text-sm font-semibold text-left mb-2">How it works</p>
        <WorkflowDiagram />
      </div>

      <p className="text-muted text-lg max-w-2xl mx-auto leading-relaxed">
        When rallies, festivals, accidents, or breakdowns choke a corridor, FLOWITS forecasts how
        severe it will get, plans the officers, barricades, and diversions, and sharpens itself from
        every logged outcome.
      </p>
    </div>
  )
}
