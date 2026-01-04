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
import { Users } from "lucide-react"
import type { TrendsResponse } from "@/lib/api"

interface SignupChartProps {
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
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full rounded bg-muted/30 animate-data-stream" />
      </CardContent>
    </Card>
  )
}

export function SignupChart({ data, loading }: SignupChartProps) {
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
              <span>Signup Trend</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-glow-green animate-breathe" />
            </CardTitle>
            <CardDescription className="font-mono text-[10px] tracking-wider mt-1">
              {data?.summary.total.toLocaleString() || 0} TOTAL SIGNUPS IN THE LAST 24 HOURS
            </CardDescription>
          </div>
          <Users className="h-4 w-4 text-emerald-400 drop-shadow-[0_0_4px_hsl(142_76%_50%/0.5)]" />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {chartData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center font-mono text-sm text-muted-foreground">
            NO SIGNUP DATA AVAILABLE
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="signupGradientMC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142 76% 50%)" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="hsl(142 76% 50%)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(142 76% 50%)" stopOpacity={0} />
                </linearGradient>
                <filter id="glowSignup" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid
                strokeDasharray="1 4"
                stroke="hsl(142 76% 50% / 0.1)"
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
                  border: "1px solid hsl(142 76% 50% / 0.3)",
                  borderRadius: "6px",
                  boxShadow: "0 0 20px hsl(142 76% 50% / 0.15)",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "12px",
                }}
                labelStyle={{
                  color: "hsl(210 40% 96%)",
                  fontWeight: 500,
                  marginBottom: "4px",
                }}
                itemStyle={{
                  color: "hsl(142 76% 50%)",
                }}
                cursor={{
                  stroke: "hsl(142 76% 50% / 0.3)",
                  strokeDasharray: "4 4",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(142 76% 50%)"
                strokeWidth={2}
                fill="url(#signupGradientMC)"
                filter="url(#glowSignup)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: "hsl(142 76% 50%)",
                  stroke: "hsl(222 47% 8%)",
                  strokeWidth: 2,
                  filter: "url(#glowSignup)",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
