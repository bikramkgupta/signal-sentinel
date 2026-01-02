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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

export default async function IncidentsPage() {
  let data: { incidents: Incident[] } | null = null
  let error: string | null = null

  try {
    data = await fetchIncidents({ limit: 50 })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load incidents'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Incidents</h1>
        <p className="text-muted-foreground">
          Active and recent incidents detected by the system.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive">{error}</p>
          <p className="text-sm text-destructive/80 mt-1">
            Make sure core-api is running on port 3001
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Incidents</CardTitle>
          <CardDescription>
            {data?.incidents.length || 0} incidents found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.incidents.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No incidents found
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
                        className="font-medium text-primary hover:underline"
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
                    <TableCell className="text-muted-foreground">
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
