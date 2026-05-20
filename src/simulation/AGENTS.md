<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-20 -->

# simulation

## Purpose
Network simulation engine implementing the Link State Routing protocol. Manages physical topology (nodes/links), LSP flooding, Dijkstra-based route computation, packet animation, and automatic convergence detection.

## Key Files

| File | Description |
|------|-------------|
| `types.ts` | Type definitions: `PhysicalNode`, `PhysicalLink`, `LSP`, `NodeState`, `Packet`, `SimulationConfig` |
| `useSimNetwork.ts` | React hook containing the entire simulation engine — topology CRUD, LSP flooding, routing recalculation, packet animation loop, and convergence tracking |

## For AI Agents

### Working In This Directory
- `useSimNetwork.ts` is the largest file in the project. It uses `useRef` for simulation-critical state to avoid stale closures in the `requestAnimationFrame` loop
- The simulation loop runs continuously via `requestAnimationFrame` — be mindful of performance when adding per-tick logic
- LSP flooding uses a split-horizon optimization (`excludeNeighbor` parameter prevents sending LSPs back to the sender)
- Convergence is detected when all packets have been delivered and the queue is empty
- Auto-trigger LSP is a per-node timer feature using `autoLspEnabled` / `autoLspInterval` on `PhysicalNode`

### State Architecture
- `stateRef` (mutable ref) holds authoritative simulation state: nodes, links, nodeStates, packets, config
- React state (`useState`) holds mirrored copies for triggering re-renders
- Direct mutations to `stateRef.current` are the primary pattern; `setState` calls follow to sync the UI

### Testing Requirements
- Verify routing table correctness after topology changes (add/remove node, link cost change, link failure)
- Verify ECMP: paths with equal total cost should preserve all next hops
- Verify convergence detection: time should stop counting when all packets arrive

### Common Patterns
- All topology mutations (add/remove/update) recalculate routing for affected nodes
- `autoTriggerLspOnLinkChange` config flag gates whether LSPs are auto-flooded on topology changes

## Dependencies

### Internal
- `src/lib/dijkstra.ts` — `computeDijkstraECMP()`, `RoutingEntry`, `TopologyMap`

### External
Inherited from root `AGENTS.md`.

<!-- MANUAL: -->