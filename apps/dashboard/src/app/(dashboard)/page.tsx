"use client"

import { useState, useEffect } from "react"
import { OverviewStatsCards } from "@/components/dashboard/overview-stats"
import { ErrorChart } from "@/components/dashboard/error-chart"
import { SignupChart } from "@/components/dashboard/signup-chart"
import { RecentIncidents } from "@/components/dashboard/recent-incidents"
import { SystemHealth } from "@/components/dashboard/system-health"
import {
  fetchOverviewStats,
  fetchTrends,
  fetchIncidents,
  OverviewStats,
  TrendsResponse,
  Incident,
} from "@/lib/api"

export default function OverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [errorTrends, setErrorTrends] = useState<TrendsResponse | null>(null)
  const [signupTrends, setSignupTrends] = useState<TrendsResponse | null>(null)
  const [incidents, setIncidents] = useState<Incident[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, errorData, signupData, incidentsData] =
          await Promise.all([
            fetchOverviewStats(),
            fetchTrends("errors", "24h"),
            fetchTrends("signups", "24h"),
            fetchIncidents({ status: "open", limit: 5 }),
          ])
        setStats(statsData)
        setErrorTrends(errorData)
        setSignupTrends(signupData)
        setIncidents(incidentsData.incidents)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard data")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Monitor your system health and incident status at a glance.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive">{error}</p>
          <p className="text-sm text-destructive/80 mt-1">
            Make sure the core-api is running on port 3001
          </p>
        </div>
      )}

      <OverviewStatsCards stats={stats} loading={loading} />

      <div className="grid gap-6 md:grid-cols-2">
        <ErrorChart data={errorTrends} loading={loading} />
        <SignupChart data={signupTrends} loading={loading} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <RecentIncidents incidents={incidents} loading={loading} />
        <SystemHealth />
      </div>
    </div>
  )
}
