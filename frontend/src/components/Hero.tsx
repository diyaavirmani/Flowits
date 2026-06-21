import WorkflowDiagram from './WorkflowDiagram'

export default function Hero() {
  const scrollToConsole = () => {
    document.getElementById('console')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="w-full px-6 pt-10 pb-16 lg:pt-16 lg:pb-24">
      <div className="flex flex-col items-center text-center">
        <h1 className="font-pixel text-4xl sm:text-6xl lg:text-7xl tracking-tight text-foreground leading-none select-none">
          PREDICT. DEPLOY.
        </h1>

        <div className="w-full max-w-2xl my-6 lg:my-8">
          <WorkflowDiagram />
        </div>

        <h1 className="font-pixel text-4xl sm:text-6xl lg:text-7xl tracking-tight text-foreground leading-none mb-6 select-none">
          MITIGATE.
        </h1>

        <p className="text-xs lg:text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
          Rallies, festivals, breakdowns. FLOWITS forecasts how severe each gets, then
          plans the officers, barricades, and diversions, learning from every outcome.
        </p>

        <button
          type="button"
          onClick={scrollToConsole}
          className="group flex items-stretch bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          <span className="flex items-center justify-center w-11 bg-[#ea580c] text-background text-lg font-bold">
            ↓
          </span>
          <span className="px-6 py-2.5 text-sm font-bold tracking-[0.15em] uppercase">
            Run Live Analysis
          </span>
        </button>
      </div>
    </section>
  )
}
