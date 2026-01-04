'use client'

import { useState, useEffect } from 'react'
import { searchEvents, SearchEvent } from '@/lib/api'
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
import { Search, Terminal, Zap, AlertCircle, Database } from 'lucide-react'

const EVENT_TYPES = [
  { value: 'error', label: 'ERROR', color: 'bg-red-500/80 border-red-500' },
  { value: 'http_request', label: 'HTTP', color: 'bg-blue-500/80 border-blue-500' },
  { value: 'signup', label: 'SIGNUP', color: 'bg-emerald-500/80 border-emerald-500' },
  { value: 'deploy', label: 'DEPLOY', color: 'bg-purple-500/80 border-purple-500' },
  { value: 'feedback', label: 'FEEDBACK', color: 'bg-amber-500/80 border-amber-500' },
]

const SEVERITIES = [
  { value: 'critical', label: 'CRITICAL', color: 'bg-red-600/80 border-red-600' },
  { value: 'error', label: 'ERROR', color: 'bg-orange-500/80 border-orange-500' },
  { value: 'warn', label: 'WARN', color: 'bg-amber-500/80 border-amber-500' },
  { value: 'info', label: 'INFO', color: 'bg-cyan-500/80 border-cyan-500' },
]

const SEARCH_HINTS = [
  { query: 'timeout', description: 'Database timeouts' },
  { query: 'BURST', description: 'Error burst events' },
  { query: 'memory', description: 'OOM errors' },
  { query: 'POST /api', description: 'POST requests' },
  { query: 'signup', description: 'User signups' },
]

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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
            EVENT SEARCH
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 flex items-center gap-2">
            <Database className="h-3 w-3" />
            OPENSEARCH INDEX QUERY INTERFACE
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-500 shadow-glow-cyan animate-pulse-glow" />
            <span className="font-mono text-xs text-cyan-400">SEARCHING</span>
          </div>
        )}
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

      {/* Search Form */}
      <Card variant="glow">
        <CardContent className="pt-6">
          <form id="search-form" onSubmit={handleSearch} className="space-y-5">
            {/* Terminal-Style Search Input */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted-foreground">
                  <Terminal className="h-4 w-4" />
                  <span className="font-mono text-xs">$</span>
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="search --query 'message content'"
                  className="w-full h-10 pl-14 pr-4 bg-background border border-primary/20 rounded font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>
              <Button type="submit" disabled={loading} className="font-mono text-xs uppercase tracking-wider">
                <Search className="mr-2 h-4 w-4" />
                {loading ? 'SCANNING...' : 'EXECUTE'}
              </Button>
              {hasActiveFilters && (
                <Button type="button" variant="outline" onClick={clearFilters} className="font-mono text-xs uppercase">
                  RESET
                </Button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-6">
              {/* Event Type Filters */}
              <div className="space-y-2">
                <div className="tactical-label">Event Type</div>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => toggleType(type.value)}
                      className={`px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wider transition-all border ${
                        selectedTypes.includes(type.value)
                          ? `${type.color} text-white shadow-lg`
                          : 'bg-muted/50 border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity Filters */}
              <div className="space-y-2">
                <div className="tactical-label">Severity</div>
                <div className="flex flex-wrap gap-2">
                  {SEVERITIES.map((sev) => (
                    <button
                      key={sev.value}
                      type="button"
                      onClick={() => toggleSeverity(sev.value)}
                      className={`px-3 py-1.5 rounded font-mono text-xs uppercase tracking-wider transition-all border ${
                        selectedSeverities.includes(sev.value)
                          ? `${sev.color} text-white shadow-lg`
                          : 'bg-muted/50 border-border hover:border-primary/30 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {sev.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Commands */}
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <Zap className="h-4 w-4 text-amber-500 drop-shadow-[0_0_4px_hsl(38_92%_50%/0.5)]" />
              <span className="tactical-label">Quick Commands:</span>
              <div className="flex flex-wrap gap-2">
                {SEARCH_HINTS.map((hint) => (
                  <button
                    key={hint.query}
                    type="button"
                    onClick={() => handleHintClick(hint.query)}
                    className="font-mono text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
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

      {/* Results Section */}
      <div>
        <div className="mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {hasActiveFilters ? 'Search Results' : 'Recent Events'}
          </span>
        </div>
        <Card variant="glow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-mono">
                  {hasActiveFilters ? 'Query Results' : 'Event Stream'}
                </CardTitle>
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground mt-1">
                  {hasActiveFilters
                    ? `${total.toLocaleString()} MATCHES FOUND`
                    : `${events.length} MOST RECENT EVENTS`
                  }
                </p>
              </div>
              <Database className="h-4 w-4 text-primary drop-shadow-[0_0_4px_hsl(185_75%_50%/0.5)]" />
            </div>
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
                    <TableRow key={event.id} className="animate-fade-in-up">
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(event.occurred_at)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider ${
                          EVENT_TYPES.find(t => t.value === event.event_type)?.color.split(' ')[0] || 'bg-gray-500/80'
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
                      <TableCell className="max-w-md">
                        <span className="font-mono text-xs text-foreground/80 truncate block" title={event.message}>
                          {event.message}
                        </span>
                      </TableCell>
                      <TableCell className="uppercase text-[10px] tracking-wider text-muted-foreground">
                        {event.environment}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col h-32 items-center justify-center text-muted-foreground">
                <Terminal className="h-6 w-6 mb-2 opacity-50" />
                <span className="font-mono text-sm">
                  {loading ? 'SCANNING...' : 'NO EVENTS FOUND'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
