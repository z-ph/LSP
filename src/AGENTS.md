<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-20 -->

# src

## Purpose
Application source code for the Link State Routing Simulator. Contains the main React entry point, global styles, and all feature modules organized into subdirectories.

## Key Files

| File | Description |
|------|-------------|
| `main.tsx` | React entry point — renders `<App />` inside `<StrictMode>` and `<LanguageProvider>` |
| `App.tsx` | Root component orchestrating the entire simulation UI: network graph, sidebar, controls, and state management |
| `index.css` | Global styles — imports Tailwind CSS 4 via `@import "tailwindcss"` |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `components/` | React UI components for the graph, context menus, and help modal |
| `i18n/` | Internationalization (English / Chinese) via React context |
| `lib/` | Pure utility functions — Dijkstra algorithm and className helper |
| `simulation/` | Network simulation engine — types, state management, and packet flooding |

## For AI Agents

### Working In This Directory
- `main.tsx` sets up providers — wrap new global providers here as needed
- `App.tsx` is the central orchestration point; it owns all top-level state and event handlers
- New top-level features should be added as new subdirectories, not dumped here
- All cross-module imports within `src/` must use relative paths (e.g., `../lib/dijkstra`); the `@/*` alias is reserved for config files

### Common Patterns
- Dependency direction: `lib/` → `simulation/` → `components/`; never import `components/` from `lib/` or `simulation/`
- `i18n/` has no internal dependencies and is consumed by `components/` and `App.tsx`

### External Dependencies
Inherited from root `AGENTS.md`.

<!-- MANUAL: -->