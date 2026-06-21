export default function EmptyState() {
  return (
    <div className="flex flex-col h-full min-h-[420px]">
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          analysis.idle
        </span>
        <span className="h-2 w-2 border border-foreground" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 p-8">
        <div className="w-14 h-14 border-2 border-foreground flex items-center justify-center">
          <span className="font-pixel text-2xl leading-none">?</span>
        </div>
        <div>
          <p className="text-sm uppercase tracking-widest font-bold text-foreground">
            Awaiting incident
          </p>
          <p className="text-xs text-muted-foreground mt-2 max-w-xs leading-relaxed">
            Enter incident parameters and run analysis. FLOWITS returns a severity
            class and a junction-level deployment plan.
          </p>
        </div>
      </div>
    </div>
  )
}
