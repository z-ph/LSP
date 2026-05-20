<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-20 -->

# components

## Purpose
React UI components for the simulator's visual layer. Contains the SVG-based network graph renderer, a custom right-click context menu system, and the help/instructions modal.

## Key Files

| File | Description |
|------|-------------|
| `NetworkGraph.tsx` | SVG-based interactive network graph with pan/zoom, node dragging, box selection, link visualization, and animated packet rendering |
| `ContextMenu.tsx` | Custom right-click context menu with viewport-aware positioning, plus builder functions for node/background/link menus |
| `HelpModal.tsx` | Modal dialog displaying usage instructions in the current language |

## For AI Agents

### Working In This Directory
- `NetworkGraph.tsx` uses raw SVG rendering with manual pan/zoom transforms — not D3
- Pointer events are used throughout for drag, pan, box-select, and context menu detection
- Context menu items are typed via `MenuItemType` union — add new action types there first
- All components receive data via props; none import simulation logic directly

### Testing Requirements
- Right-click behavior must not interfere with left-click interactions
- Visual regression: pan (Ctrl+drag), zoom (Ctrl+wheel), node drag, box select, and Escape to close context menu

### Common Patterns
- `lucide-react` icon components for all iconography
- Arrow function components with TypeScript return types inferred

## Dependencies

### Internal
- `src/i18n/` — `useLanguage()` for translated strings in HelpModal and context menu builders
- `src/simulation/types.ts` — `PhysicalNode`, `PhysicalLink`, `Packet` types
- `src/lib/utils.ts` — `cn()` helper

### External
Inherited from root `AGENTS.md`.

<!-- MANUAL: -->