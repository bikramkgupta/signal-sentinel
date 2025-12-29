import Link from 'next/link'
import { fetchIncidents, Incident } from '@/lib/api'

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
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Incidents</h1>
          <p className="mt-2 text-sm text-gray-700">
            Active and recent incidents detected by the system.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <p className="text-sm text-red-600 mt-1">Make sure core-api is running on port 3001</p>
        </div>
      )}

      {data && data.incidents.length === 0 && (
        <div className="mt-8 text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No incidents found</p>
        </div>
      )}

      {data && data.incidents.length > 0 && (
        <div className="mt-8 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Title</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Severity</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Environment</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Opened</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {data.incidents.map((incident) => (
                      <tr key={incident.id} className="hover:bg-gray-50">
                        <td className="py-4 pl-4 pr-3 text-sm">
                          <Link href={`/incidents/${incident.id}`} className="font-medium text-indigo-600 hover:text-indigo-900">
                            {incident.title}
                          </Link>
                        </td>
                        <td className="px-3 py-4 text-sm">
                          <StatusBadge status={incident.status} />
                        </td>
                        <td className="px-3 py-4 text-sm">
                          <SeverityBadge severity={incident.severity} />
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">{incident.environment}</td>
                        <td className="px-3 py-4 text-sm text-gray-500">{formatDate(incident.opened_at)}</td>
                        <td className="px-3 py-4 text-sm text-gray-500">{formatDate(incident.last_seen_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
