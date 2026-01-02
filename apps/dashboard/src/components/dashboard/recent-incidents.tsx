"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export function RecentIncidents({ incidents, loading }: RecentIncidentsProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Incidents</CardTitle>
          <CardDescription>Latest incidents requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Incidents</CardTitle>
        <CardDescription>Latest incidents requiring attention</CardDescription>
      </CardHeader>
      <CardContent>
        {!incidents || incidents.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            No incidents to display
          </div>
        ) : (
          <div className="space-y-4">
            {incidents.slice(0, 5).map((incident) => (
              <div key={incident.id} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Link
                    href={`/incidents/${incident.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {incident.title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{incident.environment}</span>
                    <span>·</span>
                    <span>{formatRelativeTime(incident.opened_at)}</span>
                  </div>
                </div>
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
