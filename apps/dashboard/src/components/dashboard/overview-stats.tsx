"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, TrendingDown, Users, Sparkles } from "lucide-react"
import type { OverviewStats } from "@/lib/api"

interface OverviewStatsProps {
  stats: OverviewStats | null
  loading?: boolean
}

export function OverviewStatsCards({ stats, loading }: OverviewStatsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    {
      title: "Total Incidents",
      value: stats.incidents.total,
      description: `${stats.incidents.open} open, ${stats.incidents.investigating} investigating`,
      icon: AlertCircle,
      iconColor: "text-red-500",
    },
    {
      title: "Error Rate",
      value: `${stats.errors.rate_per_minute}/min`,
      description: `${stats.errors.total_last_24h.toLocaleString()} errors in 24h`,
      icon: TrendingDown,
      iconColor: "text-orange-500",
    },
    {
      title: "Signups (24h)",
      value: stats.signups.total_last_24h.toLocaleString(),
      description: `${stats.signups.rate_per_hour.toFixed(1)}/hour average`,
      icon: Users,
      iconColor: "text-green-500",
    },
    {
      title: "AI Success Rate",
      value: `${stats.ai.success_rate}%`,
      description: `${stats.ai.total_summaries} summaries, ${stats.ai.pending_jobs} pending`,
      icon: Sparkles,
      iconColor: "text-purple-500",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.iconColor}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
