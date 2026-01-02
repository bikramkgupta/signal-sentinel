# Stage 2: Sentinel Dashboard - Coding Plan

**Status**: COMPLETE
**Last Updated**: 2026-01-01

---

## Overview

This document tracks the implementation of the Sentinel dashboard transformation.

---

## Dependencies to Install

```bash
cd apps/dashboard

# shadcn/ui foundation
npm install tailwindcss-animate class-variance-authority clsx tailwind-merge

# Radix UI primitives
npm install @radix-ui/react-slot @radix-ui/react-separator @radix-ui/react-dropdown-menu

# Theme support
npm install next-themes

# Icons
npm install lucide-react

# Charts
npm install recharts
```

---

## Implementation Phases

### Phase 1: Foundation
| Task | File | Status |
|------|------|--------|
| Create cn() utility | `src/lib/utils.ts` | [x] |
| Update Tailwind config | `tailwind.config.js` | [x] |
| Update globals.css | `src/app/globals.css` | [x] |
| Create ThemeProvider | `src/components/theme-provider.tsx` | [x] |
| Update root layout | `src/app/layout.tsx` | [x] |

### Phase 2: UI Components
| Component | File | Status |
|-----------|------|--------|
| Button | `src/components/ui/button.tsx` | [x] |
| Card | `src/components/ui/card.tsx` | [x] |
| Badge | `src/components/ui/badge.tsx` | [x] |
| Skeleton | `src/components/ui/skeleton.tsx` | [x] |
| Table | `src/components/ui/table.tsx` | [x] |
| Input | `src/components/ui/input.tsx` | [x] |
| Separator | `src/components/ui/separator.tsx` | [x] |
| Dropdown Menu | `src/components/ui/dropdown-menu.tsx` | [x] |
| Tooltip | `src/components/ui/tooltip.tsx` | [ ] (not needed) |
| Scroll Area | `src/components/ui/scroll-area.tsx` | [ ] (not needed) |

### Phase 3: Layout Components
| Component | File | Status |
|-----------|------|--------|
| Sidebar | `src/components/layout/sidebar.tsx` | [x] |
| Theme Toggle | `src/components/layout/theme-toggle.tsx` | [x] |
| Dashboard Layout | `src/app/(dashboard)/layout.tsx` | [x] |

### Phase 4: Backend API
| Task | File | Status |
|------|------|--------|
| Create metrics routes | `services/core-api/src/routes/metrics.ts` | [x] |
| Register routes | `services/core-api/src/server.ts` | [x] |
| Update API client | `apps/dashboard/src/lib/api.ts` | [x] |

### Phase 5: Dashboard Components
| Component | File | Status |
|-----------|------|--------|
| Overview Stats | `src/components/dashboard/overview-stats.tsx` | [x] |
| Error Chart | `src/components/dashboard/error-chart.tsx` | [x] |
| Signup Chart | `src/components/dashboard/signup-chart.tsx` | [x] |
| Recent Incidents | `src/components/dashboard/recent-incidents.tsx` | [x] |
| System Health | `src/components/dashboard/system-health.tsx` | [x] |

### Phase 6: Pages
| Page | File | Status |
|------|------|--------|
| Overview (new) | `src/app/(dashboard)/page.tsx` | [x] |
| Incidents list | `src/app/(dashboard)/incidents/page.tsx` | [x] |
| Incident detail | `src/app/(dashboard)/incidents/[id]/page.tsx` | [x] |
| Search | `src/app/(dashboard)/search/page.tsx` | [x] |
| AI | `src/app/(dashboard)/ai/page.tsx` | [x] |

---

## Build Order

1. [x] Install all dependencies
2. [x] Create `lib/utils.ts` with cn() function
3. [x] Update `tailwind.config.js` with dark mode + animate plugin
4. [x] Update `globals.css` with CSS variables
5. [x] Create `theme-provider.tsx`
6. [x] Update root `layout.tsx` with ThemeProvider + "Sentinel" branding
7. [x] Create UI components (button, card, badge, table, skeleton)
8. [x] Create sidebar component
9. [x] Create theme toggle component
10. [x] Create dashboard layout with route group
11. [x] Add backend metrics endpoints
12. [x] Update dashboard API client
13. [x] Create chart components
14. [x] Create overview stats component
15. [x] Create overview page
16. [x] Migrate and enhance incidents page
17. [x] Migrate and enhance incident detail page
18. [x] Migrate and enhance search page
19. [x] Migrate and enhance AI page
20. [ ] Test dark mode across all pages (TESTING PHASE)

---

## File Paths Reference

### Dashboard (apps/dashboard/)
```
src/
├── app/
│   ├── layout.tsx                    # Root layout - MODIFIED
│   ├── globals.css                   # Styles - MODIFIED
│   └── (dashboard)/                  # Route group - CREATED
│       ├── layout.tsx                # Dashboard layout
│       ├── page.tsx                  # Overview page
│       ├── incidents/
│       │   ├── page.tsx              # Incidents list
│       │   └── [id]/
│       │       └── page.tsx          # Incident detail
│       ├── search/
│       │   └── page.tsx              # Search page
│       └── ai/
│           └── page.tsx              # AI page
├── components/
│   ├── ui/                           # CREATED (8 components)
│   ├── layout/                       # CREATED (2 components)
│   ├── dashboard/                    # CREATED (5 components)
│   └── theme-provider.tsx            # CREATED
└── lib/
    ├── api.ts                        # MODIFIED
    └── utils.ts                      # CREATED
```

### Core API (services/core-api/)
```
src/
├── routes/
│   └── metrics.ts                    # CREATED
└── server.ts                         # MODIFIED
```

---

## Progress Log

| Date | Phase | Tasks Completed | Notes |
|------|-------|-----------------|-------|
| 2026-01-01 | 1-6 | All phases complete | Coding phase finished |

---

## Blockers & Issues

| Issue | Impact | Resolution |
|-------|--------|------------|
| None | - | - |
