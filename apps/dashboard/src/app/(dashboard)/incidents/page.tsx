import Link from 'next/link'
import { fetchIncidents, Incident } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle } from 'lucide-react'

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default async function IncidentsPage() {
  let data: { incidents: Incident[] } | null = null
  let error: string | null = null

  try {
    data = await fetchIncidents({ limit: 50 })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load incidents'
  }

  const openCount = data?.incidents.filter(i => i.status === 'open').length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
            INCIDENT REGISTRY
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            ACTIVE AND RECENT INCIDENTS DETECTED BY THE SYSTEM
          </p>
        </div>
        {openCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 shadow-glow-red animate-pulse-glow" />
            <span className="font-mono text-xs text-red-400">
              {openCount} OPEN
            </span>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 animate-fade-in-up">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 drop-shadow-[0_0_4px_hsl(0_90%_55%/0.5)]" />
            <div>
              <p className="font-mono text-sm text-red-400">{error}</p>
              <p className="font-mono text-xs text-red-400/70 mt-1">
                ENSURE CORE-API IS RUNNING ON PORT 3001
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Incidents Table */}
      <Card variant="glow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Incidents</CardTitle>
              <CardDescription className="font-mono text-[10px] tracking-wider mt-1">
                {data?.incidents.length || 0} INCIDENTS FOUND
              </CardDescription>
            </div>
            <AlertCircle className="h-4 w-4 text-primary drop-shadow-[0_0_4px_hsl(185_75%_50%/0.5)]" />
          </div>
        </CardHeader>
        <CardContent>
          {data && data.incidents.length === 0 ? (
            <div className="flex h-32 items-center justify-center font-mono text-sm text-muted-foreground">
              NO INCIDENTS FOUND
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.incidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell>
                      <Link
                        href={`/incidents/${incident.id}`}
                        className="text-primary hover:text-primary/80 transition-colors"
                      >
                        {incident.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          incident.status === 'open'
                            ? 'open'
                            : incident.status === 'investigating'
                            ? 'investigating'
                            : 'resolved'
                        }
                      >
                        {incident.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          incident.severity === 'critical'
                            ? 'critical'
                            : incident.severity === 'error'
                            ? 'error'
                            : 'warn'
                        }
                      >
                        {incident.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground uppercase text-[10px] tracking-wider">
                      {incident.environment}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(incident.opened_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(incident.last_seen_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
