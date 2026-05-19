import { useCallback, useEffect, useRef, useState } from "react";
import { computeDijkstraECMP, RoutingEntry, TopologyMap } from "../lib/dijkstra";
import { LSP, NodeId, NodeState, Packet, PhysicalLink, PhysicalNode, SimulationConfig } from "./types";

export function useSimNetwork() {
  const [nodes, setNodes] = useState<PhysicalNode[]>([]);
  const [links, setLinks] = useState<PhysicalLink[]>([]);
  const [config, setConfig] = useState<SimulationConfig>({
    baseDelayMs: 1000,
    packetLossRatio: 0.05,
  });

  const [packets, setPackets] = useState<Packet[]>([]);
  
  // Using refs for simulation critical state to avoid dependency cycles in rAF
  const stateRef = useRef<{
    nodes: PhysicalNode[];
    links: PhysicalLink[];
    nodeStates: Record<NodeId, NodeState>;
    packets: Packet[];
    config: SimulationConfig;
    lastLspGenerateTime: number;
    convergenceStartTime: number | null;
    isConverged: boolean;
  }>({
    nodes: [],
    links: [],
    nodeStates: {},
    packets: [],
    config: { baseDelayMs: 1000, packetLossRatio: 0.05 },
    lastLspGenerateTime: 0,
    convergenceStartTime: null,
    isConverged: true,
  });

  const [nodeStatesMirror, setNodeStatesMirror] = useState<Record<NodeId, NodeState>>({});
  const [convergenceStats, setConvergenceStats] = useState({
    timeMs: 0,
    isConverged: true,
  });

  // Keep ref in sync
  useEffect(() => {
    stateRef.current.nodes = nodes;
    stateRef.current.links = links;
    stateRef.current.config = config;
  }, [nodes, links, config]);

  // Generate LSP for a specific node based on its physical links
  const triggerLSP = useCallback((nodeId: NodeId) => {
    const sr = stateRef.current;
    const nodeState = sr.nodeStates[nodeId];
    if (!nodeState) return;

    nodeState.seqCounter += 1;
    
    // Find all active links
    const activeLinks = sr.links.filter(l => l.up && (l.source === nodeId || l.target === nodeId));
    const neighborsMap: Record<NodeId, number> = {};
    
    for (const link of activeLinks) {
      const neighbor = link.source === nodeId ? link.target : link.source;
      neighborsMap[neighbor] = link.cost;
    }

    const lsp: LSP = {
      originator: nodeId,
      sequence: nodeState.seqCounter,
      neighbors: neighborsMap,
      timestamp: Date.now()
    };

    // Update node's own LSDB
    nodeState.lsdb[nodeId] = lsp;

    // Recalculate own routing table
    recalculateRouting(nodeId);

    // Flood to neighbors
    floodLSP(nodeId, nodeId, lsp);
    
    if (sr.isConverged) {
      sr.isConverged = false;
      sr.convergenceStartTime = Date.now();
      setConvergenceStats({ isConverged: false, timeMs: 0 });
    }
    
    // Update mirror (throttle might be good, but we just trigger)
    setNodeStatesMirror(prev => ({...prev, [nodeId]: { ...nodeState }}));
  }, []);

  const floodLSP = (sendFrom: NodeId, lspOriginator: NodeId, lsp: LSP, excludeNeighbor?: NodeId) => {
    const sr = stateRef.current;
    
    // Find physical neighbors where links are UP
    const activeLinks = sr.links.filter(l => l.up && (l.source === sendFrom || l.target === sendFrom));
    
    const maxDelay = Math.max(100, sr.config.baseDelayMs);

    activeLinks.forEach(link => {
      const neighbor = link.source === sendFrom ? link.target : link.source;
      
      // Flooding optimization: do not send back to the neighbor we just received this LSP from
      if (neighbor === excludeNeighbor) return;
      
      const isLost = Math.random() < sr.config.packetLossRatio;
      
      const packet: Packet = {
        id: Math.random().toString(36).substring(2, 11),
        from: sendFrom,
        to: neighbor,
        payload: lsp,
        progress: 0,
        totalTransitTime: maxDelay + (Math.random() * 200), // Some jitter
        failed: isLost
      };
      
      sr.packets.push(packet);
    });
    
    setPackets([...sr.packets]);
  };

  const recalculateRouting = (nodeId: NodeId) => {
    const sr = stateRef.current;
    const ns = sr.nodeStates[nodeId];
    if (!ns) return;

    // Reconstruct full topology map from LSDB
    const topology: TopologyMap = {};
    
    // First pass: add all node references
    for (const orig in ns.lsdb) {
      if (!topology[orig]) topology[orig] = {};
      const lsp = ns.lsdb[orig];
      for (const neighbor in lsp.neighbors) {
         if (!topology[neighbor]) topology[neighbor] = {};
         topology[orig][neighbor] = lsp.neighbors[neighbor];
      }
    }
    
    ns.routingTable = computeDijkstraECMP(nodeId, topology);
  };

  // Main Simulation Loop
  useEffect(() => {
    let lastTime = performance.now();
    let animationFrameId: number;

    const tick = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;
      const sr = stateRef.current;

        // Check auto LSPs
        const now = Date.now();
        for (const node of sr.nodes) {
          const interval = node.autoLspInterval || 5000;
          if (node.autoLspEnabled && interval > 0) {
             const ns = sr.nodeStates[node.id];
             if (ns && now - (ns.lastAutoLspTime || 0) > interval) {
                 ns.lastAutoLspTime = now;
                 // Can't call triggerLSP directly as it accesses stateRef, but we are in stateRef.
                 // Actually triggerLSP is a function defined above, it's fine. 
                 // Wait, calling triggerLSP(node.id) works.
                 triggerLSP(node.id);
             }
          }
        }

      if (sr.packets.length > 0 || !sr.isConverged) {
        let packetsChanged = false;
        let lsdbUpdated = false;

        const newPackets: Packet[] = [];
        
        for (const p of sr.packets) {
          packetsChanged = true; // Make sure we render the frame
          if (p.failed) {
            // Visualize packet loss by dropping them immediately? Or let them travel half way and disappear?
            // Let's drop them halfway
            p.progress += dt / p.totalTransitTime;
            if (p.progress >= 0.5) {
              continue; // Drop
            }
            newPackets.push(p);
          } else {
             p.progress += dt / p.totalTransitTime;
             if (p.progress >= 1.0) {
               // Arrived! Processing LSP
               const receiverState = sr.nodeStates[p.to];
               if (receiverState) {
                 const lsp = p.payload;
                 const existingLsp = receiverState.lsdb[lsp.originator];
                 
                 // If LSP is newer
                 if (!existingLsp || existingLsp.sequence < lsp.sequence) {
                   receiverState.lsdb[lsp.originator] = lsp;
                   recalculateRouting(p.to);
                   floodLSP(p.to, lsp.originator, lsp, p.from);
                   lsdbUpdated = true;
                 }
               }
             } else {
               newPackets.push(p);
             }
          }
        }
        
        sr.packets = newPackets;
        
        if (packetsChanged) {
          setPackets([...sr.packets]);
        }
        
        if (lsdbUpdated) {
          setNodeStatesMirror({ ...sr.nodeStates });
        }

        // Check for convergence
        if (!sr.isConverged && sr.packets.length === 0) {
          // Additional check: are all lsdb consistent?
          // To be perfectly converged, wait for packets to empty.
           sr.isConverged = true;
           const timeTaken = Date.now() - (sr.convergenceStartTime || Date.now());
           setConvergenceStats({ isConverged: true, timeMs: timeTaken});
        } else if (!sr.isConverged) {
            setConvergenceStats({ 
                isConverged: false, 
                timeMs: Date.now() - (sr.convergenceStartTime || Date.now())
            });
        }
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Update physical links means LSPs need to be re-triggered for affected nodes
  const updateLinkCost = (id: string, newCost: number) => {
    const newLinks = stateRef.current.links.map(l => l.id === id ? { ...l, cost: newCost } : l);
    stateRef.current.links = newLinks;
    setLinks(newLinks);
    const link = newLinks.find(l => l.id === id);
    if (stateRef.current.config.autoTriggerLspOnLinkChange && link && link.up) {
      triggerLSP(link.source);
      triggerLSP(link.target);
    }
  };

  const toggleLink = (id: string, forceStatus?: boolean) => {
    const newLinks = stateRef.current.links.map(l => {
      if (l.id === id) {
        return { ...l, up: forceStatus !== undefined ? forceStatus : !l.up };
      }
      return l;
    });
    stateRef.current.links = newLinks;
    setLinks(newLinks);
    
    const affectedLink = newLinks.find(l => l.id === id);
    if (stateRef.current.config.autoTriggerLspOnLinkChange && affectedLink) {
       triggerLSP(affectedLink.source);
       triggerLSP(affectedLink.target);
    }
  };

  // Add node and init state
  const addNode = (node: Omit<PhysicalNode, "id">) => {
    const id = Math.random().toString(36).substring(2, 11);
    const newNode = { ...node, id };
    
    stateRef.current.nodeStates[id] = {
      id,
      lsdb: {},
      routingTable: [],
      seqCounter: 0
    };
    
    stateRef.current.nodes = [...stateRef.current.nodes, newNode];
    setNodes(stateRef.current.nodes);
    setNodeStatesMirror(prev => ({...prev, [id]: stateRef.current.nodeStates[id]}));
    
    triggerLSP(id);
  };
  
  const addLink = (source: NodeId, target: NodeId, cost: number) => {
    const sr = stateRef.current;
    if (sr.links.find(l => (l.source === source && l.target === target) || (l.source === target && l.target === source))) {
        return;
    }
    const id = `${source}_${target}_${Date.now()}`;
    const newLink = { id, source, target, cost, up: true };
    sr.links = [...sr.links, newLink];
    setLinks(sr.links);
    
    if (sr.config.autoTriggerLspOnLinkChange) {
      triggerLSP(source);
      triggerLSP(target);
    }
  };
  
  const initTopology = (initialNodes: PhysicalNode[], initialLinks: PhysicalLink[]) => {
      // Setup node states first
      stateRef.current.nodeStates = {};
      stateRef.current.packets = [];
      setPackets([]);
      
      initialNodes.forEach(n => {
          stateRef.current.nodeStates[n.id] = {
              id: n.id,
              lsdb: {},
              routingTable: [],
              seqCounter: 0
          };
      });
      stateRef.current.nodes = initialNodes;
      stateRef.current.links = initialLinks;
      setNodes(initialNodes);
      setLinks(initialLinks);
      setNodeStatesMirror({...stateRef.current.nodeStates});
      
      // Let nodes generate initial LSPs
      setTimeout(() => {
          initialNodes.forEach(n => triggerLSP(n.id));
      }, 100);
  };

  const updateNode = useCallback((id: string, updates: Partial<Omit<PhysicalNode, "id">>) => {
    const newNodes = stateRef.current.nodes.map(n => n.id === id ? { ...n, ...updates } : n);
    stateRef.current.nodes = newNodes;
    setNodes(newNodes);
  }, []);

  const updateNodePosition = useCallback((id: string, x: number, y: number) => {
    updateNode(id, { x, y });
  }, [updateNode]);

  return {
    nodes,
    links,
    config,
    setConfig,
    packets,
    nodeStates: nodeStatesMirror,
    convergenceStats,
    updateLinkCost,
    toggleLink,
    updateNodePosition,
    updateNode,
    addNode,
    addLink,
    initTopology,
    triggerLSP
  };
}
