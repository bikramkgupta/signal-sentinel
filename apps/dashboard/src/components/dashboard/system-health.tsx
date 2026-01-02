"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"

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

function StatusIcon({ status }: { status: ServiceStatus["status"] }) {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "degraded":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />
    case "down":
      return <XCircle className="h-4 w-4 text-red-500" />
  }
}

function StatusText({ status }: { status: ServiceStatus["status"] }) {
  switch (status) {
    case "healthy":
      return <span className="text-green-600 dark:text-green-400">Healthy</span>
    case "degraded":
      return <span className="text-yellow-600 dark:text-yellow-400">Degraded</span>
    case "down":
      return <span className="text-red-600 dark:text-red-400">Down</span>
  }
}

export function SystemHealth({ services = defaultServices }: SystemHealthProps) {
  const allHealthy = services.every((s) => s.status === "healthy")

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Health</CardTitle>
        <CardDescription>
          {allHealthy
            ? "All systems operational"
            : "Some services are experiencing issues"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services.map((service) => (
            <div key={service.name} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusIcon status={service.status} />
                <span className="text-sm font-medium">{service.name}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {service.latency !== undefined && (
                  <span className="text-muted-foreground">{service.latency}ms</span>
                )}
                <StatusText status={service.status} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
