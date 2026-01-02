# Sentinel Dashboard - Design Document

**Status**: COMPLETE
**Last Updated**: 2026-01-01

---

## Product Identity

| Attribute | Value |
|-----------|-------|
| **Product Name** | Sentinel |
| **Tagline** | AI-Powered Incident Detection & Monitoring |
| **Target Users** | DevOps, SRE, Engineering Teams |

---

## Design Decisions

### Layout: Sidebar + Content
- **Choice**: Modern sidebar navigation (like Vercel, Linear, Datadog)
- **Rationale**: Better navigation hierarchy, more screen real estate for data
- **Alternative Rejected**: Top navigation (current) - feels dated, wastes vertical space

### UI Library: shadcn/ui
- **Choice**: shadcn/ui with Radix primitives
- **Rationale**:
  - Beautiful, accessible components
  - Works seamlessly with Tailwind CSS (already in use)
  - Copy-paste model = full control, no version lock-in
  - Very popular in Next.js ecosystem
- **Alternative Rejected**: Tremor (too opinionated), pure Tailwind (too much work)

### Charts: Recharts
- **Choice**: Recharts for time-series visualization
- **Rationale**:
  - React-native, composable API
  - Good performance with time-series data
  - Supports responsive containers
  - 100KB gzipped - acceptable for dashboard
- **Alternative Rejected**: Chart.js (not React-native), D3 (overkill)

### Theme: Dark Mode Support
- **Choice**: next-themes with CSS variable system
- **Rationale**:
  - System preference detection
  - No flash on load (SSR compatible)
  - Works with shadcn/ui color system
- **Implementation**: `class` strategy with HSL CSS variables

---

## Information Architecture

### Navigation Structure
```
Sentinel
├── Overview (/)           <- NEW: Dashboard home
├── Incidents (/incidents)
│   └── Detail (/incidents/[id])
├── Search (/search)
└── AI Insights (/ai)
```

### Overview Dashboard Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  [Sidebar]  │                    Content                         │
│             │  ┌─────────┬─────────┬─────────┬─────────┐         │
│  Overview   │  │ Total   │ Error   │ Signups │ AI      │         │
│  Incidents  │  │ Incidents│ Rate   │ 24h     │ Success │         │
│  Search     │  └─────────┴─────────┴─────────┴─────────┘         │
│  AI         │                                                    │
│             │  ┌─────────────────────┬─────────────────────┐     │
│  ─────────  │  │   Error Trend (24h) │  Signup Trend (24h) │     │
│  [Theme]    │  │   [Area Chart]      │  [Area Chart]       │     │
│             │  └─────────────────────┴─────────────────────┘     │
│             │                                                    │
│             │  ┌─────────────────────┬─────────────────────┐     │
│             │  │  Recent Incidents   │   System Health     │     │
│             │  │  - Incident 1       │   API: OK           │     │
│             │  │  - Incident 2       │   DB: OK            │     │
│             │  └─────────────────────┴─────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Color System

### Light Theme
| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--background` | 0 0% 100% | Page background |
| `--foreground` | 222.2 84% 4.9% | Primary text |
| `--primary` | 221.2 83.2% 53.3% | Primary actions (blue) |
| `--destructive` | 0 84.2% 60.2% | Errors, critical severity |
| `--muted` | 210 40% 96.1% | Secondary backgrounds |

### Dark Theme
| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--background` | 222.2 84% 4.9% | Page background |
| `--foreground` | 210 40% 98% | Primary text |
| `--primary` | 217.2 91.2% 59.8% | Primary actions |
| `--muted` | 217.2 32.6% 17.5% | Secondary backgrounds |

### Chart Colors
- `--chart-1`: Blue (errors)
- `--chart-2`: Green (signups)
- `--chart-3`: Orange (warnings)
- `--chart-4`: Purple (AI)
- `--chart-5`: Pink (accent)

---

## Component Architecture

### UI Components (shadcn/ui)
```
src/components/ui/
├── button.tsx      # Variants: default, outline, ghost, destructive
├── card.tsx        # Card, CardHeader, CardTitle, CardContent
├── badge.tsx       # Severity/status indicators
├── skeleton.tsx    # Loading states
├── table.tsx       # Data tables
├── input.tsx       # Form inputs
├── separator.tsx   # Visual dividers
├── dropdown-menu.tsx
├── tooltip.tsx
└── scroll-area.tsx
```

### Layout Components
```
src/components/layout/
├── sidebar.tsx       # Fixed 256px sidebar
└── theme-toggle.tsx  # Light/Dark/System toggle
```

### Dashboard Components
```
src/components/dashboard/
├── overview-stats.tsx    # 4-card metrics grid
├── error-chart.tsx       # Error trend area chart
├── signup-chart.tsx      # Signup trend area chart
├── recent-incidents.tsx  # Recent incidents list
└── system-health.tsx     # Service status indicators
```

---

## Data Requirements

### New API Endpoints Needed

**GET /v1/metrics/overview**
```typescript
interface OverviewResponse {
  incidents: {
    total: number;
    open: number;
    investigating: number;
    resolved_last_24h: number;
  };
  errors: {
    total_last_24h: number;
    rate_per_minute: number;
  };
  signups: {
    total_last_24h: number;
    rate_per_hour: number;
  };
  ai: {
    total_summaries: number;
    success_rate: number;
    pending_jobs: number;
  };
}
```

**GET /v1/metrics/trends**
```typescript
interface TrendsResponse {
  metric: 'errors' | 'signups';
  period: '1h' | '24h' | '7d';
  data: Array<{
    timestamp: string;  // ISO 8601
    value: number;
  }>;
  summary: {
    total: number;
    average: number;
    max: number;
    min: number;
  };
}
```

---

## Responsive Design

| Breakpoint | Sidebar | Layout |
|------------|---------|--------|
| < 768px | Hidden (hamburger) | Single column |
| 768px - 1024px | Collapsed (icons only) | Two column |
| > 1024px | Full (256px) | Full layout |

---

## Accessibility

- All components from Radix UI (WCAG 2.1 AA compliant)
- Keyboard navigation for sidebar
- Focus indicators on interactive elements
- Color contrast ratios meet WCAG guidelines
- Screen reader labels on icons

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-01 | Use shadcn/ui | Best balance of beauty, accessibility, and control |
| 2026-01-01 | Sidebar layout | Modern, better use of screen space |
| 2026-01-01 | Recharts for charts | React-native, good time-series support |
| 2026-01-01 | next-themes for dark mode | SSR-safe, system preference support |
| 2026-01-01 | Name: Sentinel | Conveys watchful, protective monitoring |
