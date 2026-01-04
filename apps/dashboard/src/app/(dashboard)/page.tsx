"use client"

import { useState, useEffect } from "react"
import { OverviewStatsCards } from "@/components/dashboard/overview-stats"
import { ErrorChart } from "@/components/dashboard/error-chart"
import { SignupChart } from "@/components/dashboard/signup-chart"
import { RecentIncidents } from "@/components/dashboard/recent-incidents"
import { SystemHealth } from "@/components/dashboard/system-health"
import { AlertTriangle, Clock } from "lucide-react"
import {
  fetchOverviewStats,
  fetchTrends,
  fetchIncidents,
  OverviewStats,
  TrendsResponse,
  Incident,
} from "@/lib/api"

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export default function OverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [errorTrends, setErrorTrends] = useState<TrendsResponse | null>(null)
  const [signupTrends, setSignupTrends] = useState<TrendsResponse | null>(null)
  const [incidents, setIncidents] = useState<Incident[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

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

  const systemStatus = error ? "ERROR" : loading ? "LOADING" : "OPERATIONAL"
  const statusColor = error
    ? "text-red-400"
    : loading
    ? "text-amber-400"
    : "text-emerald-400"

  return (
    <div className="space-y-6">
      {/* Command Center Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
            COMMAND CENTER
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            SYSTEM STATUS:{" "}
            <span className={statusColor}>{systemStatus}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="font-mono text-[10px] uppercase tracking-wider">
              Last Update
            </span>
          </div>
          <div className="font-mono text-sm text-foreground mt-0.5">
            {formatTime(currentTime)}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 animate-fade-in-up">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 drop-shadow-[0_0_4px_hsl(0_90%_55%/0.5)]" />
            <div>
              <p className="font-mono text-sm text-red-400">{error}</p>
              <p className="font-mono text-xs text-red-400/70 mt-1">
                ENSURE CORE-API IS RUNNING ON PORT 3001
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Section */}
      <div>
        <div className="mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Metrics
          </span>
        </div>
        <OverviewStatsCards stats={stats} loading={loading} />
      </div>

      {/* Trends Section */}
      <div>
        <div className="mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Trends
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ErrorChart data={errorTrends} loading={loading} />
          <SignupChart data={signupTrends} loading={loading} />
        </div>
      </div>

      {/* Activity Section */}
      <div>
        <div className="mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Activity
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <RecentIncidents incidents={incidents} loading={loading} />
          <SystemHealth />
        </div>
      </div>
    </div>
  )
}
