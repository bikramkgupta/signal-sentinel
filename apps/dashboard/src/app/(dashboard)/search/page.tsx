'use client'

import { useState, useEffect } from 'react'
import { searchEvents, SearchEvent } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Filter, Lightbulb } from 'lucide-react'

const EVENT_TYPES = [
  { value: 'error', label: 'Error', color: 'bg-red-500' },
  { value: 'http_request', label: 'HTTP', color: 'bg-blue-500' },
  { value: 'signup', label: 'Signup', color: 'bg-green-500' },
  { value: 'deploy', label: 'Deploy', color: 'bg-purple-500' },
  { value: 'feedback', label: 'Feedback', color: 'bg-yellow-500' },
]

const SEVERITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-red-600' },
  { value: 'error', label: 'Error', color: 'bg-orange-500' },
  { value: 'warn', label: 'Warning', color: 'bg-yellow-500' },
  { value: 'info', label: 'Info', color: 'bg-blue-400' },
]

const SEARCH_HINTS = [
  { query: 'timeout', description: 'Database timeouts' },
  { query: 'BURST', description: 'Error burst events' },
  { query: 'memory', description: 'OOM errors' },
  { query: 'POST /api', description: 'POST requests' },
  { query: 'signup', description: 'User signups' },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([])
  const [events, setEvents] = useState<SearchEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  // Load recent events on mount
  useEffect(() => {
    loadRecentEvents()
  }, [])

  const loadRecentEvents = async () => {
    setLoading(true)
    try {
      const data = await searchEvents({ limit: 10 })
      setEvents(data.events)
      setTotal(data.pagination.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const toggleSeverity = (severity: string) => {
    setSelectedSeverities(prev =>
      prev.includes(severity) ? prev.filter(s => s !== severity) : [...prev, severity]
    )
  }

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // If multiple types selected, we need to make multiple requests and combine
      // For now, use first selected type or undefined for all
      const eventType = selectedTypes.length === 1 ? selectedTypes[0] : undefined

      const data = await searchEvents({
        q: query || undefined,
        event_type: eventType,
        limit: 50
      })

      // Client-side filter for multiple types and severities
      let filtered = data.events
      if (selectedTypes.length > 1) {
        filtered = filtered.filter(e => selectedTypes.includes(e.event_type))
      }
      if (selectedSeverities.length > 0) {
        filtered = filtered.filter(e => selectedSeverities.includes(e.severity))
      }

      setEvents(filtered)
      setTotal(filtered.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const handleHintClick = (hint: string) => {
    setQuery(hint)
    // Trigger search after setting query
    setTimeout(() => {
      const form = document.getElementById('search-form') as HTMLFormElement
      form?.requestSubmit()
    }, 0)
  }

  const clearFilters = () => {
    setQuery('')
    setSelectedTypes([])
    setSelectedSeverities([])
    loadRecentEvents()
  }

  const hasActiveFilters = query || selectedTypes.length > 0 || selectedSeverities.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Event Search</h1>
        <p className="text-muted-foreground">
          Search and filter events indexed in OpenSearch
        </p>
      </div>

      {/* Search Form */}
      <Card>
        <CardContent className="pt-6">
          <form id="search-form" onSubmit={handleSearch} className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by message content..."
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </Button>
              {hasActiveFilters && (
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-6">
              {/* Event Type Filters */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  Event Type
                </div>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => toggleType(type.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        selectedTypes.includes(type.value)
                          ? `${type.color} text-white`
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity Filters */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Severity
                </div>
                <div className="flex flex-wrap gap-2">
                  {SEVERITIES.map((sev) => (
                    <button
                      key={sev.value}
                      type="button"
                      onClick={() => toggleSeverity(sev.value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        selectedSeverities.includes(sev.value)
                          ? `${sev.color} text-white`
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      }`}
                    >
                      {sev.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Search Hints */}
            <div className="flex items-center gap-3 pt-2 border-t">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Try:</span>
              <div className="flex flex-wrap gap-2">
                {SEARCH_HINTS.map((hint) => (
                  <button
                    key={hint.query}
                    type="button"
                    onClick={() => handleHintClick(hint.query)}
                    className="text-sm text-primary hover:underline"
                    title={hint.description}
                  >
                    {hint.query}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            {hasActiveFilters ? 'Search Results' : 'Recent Events'}
          </CardTitle>
          <CardDescription>
            {hasActiveFilters
              ? `Found ${total.toLocaleString()} matching events`
              : `Showing ${events.length} most recent events`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="w-1/3">Message</TableHead>
                  <TableHead>Environment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {formatDate(event.occurred_at)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        EVENT_TYPES.find(t => t.value === event.event_type)?.color || 'bg-gray-500'
                      } text-white`}>
                        {event.event_type}
                      </span>
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
                    <TableCell className="max-w-md truncate" title={event.message}>
                      {event.message}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.environment}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              {loading ? 'Loading...' : 'No events found'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
