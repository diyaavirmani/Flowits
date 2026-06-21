import { useState } from 'react'
import type { AllocationResponse, PredictionResponse } from '../types'
import Hero from '../components/Hero'
import Logo from '../components/Logo'
import SystemStatus from '../components/SystemStatus'
import IncidentInputForm from '../components/IncidentInputForm'
import SeverityCard from '../components/SeverityCard'
import DeploymentCard from '../components/DeploymentCard'
import DiversionCard from '../components/DiversionCard'
import FeedbackCard from '../components/FeedbackCard'
import ModelManifest from '../components/ModelManifest'
import EmptyState from '../components/EmptyState'

function SectionLabel({ tag, index }: { tag: string; index: string }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        {tag}
      </span>
      <div className="flex-1 border-t border-border" />
      <span className="h-2 w-2 bg-[#ea580c]" />
      <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
        {index}
      </span>
    </div>
  )
}

export default function Dashboard() {
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [allocation, setAllocation] = useState<AllocationResponse | null>(null)

  const handleResult = (nextPrediction: PredictionResponse, nextAllocation: AllocationResponse) => {
    setPrediction(nextPrediction)
    setAllocation(nextAllocation)
  }

  return (
    <div className="min-h-screen">
      {/* ── Navbar ── */}
      <div className="w-full px-4 pt-4 lg:px-8 lg:pt-6">
        <nav className="max-w-[1180px] mx-auto border-2 border-foreground bg-background/80 backdrop-blur-sm px-5 py-3 lg:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Logo size={34} />
              <span className="font-pixel text-2xl md:text-3xl leading-none tracking-tight select-none">
                FLOWITS
              </span>
              <span className="hidden md:inline text-[10px] tracking-[0.2em] uppercase text-muted-foreground truncate">
                // Traffic Incident Severity System
              </span>
            </div>
            <SystemStatus />
          </div>
        </nav>
      </div>

      <div className="max-w-[1180px] mx-auto px-4 lg:px-8">
        {/* ── Hero ── */}
        <Hero />

        {/* ── Live console ── */}
        <section id="console" className="scroll-mt-6 py-12 lg:py-16">
          <SectionLabel tag="// SECTION: LIVE_CONSOLE" index="001" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
            <IncidentInputForm onResult={handleResult} />
            <div>
              {prediction && allocation ? (
                <div className="flex flex-col gap-8 lg:gap-10">
                  <SeverityCard prediction={prediction} />
                  <DeploymentCard allocation={allocation} />
                  <DiversionCard diversion={allocation.diversion} />
                </div>
              ) : (
                <div className="border-2 border-foreground bg-background">
                  <EmptyState />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Outcome learning ── */}
        <section className="py-12 lg:py-16">
          <SectionLabel tag="// SECTION: OUTCOME_LEARNING" index="002" />
          <FeedbackCard />
        </section>

        {/* ── Model manifest ── */}
        <section className="py-12 lg:py-16">
          <SectionLabel tag="// SECTION: MODEL_MANIFEST" index="003" />
          <ModelManifest />
        </section>

        {/* ── Footer ── */}
        <footer className="flex items-center gap-3 py-10 border-t-2 border-foreground">
          <Logo size={22} />
          <span className="font-pixel text-lg leading-none">FLOWITS</span>
          <span className="hidden sm:inline text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            First-pass triage: augments officer judgment, does not replace it
          </span>
          <div className="flex-1 border-t border-border" />
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">EOF</span>
        </footer>
      </div>
    </div>
  )
}
