'use client'

import { useState } from 'react'
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
import { Search } from 'lucide-react'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState<SearchEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setHasSearched(true)

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Event Search</h1>
        <p className="text-muted-foreground">
          Search through all indexed events in OpenSearch.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch}>
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events by message..."
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-destructive">{error}</p>
          <p className="text-sm text-destructive/80 mt-1">
            Make sure core-api is running on port 3001
          </p>
        </div>
      )}

      {/* Results */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              Found {total.toLocaleString()} events matching your query
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                    <TableCell className="max-w-md truncate">
                      {event.message}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.environment}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && hasSearched && events.length === 0 && !error && (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            No events found for &quot;{query}&quot;
          </CardContent>
        </Card>
      )}

      {/* Initial State */}
      {!hasSearched && (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
            Enter a search term to find events
          </CardContent>
        </Card>
      )}
    </div>
  )
}
