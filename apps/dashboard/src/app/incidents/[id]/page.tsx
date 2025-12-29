import Link from 'next/link'
import { fetchIncident } from '@/lib/api'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    critical: 'bg-red-100 text-red-800',
    error: 'bg-orange-100 text-orange-800',
    warn: 'bg-yellow-100 text-yellow-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
      {severity}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    open: 'bg-red-100 text-red-800',
    investigating: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
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
      <div className="px-4 sm:px-0">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
        <Link href="/" className="mt-4 inline-block text-indigo-600 hover:text-indigo-900">
          &larr; Back to incidents
        </Link>
      </div>
    )
  }

  if (!data) return null

  const { incident, events, ai_summary } = data

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <Link href="/" className="text-indigo-600 hover:text-indigo-900">
          &larr; Back to incidents
        </Link>
      </div>

      {/* Incident Header */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{incident.title}</h1>
            <p className="mt-1 text-sm text-gray-500">ID: {incident.id}</p>
          </div>
          <div className="flex space-x-2">
            <StatusBadge status={incident.status} />
            <SeverityBadge severity={incident.severity} />
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-medium text-gray-500">Environment</dt>
            <dd className="mt-1 text-sm text-gray-900">{incident.environment}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Opened</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(incident.opened_at)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Seen</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(incident.last_seen_at)}</dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="text-sm font-medium text-gray-500">Fingerprint</dt>
            <dd className="mt-1 text-sm font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded">{incident.fingerprint}</dd>
          </div>
        </dl>
      </div>

      {/* AI Summary */}
      {ai_summary && (
        <div className="bg-indigo-50 border border-indigo-200 shadow rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <span className="text-lg font-semibold text-indigo-900">AI Analysis</span>
            <span className="ml-2 text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
              {Math.round(ai_summary.confidence * 100)}% confidence
            </span>
            <span className="ml-2 text-xs text-gray-500">
              by {ai_summary.model}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-indigo-900">Impact</h4>
              <p className="mt-1 text-sm text-gray-700">{ai_summary.impact}</p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-indigo-900">Likely Causes</h4>
              <ul className="mt-1 list-disc list-inside text-sm text-gray-700">
                {ai_summary.likely_causes.map((cause, i) => (
                  <li key={i}>{cause}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-indigo-900">Evidence</h4>
              <ul className="mt-1 list-disc list-inside text-sm text-gray-700">
                {ai_summary.evidence.map((evidence, i) => (
                  <li key={i}>{evidence}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium text-indigo-900">Next Steps</h4>
              <ul className="mt-1 list-disc list-inside text-sm text-gray-700">
                {ai_summary.next_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Events */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Recent Events ({events.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attributes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.slice(0, 20).map((event) => (
                <tr key={event.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(event.occurred_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.event_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <SeverityBadge severity={event.severity} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                      {JSON.stringify(event.attributes)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
