"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { AlertCircle, TrendingDown, Users, Sparkles, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import type { OverviewStats } from "@/lib/api"

interface OverviewStatsProps {
  stats: OverviewStats | null
  loading?: boolean
}

function MetricSkeleton() {
  return (
    <Card variant="glow" className="overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="h-3 w-24 rounded bg-muted animate-data-stream" />
          <div className="h-4 w-4 rounded bg-muted animate-data-stream" />
        </div>
      </CardHeader>
      <CardContent className="pb-3 px-4">
        <div className="h-8 w-20 rounded bg-muted animate-data-stream mb-2" />
        <div className="h-3 w-32 rounded bg-muted/60 animate-data-stream" />
      </CardContent>
    </Card>
  )
}

export function OverviewStatsCards({ stats, loading }: OverviewStatsProps) {
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <MetricSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    {
      title: "Total Incidents",
      value: stats.incidents.total,
      description: `${stats.incidents.open} OPEN · ${stats.incidents.investigating} INVESTIGATING`,
      icon: AlertCircle,
      iconColor: "text-red-400",
      iconGlow: "drop-shadow-[0_0_6px_hsl(0_90%_55%/0.5)]",
      valueColor: stats.incidents.open > 0 ? "text-red-400 text-glow-critical" : "text-foreground text-glow",
      isLive: stats.incidents.open > 0,
    },
    {
      title: "Error Rate",
      value: `${stats.errors.rate_per_minute.toFixed(2)}`,
      unit: "/min",
      description: `${stats.errors.total_last_24h.toLocaleString()} ERRORS IN 24H`,
      icon: TrendingDown,
      iconColor: "text-orange-400",
      iconGlow: "drop-shadow-[0_0_6px_hsl(25_95%_53%/0.5)]",
      valueColor: "text-foreground text-glow",
      isLive: true,
    },
    {
      title: "Signups (24h)",
      value: stats.signups.total_last_24h.toLocaleString(),
      description: `${stats.signups.rate_per_hour.toFixed(1)}/HR AVERAGE`,
      icon: Users,
      iconColor: "text-emerald-400",
      iconGlow: "drop-shadow-[0_0_6px_hsl(142_76%_50%/0.5)]",
      valueColor: "text-emerald-400 text-glow-success",
      isLive: true,
    },
    {
      title: "AI Success",
      value: `${stats.ai.success_rate}`,
      unit: "%",
      description: `${stats.ai.total_summaries} SUMMARIES · ${stats.ai.pending_jobs} PENDING`,
      icon: Sparkles,
      iconColor: "text-primary",
      iconGlow: "drop-shadow-[0_0_6px_hsl(185_75%_50%/0.5)]",
      valueColor: "text-primary text-glow",
      isLive: stats.ai.pending_jobs > 0,
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card
          key={card.title}
          variant="glow"
          className={cn(
            "overflow-hidden hover-lift animate-fade-in-up",
          )}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <CardHeader className="pb-1 pt-3 px-4">
            <div className="flex items-center justify-between">
              <span className="tactical-label">{card.title}</span>
              <card.icon className={cn("h-4 w-4", card.iconColor, card.iconGlow)} />
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-4">
            <div className="flex items-baseline gap-1.5">
              <span className={cn("metric-value-lg", card.valueColor)}>
                {card.value}
              </span>
              {card.unit && (
                <span className="font-mono text-sm text-muted-foreground">
                  {card.unit}
                </span>
              )}
              {card.isLive && (
                <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary shadow-glow-cyan animate-pulse-glow" />
              )}
            </div>
            <p className="mt-1 font-mono text-[10px] tracking-wider text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
