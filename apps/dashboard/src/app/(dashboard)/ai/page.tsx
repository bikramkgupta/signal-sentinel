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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Sparkles, CheckCircle2, XCircle, Clock, Loader2, Brain, Activity, AlertCircle, Cpu, Zap } from 'lucide-react'

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100)
  const getColor = () => {
    if (percent >= 80) return 'bg-emerald-500'
    if (percent >= 60) return 'bg-amber-500'
    return 'bg-red-500'
  }
  const getGlow = () => {
    if (percent >= 80) return 'shadow-[0_0_8px_hsl(142_76%_50%/0.6)]'
    if (percent >= 60) return 'shadow-[0_0_8px_hsl(38_92%_50%/0.6)]'
    return 'shadow-[0_0_8px_hsl(0_90%_55%/0.6)]'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} ${getGlow()} transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="font-mono text-xs text-foreground w-10 text-right">{percent}%</span>
    </div>
  )
}

function JobStatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; class: string }> = {
    succeeded: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    },
    failed: {
      icon: <XCircle className="h-3 w-3" />,
      class: 'bg-red-500/20 text-red-400 border-red-500/30'
    },
    running: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      class: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    },
    pending: {
      icon: <Clock className="h-3 w-3" />,
      class: 'bg-muted text-muted-foreground border-border'
    },
  }

  const { icon, class: className } = config[status] || config.pending

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider border ${className}`}>
      {icon}
      {status}
    </span>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  loading = false
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string
  loading?: boolean
}) {
  return (
    <Card variant="glow" className="hover-lift">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="tactical-label mb-1">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="font-mono text-2xl font-bold text-foreground tracking-tight text-glow">
                {value}
              </p>
            )}
            {subtitle && (
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <Icon className={`h-5 w-5 ${iconColor} drop-shadow-[0_0_6px_currentColor]`} />
        </div>
      </CardContent>
    </Card>
  )
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

  const systemStatus = error ? 'OFFLINE' : loading ? 'INITIALIZING' : 'ONLINE'
  const statusColor = error ? 'text-red-400' : loading ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
            AI INSIGHTS
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <Brain className="h-3 w-3" />
            NEURAL ANALYSIS ENGINE
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${error ? 'bg-red-500 shadow-glow-red' : loading ? 'bg-amber-500 glow-amber' : 'bg-emerald-500 shadow-glow-success'} animate-pulse-glow`} />
          <span className={`font-mono text-xs ${statusColor}`}>{systemStatus}</span>
        </div>
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

      {/* Stats Section */}
      <div>
        <div className="mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            System Metrics
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Summaries"
            value={stats?.total_summaries ?? '-'}
            subtitle={stats ? `${stats.summaries_last_24h} IN LAST 24H` : undefined}
            icon={Sparkles}
            iconColor="text-purple-400"
            loading={loading}
          />
          <StatCard
            title="Success Rate"
            value={stats ? `${stats.success_rate}%` : '-'}
            subtitle={stats ? `${stats.jobs_by_status.succeeded || 0} OK / ${stats.jobs_by_status.failed || 0} FAIL` : undefined}
            icon={CheckCircle2}
            iconColor="text-emerald-400"
            loading={loading}
          />
          <StatCard
            title="Avg Confidence"
            value={stats?.avg_confidence ? `${Math.round(stats.avg_confidence * 100)}%` : 'N/A'}
            icon={Activity}
            iconColor="text-cyan-400"
            loading={loading}
          />
          <StatCard
            title="Models Active"
            value={stats?.models_used.length ?? '-'}
            subtitle={stats?.models_used.map(m => m.model).slice(0, 2).join(', ')}
            icon={Cpu}
            iconColor="text-amber-400"
            loading={loading}
          />
        </div>
      </div>

      {/* Jobs Status */}
      {stats && (
        <div>
          <div className="mb-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Job Queue Status
            </span>
          </div>
          <Card variant="glow">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap gap-4">
                {Object.entries(stats.jobs_by_status).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2">
                    <JobStatusBadge status={status} />
                    <span className="font-mono text-lg font-bold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <div className="mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Neural Activity Feed
          </span>
        </div>
        <Card variant="glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-mono">Recent Analyses</CardTitle>
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground mt-1">
                  {activity.length} SUMMARIES GENERATED
                </p>
              </div>
              <Sparkles className="h-4 w-4 text-primary drop-shadow-[0_0_4px_hsl(185_75%_50%/0.5)] animate-pulse-glow" />
            </div>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <div className="flex flex-col h-32 items-center justify-center text-muted-foreground">
                <Brain className="h-6 w-6 mb-2 opacity-50" />
                <span className="font-mono text-sm">NO AI ACTIVITY YET</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incident</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="w-48">Confidence</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.map((item) => (
                    <TableRow key={item.id} className="animate-fade-in-up">
                      <TableCell>
                        <Link
                          href={`/incidents/${item.incident_id}`}
                          className="text-primary hover:text-primary/80 transition-colors font-mono text-sm"
                        >
                          {item.incident_title}
                        </Link>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        <ConfidenceMeter confidence={item.confidence} />
                      </TableCell>
                      <TableCell className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {item.model}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Job Queue */}
      <div>
        <div className="mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Processing Queue
          </span>
        </div>
        <Card variant="glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-mono">Active Jobs</CardTitle>
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground mt-1">
                  {jobs.length} JOBS IN QUEUE
                </p>
              </div>
              <Zap className="h-4 w-4 text-amber-500 drop-shadow-[0_0_4px_hsl(38_92%_50%/0.5)]" />
            </div>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="flex flex-col h-32 items-center justify-center text-muted-foreground">
                <Clock className="h-6 w-6 mb-2 opacity-50" />
                <span className="font-mono text-sm">QUEUE EMPTY</span>
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
                    <TableRow key={job.id} className="animate-fade-in-up">
                      <TableCell>
                        <Link
                          href={`/incidents/${job.incident_id}`}
                          className="text-primary hover:text-primary/80 transition-colors font-mono text-sm"
                        >
                          {job.incident_title}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {job.job_type}
                      </TableCell>
                      <TableCell>
                        <JobStatusBadge status={job.status} />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {job.attempt_count}
                          <span className="text-border">/</span>
                          {job.max_attempts}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(job.created_at)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {job.last_error ? (
                          <span className="font-mono text-xs text-red-400 truncate block" title={job.last_error}>
                            {job.last_error.substring(0, 40)}...
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">—</span>
                        )}
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
