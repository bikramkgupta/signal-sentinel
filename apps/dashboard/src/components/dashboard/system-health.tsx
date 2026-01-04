"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Server } from "lucide-react"
import { cn } from "@/lib/utils"

interface ServiceStatus {
  name: string
  status: "healthy" | "degraded" | "down"
  latency?: number
}

interface SystemHealthProps {
  services?: ServiceStatus[]
}

const defaultServices: ServiceStatus[] = [
  { name: "API", status: "healthy", latency: 45 },
  { name: "Database", status: "healthy", latency: 12 },
  { name: "Event Pipeline", status: "healthy" },
  { name: "AI Service", status: "healthy", latency: 230 },
]

function StatusIndicator({ status }: { status: ServiceStatus["status"] }) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 rounded-full transition-all",
        status === "healthy" && "bg-emerald-500 shadow-glow-green animate-breathe",
        status === "degraded" && "bg-amber-500 shadow-glow-amber animate-pulse-glow",
        status === "down" && "bg-red-500 shadow-glow-red animate-pulse-glow"
      )}
    />
  )
}

function StatusLabel({ status }: { status: ServiceStatus["status"] }) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] uppercase tracking-wider",
        status === "healthy" && "text-emerald-400",
        status === "degraded" && "text-amber-400",
        status === "down" && "text-red-400"
      )}
    >
      {status}
    </span>
  )
}

function LatencyBar({ latency, max = 500 }: { latency: number; max?: number }) {
  const percentage = Math.min((latency / max) * 100, 100)
  const color =
    latency < 100
      ? "bg-emerald-500/60"
      : latency < 300
      ? "bg-amber-500/60"
      : "bg-red-500/60"

  return (
    <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export function SystemHealth({ services = defaultServices }: SystemHealthProps) {
  const allHealthy = services.every((s) => s.status === "healthy")
  const healthyCount = services.filter((s) => s.status === "healthy").length

  return (
    <Card variant="glow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>System Health</span>
              {allHealthy && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-glow-green animate-breathe" />
              )}
            </CardTitle>
            <CardDescription className="font-mono text-[10px] tracking-wider mt-1">
              {allHealthy
                ? "ALL SYSTEMS OPERATIONAL"
                : `${healthyCount}/${services.length} SYSTEMS HEALTHY`}
            </CardDescription>
          </div>
          <Server className="h-4 w-4 text-primary drop-shadow-[0_0_4px_hsl(185_75%_50%/0.5)]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {services.map((service, index) => (
            <div
              key={service.name}
              className={cn(
                "group flex items-center justify-between py-2.5 -mx-4 px-4",
                "border-b border-border/20 last:border-0",
                "hover:bg-primary/5 transition-colors animate-fade-in-up"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                <StatusIndicator status={service.status} />
                <span className="font-mono text-sm text-foreground">
                  {service.name}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {service.latency !== undefined && (
                  <div className="flex items-center gap-2">
                    <LatencyBar latency={service.latency} />
                    <span className="font-mono text-[10px] text-muted-foreground w-10 text-right">
                      {service.latency}ms
                    </span>
                  </div>
                )}
                <StatusLabel status={service.status} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
