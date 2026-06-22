import type { AllocationResponse } from '../types'

interface DeploymentCardProps {
  allocation: AllocationResponse
}

export default function DeploymentCard({ allocation }: DeploymentCardProps) {
  return (
    <section className="border-t-4 border-ink pt-5">
      <h2 className="text-xl font-bold mb-4">Recommended deployment</h2>

      {/* Risk before / after */}
      <div className="bg-grey-light px-4 py-3 mb-5">
        <p className="text-ink-secondary mb-1">Predicted disruption risk</p>
        <p className="text-lg">
          <span className="font-bold tabular-nums">{allocation.risk_score_unmanaged.toFixed(2)}</span>
          <span className="text-ink-secondary"> without a plan, down to </span>
          <span className="font-bold tabular-nums">{allocation.risk_score_managed.toFixed(2)}</span>
          <span className="text-ink-secondary"> with this plan </span>
          <span className="bg-tag-green-bg text-tag-green-text font-bold text-xs uppercase tracking-wide px-2 py-1 align-middle">
            −{allocation.reduction_percent}%
          </span>
        </p>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b-2 border-ink">
            <th className="py-2 pr-3 font-bold align-bottom">Junction</th>
            <th className="py-2 pr-3 font-bold align-bottom hidden sm:table-cell">Reason</th>
            <th className="py-2 font-bold align-bottom text-right">Resource</th>
          </tr>
        </thead>
        <tbody>
          {allocation.deployment_plan.map((node) => (
            <tr key={`${node.node_id}-${node.resource_type}`} className="border-b border-mid align-top">
              <td className="py-3 pr-3 font-bold">{node.node_label}</td>
              <td className="py-3 pr-3 text-sm text-ink-secondary hidden sm:table-cell">{node.reason}</td>
              <td className="py-3 text-right whitespace-nowrap">
                <span
                  className={`font-bold text-xs uppercase tracking-wide px-2 py-1 ${
                    node.resource_type === 'officer'
                      ? 'bg-tag-blue-bg text-tag-blue-text'
                      : 'bg-tag-orange-bg text-tag-orange-text'
                  }`}
                >
                  {node.quantity} {node.resource_type === 'officer' ? 'officer' : 'barricade'}
                  {node.quantity > 1 ? 's' : ''}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-sm text-ink-secondary mt-4 border-l-4 border-mid pl-4 py-1">
        {allocation.mitigation_assumption}
      </p>
    </section>
  )
}
