"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Activity } from "lucide-react"
import type { TrendsResponse } from "@/lib/api"

interface ErrorChartProps {
  data: TrendsResponse | null
  loading?: boolean
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

function ChartSkeleton() {
  return (
    <Card variant="glow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 w-24 rounded bg-muted animate-data-stream mb-2" />
            <div className="h-3 w-48 rounded bg-muted/60 animate-data-stream" />
          </div>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full rounded bg-muted/30 animate-data-stream" />
      </CardContent>
    </Card>
  )
}

export function ErrorChart({ data, loading }: ErrorChartProps) {
  if (loading) {
    return <ChartSkeleton />
  }

  const chartData = data?.data.map((point) => ({
    time: formatTime(point.timestamp),
    value: point.value,
  })) || []

  return (
    <Card variant="glow" className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>Error Trend</span>
              <span className="h-1.5 w-1.5 rounded-full bg-chart-1 shadow-glow-cyan animate-pulse-glow" />
            </CardTitle>
            <CardDescription className="font-mono text-[10px] tracking-wider mt-1">
              {data?.summary.total.toLocaleString() || 0} TOTAL ERRORS IN THE LAST 24 HOURS
            </CardDescription>
          </div>
          <Activity className="h-4 w-4 text-primary drop-shadow-[0_0_4px_hsl(185_75%_50%/0.5)]" />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {chartData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center font-mono text-sm text-muted-foreground">
            NO ERROR DATA AVAILABLE
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="errorGradientMC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(185 75% 50%)" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="hsl(185 75% 50%)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(185 75% 50%)" stopOpacity={0} />
                </linearGradient>
                <filter id="glowError" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid
                strokeDasharray="1 4"
                stroke="hsl(185 75% 50% / 0.1)"
                vertical={true}
                horizontal={true}
              />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "hsl(215 20% 55%)",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                tickMargin={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "hsl(215 20% 55%)",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                }}
                tickMargin={8}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222 47% 8%)",
                  border: "1px solid hsl(185 75% 50% / 0.3)",
                  borderRadius: "6px",
                  boxShadow: "0 0 20px hsl(185 75% 50% / 0.15)",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "12px",
                }}
                labelStyle={{
                  color: "hsl(210 40% 96%)",
                  fontWeight: 500,
                  marginBottom: "4px",
                }}
                itemStyle={{
                  color: "hsl(185 75% 50%)",
                }}
                cursor={{
                  stroke: "hsl(185 75% 50% / 0.3)",
                  strokeDasharray: "4 4",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(185 75% 50%)"
                strokeWidth={2}
                fill="url(#errorGradientMC)"
                filter="url(#glowError)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "hsl(185 75% 50%)",
                  stroke: "hsl(222 47% 8%)",
                  strokeWidth: 2,
                  filter: "url(#glowError)",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
