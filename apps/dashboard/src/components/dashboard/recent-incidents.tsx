"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Incident } from "@/lib/api"

interface RecentIncidentsProps {
  incidents: Incident[] | null
  loading?: boolean
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "NOW"
  if (diffMins < 60) return `${diffMins}M AGO`
  if (diffHours < 24) return `${diffHours}H AGO`
  return `${diffDays}D AGO`
}

function IncidentSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="h-8 w-1 rounded bg-muted animate-data-stream" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-3/4 rounded bg-muted animate-data-stream" />
        <div className="h-3 w-1/3 rounded bg-muted/60 animate-data-stream" />
      </div>
      <div className="h-5 w-16 rounded bg-muted animate-data-stream" />
    </div>
  )
}

export function RecentIncidents({ incidents, loading }: RecentIncidentsProps) {
  if (loading) {
    return (
      <Card variant="glow">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <span>Recent Incidents</span>
          </CardTitle>
          <CardDescription className="font-mono text-[10px] tracking-wider">
            LATEST INCIDENTS REQUIRING ATTENTION
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/30">
            {[...Array(5)].map((_, i) => (
              <IncidentSkeleton key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="glow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>Recent Incidents</span>
              {incidents && incidents.length > 0 && (
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-glow-red animate-pulse-glow" />
              )}
            </CardTitle>
            <CardDescription className="font-mono text-[10px] tracking-wider mt-1">
              LATEST INCIDENTS REQUIRING ATTENTION
            </CardDescription>
          </div>
          <AlertTriangle className="h-4 w-4 text-amber-400 drop-shadow-[0_0_4px_hsl(38_92%_50%/0.5)]" />
        </div>
      </CardHeader>
      <CardContent>
        {!incidents || incidents.length === 0 ? (
          <div className="flex h-32 items-center justify-center font-mono text-sm text-muted-foreground">
            NO INCIDENTS TO DISPLAY
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {incidents.slice(0, 5).map((incident, index) => {
              const severityColor =
                incident.severity === "critical"
                  ? "bg-red-500"
                  : incident.severity === "error"
                  ? "bg-orange-500"
                  : "bg-yellow-500"

              return (
                <div
                  key={incident.id}
                  className={cn(
                    "group flex items-center gap-3 py-2.5 transition-all duration-150",
                    "hover:bg-primary/5 -mx-4 px-4",
                    "animate-fade-in-up"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Severity indicator bar */}
                  <div
                    className={cn(
                      "h-8 w-1 rounded-full transition-all",
                      severityColor,
                      incident.severity === "critical" && "shadow-glow-red animate-pulse-glow"
                    )}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="block font-mono text-sm text-foreground hover:text-primary transition-colors truncate"
                    >
                      {incident.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {incident.environment}
                      </span>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
                        {formatRelativeTime(incident.opened_at)}
                      </span>
                    </div>
                  </div>

                  {/* Badge */}
                  <Badge
                    variant={
                      incident.severity === "critical"
                        ? "critical"
                        : incident.severity === "error"
                        ? "error"
                        : "warn"
                    }
                  >
                    {incident.severity}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
