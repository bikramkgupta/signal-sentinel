import Link from 'next/link'
import { fetchIncident } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Sparkles } from 'lucide-react'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
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
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive">{error}</p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/incidents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to incidents
          </Link>
        </Button>
      </div>
    )
  }

  if (!data) return null

  const { incident, events, ai_summary } = data

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="-ml-4">
        <Link href="/incidents">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to incidents
        </Link>
      </Button>

      {/* Incident Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{incident.title}</CardTitle>
              <CardDescription className="font-mono text-xs mt-1">
                ID: {incident.id}
              </CardDescription>
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
              >
                {incident.status}
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
                {incident.severity}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Environment</dt>
              <dd className="mt-1 text-sm">{incident.environment}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Opened</dt>
              <dd className="mt-1 text-sm">{formatDate(incident.opened_at)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Last Seen</dt>
              <dd className="mt-1 text-sm">{formatDate(incident.last_seen_at)}</dd>
            </div>
            <div className="sm:col-span-3">
              <dt className="text-sm font-medium text-muted-foreground">Fingerprint</dt>
              <dd className="mt-1 text-sm font-mono bg-muted px-2 py-1 rounded">
                {incident.fingerprint}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* AI Summary */}
      {ai_summary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>AI Analysis</CardTitle>
              <Badge variant="secondary" className="ml-2">
                {Math.round(ai_summary.confidence * 100)}% confidence
              </Badge>
              <span className="text-xs text-muted-foreground">
                by {ai_summary.model}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium">Impact</h4>
              <p className="mt-1 text-sm text-muted-foreground">{ai_summary.impact}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium">Likely Causes</h4>
              <ul className="mt-1 list-disc list-inside text-sm text-muted-foreground">
                {ai_summary.likely_causes.map((cause, i) => (
                  <li key={i}>{cause}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium">Evidence</h4>
              <ul className="mt-1 list-disc list-inside text-sm text-muted-foreground">
                {ai_summary.evidence.map((evidence, i) => (
                  <li key={i}>{evidence}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium">Next Steps</h4>
              <ul className="mt-1 list-disc list-inside text-sm text-muted-foreground">
                {ai_summary.next_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>
            Showing {Math.min(events.length, 20)} of {events.length} events
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  <TableCell className="text-muted-foreground">
                    {formatDate(event.occurred_at)}
                  </TableCell>
                  <TableCell>{event.event_type}</TableCell>
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
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {JSON.stringify(event.attributes)}
                    </code>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
