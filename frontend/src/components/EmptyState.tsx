export default function EmptyState() {
  return (
    <div className="border-t-4 border-mid pt-5">
      <h2 className="text-xl font-bold mb-2">Awaiting an incident</h2>
      <p className="text-ink-secondary max-w-md">
        Enter the incident details and select Analyse incident. FLOWITS will return a severity
        forecast, a junction-level deployment plan and a diversion route.
      </p>
    </div>
  )
}
