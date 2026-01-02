'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  fetchAIStats,
  fetchAIActivity,
  fetchAIJobs,
  AIStats,
  AIActivity,
  AIJob,
} from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Sparkles, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100)
  const variant = percent >= 80 ? 'succeeded' : percent >= 60 ? 'investigating' : 'failed'
  return <Badge variant={variant}>{percent}%</Badge>
}

function JobStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'succeeded':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />
  }
}

export default function AIPage() {
  const [stats, setStats] = useState<AIStats | null>(null)
  const [activity, setActivity] = useState<AIActivity[]>([])
  const [jobs, setJobs] = useState<AIJob[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, activityData, jobsData] = await Promise.all([
          fetchAIStats(),
          fetchAIActivity(10),
          fetchAIJobs({ limit: 10 }),
        ])
        setStats(statsData)
        setActivity(activityData.activity)
        setJobs(jobsData.jobs)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load AI data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Insights</h1>
          <p className="text-muted-foreground">
            AI-powered incident analysis and summary generation.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Insights</h1>
        <p className="text-muted-foreground">
          AI-powered incident analysis and summary generation.
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

      {stats && (
        <>
          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Summaries</CardTitle>
                <Sparkles className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_summaries}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.summaries_last_24h} in last 24h
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.success_rate}%</div>
                <p className="text-xs text-muted-foreground">
                  {stats.jobs_by_status.succeeded || 0} succeeded, {stats.jobs_by_status.failed || 0} failed
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
                <Sparkles className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.avg_confidence ? `${Math.round(stats.avg_confidence * 100)}%` : 'N/A'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Models Used</CardTitle>
                <Sparkles className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.models_used.length}</div>
                <p className="text-xs text-muted-foreground truncate">
                  {stats.models_used.map((m) => m.model).join(', ')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Jobs by Status */}
          <Card>
            <CardHeader>
              <CardTitle>Jobs by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {Object.entries(stats.jobs_by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2">
                    <JobStatusIcon status={status} />
                    <span className="text-sm font-medium capitalize">{status}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent AI Activity</CardTitle>
          <CardDescription>Latest AI-generated summaries</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No AI activity yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Summary</TableHead>
                  <TableHead>Incident</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.title || 'Untitled'}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/incidents/${item.incident_id}`}
                        className="text-primary hover:underline"
                      >
                        {item.incident_title}
                      </Link>
                      <div className="mt-1">
                        <Badge
                          variant={
                            item.incident_severity === 'critical'
                              ? 'critical'
                              : item.incident_severity === 'error'
                              ? 'error'
                              : 'warn'
                          }
                        >
                          {item.incident_severity}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ConfidenceBadge confidence={item.confidence} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.model}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(item.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Job Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Job Queue</CardTitle>
          <CardDescription>Pending and recent AI jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No jobs in queue
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Incident</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        href={`/incidents/${job.incident_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {job.incident_title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {job.job_type}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <JobStatusIcon status={job.status} />
                        <Badge
                          variant={
                            job.status === 'succeeded'
                              ? 'succeeded'
                              : job.status === 'failed'
                              ? 'failed'
                              : job.status === 'running'
                              ? 'running'
                              : 'queued'
                          }
                        >
                          {job.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {job.attempt_count} / {job.max_attempts}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(job.created_at)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-destructive" title={job.last_error || ''}>
                      {job.last_error ? job.last_error.substring(0, 50) + '...' : '-'}
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
