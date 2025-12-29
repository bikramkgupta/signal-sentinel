'use client'

import { useState } from 'react'
import { searchEvents, SearchEvent } from '@/lib/api'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    critical: 'bg-red-100 text-red-800',
    error: 'bg-orange-100 text-orange-800',
    warn: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
    debug: 'bg-gray-100 text-gray-800',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
      {severity}
    </span>
  )
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState<SearchEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const data = await searchEvents({ q: query, limit: 50 })
      setEvents(data.events)
      setTotal(data.pagination.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex-auto">
        <h1 className="text-2xl font-semibold text-gray-900">Event Search</h1>
        <p className="mt-2 text-sm text-gray-700">
          Search through all indexed events in OpenSearch.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mt-6">
        <div className="flex gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events by message..."
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2 border"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <p className="text-sm text-red-600 mt-1">Make sure core-api is running on port 3001</p>
        </div>
      )}

      {/* Results */}
      {events.length > 0 && (
        <div className="mt-6">
          <p className="text-sm text-gray-500 mb-4">
            Found {total} events
          </p>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Environment</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => (
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
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                      {event.message}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {event.environment}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && events.length === 0 && query && !error && (
        <div className="mt-8 text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No events found for &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  )
}
