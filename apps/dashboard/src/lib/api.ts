/**
 * API client for core-api
 */

// In production (App Platform), all services share the same domain with path-based routing.
// Use empty string for relative paths, or NEXT_PUBLIC_API_URL for local development.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

export interface Incident {
  id: string
  org_id: string
  project_id: string
  environment: string
  fingerprint: string
  status: 'open' | 'investigating' | 'resolved'
  severity: 'warn' | 'error' | 'critical'
  title: string
  opened_at: string
  last_seen_at: string
  resolved_at: string | null
}

export interface IncidentEvent {
  id: number
  event_id: string
  occurred_at: string
  event_type: string
  severity: string
  attributes: Record<string, unknown>
}

export interface AISummary {
  title: string
  impact: string
  likely_causes: string[]
  evidence: string[]
  next_steps: string[]
  confidence: number
  model: string
  generated_at: string
}

export interface IncidentDetail {
  incident: Incident
  events: IncidentEvent[]
  ai_summary: AISummary | null
}

export interface SearchEvent {
  id: string
  event_id: string
  org_id: string
  project_id: string
  environment: string
  event_type: string
  severity: string
  occurred_at: string
  received_at: string
  message: string
  attributes: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

export async function fetchIncidents(params?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<{ incidents: Incident[] } & PaginatedResponse<Incident>> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.offset) searchParams.set('offset', String(params.offset))

  const res = await fetch(`${API_BASE}/v1/incidents?${searchParams}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch incidents')
  return res.json()
}

export async function fetchIncident(id: string): Promise<IncidentDetail> {
  const res = await fetch(`${API_BASE}/v1/incidents/${id}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch incident')
  return res.json()
}

export async function searchEvents(params: {
  q?: string
  project_id?: string
  environment?: string
  event_type?: string
  limit?: number
  offset?: number
}): Promise<{ events: SearchEvent[] } & PaginatedResponse<SearchEvent>> {
  const searchParams = new URLSearchParams()
  if (params.q) searchParams.set('q', params.q)
  if (params.project_id) searchParams.set('project_id', params.project_id)
  if (params.environment) searchParams.set('environment', params.environment)
  if (params.event_type) searchParams.set('event_type', params.event_type)
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.offset) searchParams.set('offset', String(params.offset))

  const res = await fetch(`${API_BASE}/v1/search/events?${searchParams}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to search events')
  return res.json()
}

// AI Types
export interface AIStats {
  total_summaries: number
  summaries_last_24h: number
  success_rate: number
  avg_confidence: number | null
  jobs_by_status: Record<string, number>
  models_used: Array<{ model: string; count: number }>
}

export interface AIActivity {
  id: string
  incident_id: string
  incident_title: string
  incident_severity: string
  output_type: string
  model: string
  confidence: number
  title: string
  created_at: string
}

export interface AIJob {
  id: string
  incident_id: string
  incident_title: string
  job_type: string
  status: string
  attempt_count: number
  max_attempts: number
  run_after: string
  leased_until: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export async function fetchAIStats(): Promise<AIStats> {
  const res = await fetch(`${API_BASE}/v1/ai/stats`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch AI stats')
  return res.json()
}

export async function fetchAIActivity(limit = 20): Promise<{ activity: AIActivity[] }> {
  const res = await fetch(`${API_BASE}/v1/ai/activity?limit=${limit}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch AI activity')
  return res.json()
}

export async function fetchAIJobs(params?: {
  status?: string
  limit?: number
}): Promise<{ jobs: AIJob[] }> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.limit) searchParams.set('limit', String(params.limit))

  const res = await fetch(`${API_BASE}/v1/ai/jobs?${searchParams}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch AI jobs')
  return res.json()
}

// Metrics Types
export interface OverviewStats {
  incidents: {
    total: number
    open: number
    investigating: number
    resolved_last_24h: number
  }
  errors: {
    total_last_24h: number
    rate_per_minute: number
  }
  signups: {
    total_last_24h: number
    rate_per_hour: number
  }
  ai: {
    total_summaries: number
    success_rate: number
    pending_jobs: number
  }
}

export interface TrendDataPoint {
  timestamp: string
  value: number
}

export interface TrendsResponse {
  metric: 'errors' | 'signups'
  period: '1h' | '24h' | '7d'
  data: TrendDataPoint[]
  summary: {
    total: number
    average: number
    max: number
    min: number
  }
}

export async function fetchOverviewStats(): Promise<OverviewStats> {
  const res = await fetch(`${API_BASE}/v1/metrics/overview`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch overview stats')
  return res.json()
}

export async function fetchTrends(
  metric: 'errors' | 'signups' = 'errors',
  period: '1h' | '24h' | '7d' = '24h'
): Promise<TrendsResponse> {
  const res = await fetch(
    `${API_BASE}/v1/metrics/trends?metric=${metric}&period=${period}`,
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error('Failed to fetch trends')
  return res.json()
}
