import Link from 'next/link'
import { fetchIncident } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Sparkles, Terminal, Clock, AlertCircle, Activity, FileText } from 'lucide-react'

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100)
  const color = percent >= 80
    ? 'bg-emerald-500 shadow-glow-success'
    : percent >= 60
    ? 'bg-amber-500 glow-amber'
    : 'bg-red-500 glow-critical'

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="font-mono text-sm text-foreground">{percent}%</span>
    </div>
  )
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let data = null
  let error: string | null = null

  try {
    data = await fetchIncident(id)
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load incident'
  }

  if (error) {
    return (
      <div className="space-y-6">
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
        <Button variant="ghost" asChild className="font-mono text-xs">
          <Link href="/incidents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            BACK TO REGISTRY
          </Link>
        </Button>
      </div>
    )
  }

  if (!data) return null

  const { incident, events, ai_summary } = data

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Button variant="ghost" asChild className="-ml-4 font-mono text-xs hover:text-primary transition-colors">
        <Link href="/incidents">
          <ArrowLeft className="mr-2 h-4 w-4" />
          BACK TO REGISTRY
        </Link>
      </Button>

      {/* Tactical Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
            INCIDENT DETAIL
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <Terminal className="h-3 w-3" />
            ID: {incident.id}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge
            variant={
              incident.status === 'open'
                ? 'open'
                : incident.status === 'investigating'
                ? 'investigating'
                : 'resolved'
            }
            pulse={incident.status === 'open'}
          >
            {incident.status.toUpperCase()}
          </Badge>
          <Badge
            variant={
              incident.severity === 'critical'
                ? 'critical'
                : incident.severity === 'error'
                ? 'error'
                : 'warn'
            }
          >
            {incident.severity.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Incident Overview Card */}
      <Card variant="glow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono">{incident.title}</CardTitle>
            <Activity className="h-4 w-4 text-primary drop-shadow-[0_0_4px_hsl(185_75%_50%/0.5)]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="tactical-label">Environment</dt>
              <dd className="mt-1 font-mono text-sm text-foreground uppercase">{incident.environment}</dd>
            </div>
            <div>
              <dt className="tactical-label flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Opened
              </dt>
              <dd className="mt-1 font-mono text-sm text-foreground">{formatDate(incident.opened_at)}</dd>
            </div>
            <div>
              <dt className="tactical-label flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last Seen
              </dt>
              <dd className="mt-1 font-mono text-sm text-foreground">{formatDate(incident.last_seen_at)}</dd>
            </div>
          </div>

          {/* Terminal-Style Fingerprint */}
          <div className="mt-6">
            <dt className="tactical-label flex items-center gap-1 mb-2">
              <Terminal className="h-3 w-3" />
              Fingerprint
            </dt>
            <dd className="font-mono text-xs bg-background border border-primary/20 rounded px-3 py-2 text-primary/90 overflow-x-auto">
              <span className="text-muted-foreground select-none">$ </span>
              {incident.fingerprint}
            </dd>
          </div>
        </CardContent>
      </Card>

      {/* AI Summary */}
      {ai_summary && (
        <div>
          <div className="mb-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              AI Analysis
            </span>
          </div>
          <Card variant="tactical" className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary drop-shadow-[0_0_6px_hsl(185_75%_50%/0.5)] animate-pulse-glow" />
                  <CardTitle className="font-mono text-lg">NEURAL ANALYSIS</CardTitle>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  {ai_summary.model}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Confidence Meter */}
              <div>
                <div className="tactical-label mb-2">Confidence Level</div>
                <ConfidenceMeter confidence={ai_summary.confidence} />
              </div>

              {/* Impact */}
              <div>
                <div className="tactical-label mb-2">Impact Assessment</div>
                <p className="font-mono text-sm text-foreground/90 leading-relaxed">{ai_summary.impact}</p>
              </div>

              {/* Likely Causes */}
              <div>
                <div className="tactical-label mb-2">Probable Causes</div>
                <ul className="space-y-1.5">
                  {ai_summary.likely_causes.map((cause, i) => (
                    <li key={i} className="flex items-start gap-2 font-mono text-sm text-foreground/80">
                      <span className="text-primary mt-0.5">{'>'}</span>
                      {cause}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Evidence */}
              <div>
                <div className="tactical-label mb-2">Supporting Evidence</div>
                <ul className="space-y-1.5">
                  {ai_summary.evidence.map((evidence, i) => (
                    <li key={i} className="flex items-start gap-2 font-mono text-sm text-foreground/80">
                      <span className="text-emerald-400 mt-0.5">+</span>
                      {evidence}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Next Steps */}
              <div>
                <div className="tactical-label mb-2">Recommended Actions</div>
                <ul className="space-y-1.5">
                  {ai_summary.next_steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 font-mono text-sm text-foreground/80">
                      <span className="text-amber-400 font-bold mt-0.5">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Events Section */}
      <div>
        <div className="mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Event Stream
          </span>
        </div>
        <Card variant="glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-mono">Recent Events</CardTitle>
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground mt-1">
                  SHOWING {Math.min(events.length, 20)} OF {events.length} EVENTS
                </p>
              </div>
              <FileText className="h-4 w-4 text-primary drop-shadow-[0_0_4px_hsl(185_75%_50%/0.5)]" />
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="flex h-32 items-center justify-center font-mono text-sm text-muted-foreground">
                NO EVENTS RECORDED
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Attributes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.slice(0, 20).map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(event.occurred_at)}
                      </TableCell>
                      <TableCell className="uppercase text-[10px] tracking-wider text-foreground">
                        {event.event_type}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            event.severity === 'critical'
                              ? 'critical'
                              : event.severity === 'error'
                              ? 'error'
                              : event.severity === 'warn'
                              ? 'warn'
                              : 'info'
                          }
                        >
                          {event.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-background border border-border px-1.5 py-0.5 rounded font-mono text-primary/80">
                          {JSON.stringify(event.attributes)}
                        </code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
