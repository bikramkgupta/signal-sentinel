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

function StatCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <dt className="text-sm font-medium text-gray-500 truncate">{label}</dt>
        <dd className="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
        {subtext && <dd className="mt-1 text-sm text-gray-500">{subtext}</dd>}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    succeeded: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    error: 'bg-orange-100 text-orange-800',
    warn: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[severity] || 'bg-gray-100 text-gray-800'}`}>
      {severity}
    </span>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100)
  const color = percent >= 80 ? 'text-green-600' : percent >= 60 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`font-medium ${color}`}>{percent}%</span>
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
      <div className="px-4 sm:px-0">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white shadow rounded-lg h-24"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">AI Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Overview of AI-powered incident analysis and summary generation.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <p className="text-sm text-red-600 mt-1">Make sure core-api is running on port 3001</p>
        </div>
      )}

      {stats && (
        <>
          {/* Stats Grid */}
          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Statistics</h2>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Summaries"
                value={stats.total_summaries}
                subtext={`${stats.summaries_last_24h} in last 24h`}
              />
              <StatCard
                label="Success Rate"
                value={`${stats.success_rate}%`}
                subtext={`${stats.jobs_by_status.succeeded || 0} succeeded, ${stats.jobs_by_status.failed || 0} failed`}
              />
              <StatCard
                label="Avg Confidence"
                value={stats.avg_confidence ? `${Math.round(stats.avg_confidence * 100)}%` : 'N/A'}
              />
              <StatCard
                label="Models Used"
                value={stats.models_used.length}
                subtext={stats.models_used.map(m => m.model).join(', ')}
              />
            </dl>
          </div>

          {/* Jobs by Status */}
          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Jobs by Status</h2>
            <div className="flex flex-wrap gap-4">
              {Object.entries(stats.jobs_by_status).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  <span className="text-gray-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent AI Activity</h2>
        {activity.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No AI activity yet</p>
          </div>
        ) : (
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Summary</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Incident</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Confidence</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Model</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {activity.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                      {item.title || 'Untitled'}
                    </td>
                    <td className="px-3 py-4 text-sm">
                      <Link href={`/incidents/${item.incident_id}`} className="text-indigo-600 hover:text-indigo-900">
                        {item.incident_title}
                      </Link>
                      <div className="mt-1">
                        <SeverityBadge severity={item.incident_severity} />
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm">
                      <ConfidenceBadge confidence={item.confidence} />
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {item.model}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Job Queue */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Job Queue</h2>
        {jobs.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No jobs in queue</p>
          </div>
        ) : (
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Incident</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Attempts</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Created</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="py-4 pl-4 pr-3 text-sm">
                      <Link href={`/incidents/${job.incident_id}`} className="font-medium text-indigo-600 hover:text-indigo-900">
                        {job.incident_title}
                      </Link>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {job.job_type}
                    </td>
                    <td className="px-3 py-4 text-sm">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {job.attempt_count} / {job.max_attempts}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="px-3 py-4 text-sm text-red-600 max-w-xs truncate" title={job.last_error || ''}>
                      {job.last_error ? job.last_error.substring(0, 50) + '...' : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
