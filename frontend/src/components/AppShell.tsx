import { useState } from 'react'
import type { ReactElement } from 'react'
import type { AllocationResponse, IncidentContext, PredictionResponse } from '../types'
import HomeView from './HomeView'
import DashboardView from './DashboardView'
import UpcomingEvents from './UpcomingEvents'
import IncidentInputForm from './IncidentInputForm'
import ImpactCard from './ImpactCard'
import MapCard from './MapCard'
import DeploymentCard from './DeploymentCard'
import DiversionCard from './DiversionCard'
import AboutView from './AboutView'
import EmptyState from './EmptyState'
import BriefingReport from './BriefingReport'

type View = 'home' | 'dashboard' | 'events' | 'planned' | 'unplanned' | 'about'

function Logo() {
  return (
    <svg width={30} height={30} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="0.5" y="0.5" width="39" height="39" rx="8" fill="#1a1a1a" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4
        return (
          <line key={i} x1={17 + Math.cos(a) * 6.4} y1={17 + Math.sin(a) * 6.4} x2={17 + Math.cos(a) * 9.2} y2={17 + Math.sin(a) * 9.2} stroke="#fff" strokeWidth={2.2} />
        )
      })}
      <circle cx="17" cy="17" r="6.4" fill="none" stroke="#fff" strokeWidth={2.2} />
      <circle cx="29" cy="29" r="7" fill="#ea580c" stroke="#1a1a1a" strokeWidth={2} />
      <path d="M25.8 29 l2.2 2.2 l4 -4.6" fill="none" stroke="#fff" strokeWidth={2.2} />
    </svg>
  )
}

function NavIcon({ name }: { name: View | 'help' }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const map: Record<string, ReactElement> = {
    dashboard: <g {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></g>,
    planned: <g {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></g>,
    unplanned: <g {...p}><path d="M12 3 L22 20 H2 Z" /><path d="M12 10v4M12 17v.5" /></g>,
    analytics: <g {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20v-12" /></g>,
    events: <g {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></g>,
    home: <g {...p}><path d="M3 11l9-8 9 8M5 9.5V21h14V9.5" /></g>,
    about: <g {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></g>,
    help: <g {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7M12 17v.5" /></g>,
  }
  return <svg width={20} height={20} viewBox="0 0 24 24">{map[name]}</svg>
}

export default function AppShell() {
  const [view, setView] = useState<View>('home')
  const [expanded, setExpanded] = useState(false)
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [allocation, setAllocation] = useState<AllocationResponse | null>(null)
  const [context, setContext] = useState<IncidentContext | null>(null)
  const [showReport, setShowReport] = useState(false)

  const handleResult = (p: PredictionResponse, a: AllocationResponse, c: IncidentContext) => {
    setPrediction(p)
    setAllocation(a)
    setContext(c)
  }

  const nav: { key: View; label: string; badge?: number }[] = [
    { key: 'home', label: 'Home' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'planned', label: 'Planned Events', badge: 4 },
    { key: 'unplanned', label: 'Unplanned Events' },
    { key: 'about', label: 'About the model' },
  ]

  const Results = () =>
    prediction && allocation ? (
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <button type="button" onClick={() => setShowReport(true)} className="gv-button gv-button-secondary">
            Generate briefing report
          </button>
        </div>
        <ImpactCard prediction={prediction} />
        <MapCard allocation={allocation} />
        <DeploymentCard allocation={allocation} />
        <DiversionCard diversion={allocation.diversion} />
      </div>
    ) : (
      <EmptyState />
    )

  const Console = () => (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_1fr] gap-8 items-start">
      <IncidentInputForm onResult={handleResult} />
      <div id="analysis-results" className="min-w-0">
        <Results />
      </div>
    </div>
  )

  const renderView = () => {
    switch (view) {
      case 'home':
        return <HomeView />
      case 'dashboard':
        return <DashboardView />
      case 'planned':
        return <UpcomingEvents onResult={handleResult} />
      case 'unplanned':
        return <Console />
      case 'about':
        return <AboutView />
      case 'events':
      default:
        return (
          <div className="flex flex-col gap-10">
            <UpcomingEvents onResult={handleResult} />
            <Console />
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Sidebar */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className="sidebar bg-card border-r border-line flex flex-col py-4 sticky top-0 h-screen shrink-0"
        style={{ width: expanded ? 218 : 64 }}
      >
        <div className="px-4 mb-6 flex items-center gap-3">
          <span className="shrink-0">
            <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" fill="none" stroke="#1a1a1a" strokeWidth={1.8} strokeLinecap="round" />
            </svg>
          </span>
          {expanded && <span className="font-pixel text-lg leading-none">FLOWITS</span>}
        </div>
        <nav className="flex flex-col gap-1 px-2.5">
          {expanded && <p className="text-[11px] uppercase tracking-wider text-muted px-2 mb-1">Menu</p>}
          {nav.map((n) => {
            const active = view === n.key
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => setView(n.key)}
                className={`flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-accent text-white' : 'text-ink hover:bg-surface'
                }`}
                title={n.label}
              >
                <span className="shrink-0">
                  <NavIcon name={n.key} />
                </span>
                {expanded && <span className="truncate flex-1 text-left">{n.label}</span>}
                {expanded && n.badge != null && (
                  <span className={`text-xs px-1.5 rounded ${active ? 'bg-white/25' : 'bg-accent-soft text-accent'}`}>{n.badge}</span>
                )}
              </button>
            )
          })}
          {expanded && <p className="text-[11px] uppercase tracking-wider text-muted px-2 mt-4 mb-1">General</p>}
          <button type="button" className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium text-ink hover:bg-surface" title="Help">
            <span className="shrink-0">
              <NavIcon name="help" />
            </span>
            {expanded && <span>Help</span>}
          </button>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-surface/90 backdrop-blur border-b border-line sticky top-0 z-20">
          <div className="px-5 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="font-pixel text-2xl leading-none">FLOWITS</span>
            </div>
            <nav className="flex items-center gap-1">
              {([['home', 'Home'], ['dashboard', 'Dashboard'], ['events', 'Events'], ['about', 'About']] as [View, string][]).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    view === v ? 'text-accent' : 'text-ink hover:bg-card'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex-1 px-5 lg:px-8 py-8 max-w-[1280px] w-full mx-auto">{renderView()}</main>

        {/* Bottom marquee */}
        <div className="border-t border-line bg-card overflow-hidden">
          <div className="marquee-track py-2.5">
            {[0, 1].map((k) => (
              <span key={k} className="text-sm text-muted px-6">
                <span className="font-semibold text-ink border-b-2 border-accent">PROTOTYPE: V1</span>
                {'  '}FLOWITS forecasts event-driven traffic congestion and plans the manpower,
                barricading, and diversion response before it happens, learning from every outcome.
                {'      •      '}
              </span>
            ))}
          </div>
        </div>
      </div>

      {showReport && prediction && allocation && context && (
        <BriefingReport prediction={prediction} allocation={allocation} context={context} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
