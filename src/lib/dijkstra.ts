/**
 * Node structure for Dijkstra
 */
export type TopologyMap = Record<string, Record<string, number>>;

export interface RoutingEntry {
  destination: string;
  cost: number;
  nextHops: string[];
}

/**
 * Computes shortest paths using Dijkstra's algorithm with ECMP (Equal-Cost Multi-Path) support.
 * @param source The starting node
 * @param topology A map representing the graph adjacency list with costs
 * @returns Array of routing entries for each reachable destination
 */
export function computeDijkstraECMP(source: string, topology: TopologyMap): RoutingEntry[] {
  const dist: Record<string, number> = {};
  const preds: Record<string, string[]> = {};
  const unvisited = new Set<string>();

  // Initialize nodes
  for (const node in topology) {
    dist[node] = Infinity;
    preds[node] = [];
    unvisited.add(node);
  }
  
  if (!unvisited.has(source)) return [];

  dist[source] = 0;

  while (unvisited.size > 0) {
    // Find node with minimum distance
    let u: string | null = null;
    let minDist = Infinity;
    for (const node of unvisited) {
      if (dist[node] < minDist) {
        minDist = dist[node];
        u = node;
      }
    }

    if (u === null || minDist === Infinity) break;

    unvisited.delete(u);

    // Relax neighbors
    const neighbors = topology[u] || {};
    for (const v in neighbors) {
      const cost = neighbors[v];
      const alt = dist[u] + cost;

      if (alt < dist[v]) {
        dist[v] = alt;
        preds[v] = [u];
      } else if (alt === dist[v]) {
        // ECMP: add to predecessors if it's not already there
        if (!preds[v].includes(u)) {
          preds[v].push(u);
        }
      }
    }
  }

  // Build routing table with next hops
  const table: RoutingEntry[] = [];
  
  for (const dest in dist) {
    if (dest === source || dist[dest] === Infinity) continue;

    // Backtrack from destination to find the next hops connected to the source
    const nextHops = new Set<string>();
    const queue = [dest];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);

      const currPreds = preds[curr] || [];
      for (const p of currPreds) {
        if (p === source) {
          nextHops.add(curr); // This current node is directly connected to the source on the shortest path
        } else {
          queue.push(p);
        }
      }
    }

    table.push({
      destination: dest,
      cost: dist[dest],
      nextHops: Array.from(nextHops).sort()
    });
  }

  return table.sort((a, b) => a.destination.localeCompare(b.destination));
}
