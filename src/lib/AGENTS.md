<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-20 -->

# lib

## Purpose
Pure utility functions with no React or simulation dependencies. Contains the core Dijkstra ECMP algorithm and a className merging helper.

## Key Files

| File | Description |
|------|-------------|
| `dijkstra.ts` | Dijkstra's shortest path algorithm with ECMP support — computes routing tables with multiple equal-cost next hops |
| `utils.ts` | `cn()` helper combining `clsx` and `tailwind-merge` for conditional Tailwind class merging |

## For AI Agents

### Working In This Directory
- `dijkstra.ts` exports `TopologyMap` type (`Record<string, Record<string, number>>`) and `RoutingEntry` interface
- The ECMP backtracking in `computeDijkstraECMP()` uses BFS from each destination to find all next hops — this is the critical path; changes require careful verification of equal-cost multi-path correctness
- `cn()` is the standard utility used across all components for className conditions

### Testing Requirements
- Dijkstra correctness: verify ECMP preserves multiple next hops when costs are equal
- Verify edge cases: disconnected nodes (Infinity), single-node graphs, the source node itself

### Common Patterns
- Pure functions with no side effects
- TypeScript types exported alongside functions
- No React imports or hooks

## Dependencies

### External
- `clsx` — conditional className construction
- `tailwind-merge` — resolves Tailwind class conflicts

<!-- MANUAL: -->