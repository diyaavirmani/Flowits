import type { AllocationResponse } from '../types'

interface DeploymentCardProps {
  allocation: AllocationResponse
}

export default function DeploymentCard({ allocation }: DeploymentCardProps) {
  return (
    <div className="border-2 border-foreground bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-2">
        <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
          deployment.plan
        </span>
        <span className="h-2 w-2 bg-[#ea580c]" />
      </div>

      {/* Before / After risk */}
      <div className="grid grid-cols-3 border-b-2 border-foreground">
        <div className="border-r-2 border-foreground px-4 py-4 text-center">
          <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
            Unmanaged
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-destructive">
            {allocation.risk_score_unmanaged.toFixed(2)}
          </p>
        </div>
        <div className="border-r-2 border-foreground px-4 py-4 flex flex-col items-center justify-center">
          <span className="bg-[#ea580c] text-background text-[10px] font-bold tracking-[0.15em] uppercase px-2 py-1">
            −{allocation.reduction_percent}% risk
          </span>
        </div>
        <div className="px-4 py-4 text-center">
          <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
            With Plan
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {allocation.risk_score_managed.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Plan table */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-foreground pb-2 mb-1">
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground">
            Junction / Reason
          </span>
          <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground text-right">
            Resource
          </span>
        </div>

        {allocation.deployment_plan.map((node) => (
          <div
            key={`${node.node_id}-${node.resource_type}`}
            className="grid grid-cols-[1fr_auto] gap-3 py-2.5 border-b border-border last:border-none items-start"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {node.node_label}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                {node.reason}
              </p>
            </div>
            <span
              className={`shrink-0 text-[10px] font-bold tracking-wider uppercase px-2 py-1 ${
                node.resource_type === 'officer'
                  ? 'bg-foreground text-background'
                  : 'bg-[#ea580c] text-background'
              }`}
            >
              {node.quantity} {node.resource_type === 'officer' ? 'Officer' : 'Barricade'}
              {node.quantity > 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Mitigation assumption */}
      <div className="border-t-2 border-foreground px-4 py-3">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <span className="text-[#ea580c] font-bold">* </span>
          {allocation.mitigation_assumption}
        </p>
      </div>
    </div>
  )
}
