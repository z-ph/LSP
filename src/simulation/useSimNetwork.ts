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
        type: 'lsp',
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
    
    // First pass: add all node references from LSDB
    for (const orig in ns.lsdb) {
      if (!topology[orig]) topology[orig] = {};
      const lsp = ns.lsdb[orig];
      for (const neighbor in lsp.neighbors) {
         if (!topology[neighbor]) topology[neighbor] = {};
         topology[orig][neighbor] = lsp.neighbors[neighbor];
      }
    }

    // In real OSPF/IS-IS, a router always knows its own local interfaces and links,
    // even before it has generated or flooded its own LSP. Inject its own active links.
    if (!topology[nodeId]) topology[nodeId] = {};
    const activeLinks = sr.links.filter(l => l.up && (l.source === nodeId || l.target === nodeId));
    activeLinks.forEach(link => {
       const neighborId = link.source === nodeId ? link.target : link.source;
       topology[nodeId][neighborId] = link.cost;
       if (!topology[neighborId]) topology[neighborId] = {}; 
    });
    
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
               // Arrived!
               if (p.type === 'data') {
                 if (p.to !== p.destNode) {
                    // Forward it
                    const receiverState = sr.nodeStates[p.to];
                    if (receiverState && p.destNode) {
                       const route = receiverState.routingTable.find(r => r.destination === p.destNode);
                       if (route && route.nextHops.length > 0) {
                          const nextHop = route.nextHops[Math.floor(Math.random() * route.nextHops.length)];
                          const isLost = Math.random() < sr.config.packetLossRatio;
                          
                          newPackets.push({
                            ...p,
                            id: Math.random().toString(36).substring(2, 11),
                            from: p.to,
                            to: nextHop,
                            progress: 0,
                            totalTransitTime: Math.max(100, sr.config.baseDelayMs) + (Math.random() * 100),
                            failed: isLost
                          });
                       }
                    }
                 }
               } else {
                 // Processing LSP
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
    if (link) {
        recalculateRouting(link.source);
        recalculateRouting(link.target);
        
        if (stateRef.current.config.autoTriggerLspOnLinkChange && link.up) {
          triggerLSP(link.source);
          triggerLSP(link.target);
        } else {
          // ensure UI updates
          setNodeStatesMirror({...stateRef.current.nodeStates});
        }
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
    if (affectedLink) {
        recalculateRouting(affectedLink.source);
        recalculateRouting(affectedLink.target);
        
        if (stateRef.current.config.autoTriggerLspOnLinkChange) {
           triggerLSP(affectedLink.source);
           triggerLSP(affectedLink.target);
        } else {
           setNodeStatesMirror({...stateRef.current.nodeStates});
        }
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
  
  const removeNode = useCallback((nodeId: string) => {
    const sr = stateRef.current;
    
    // Remove links connected to this node
    const linksToRemove = sr.links.filter(l => l.source === nodeId || l.target === nodeId);
    sr.links = sr.links.filter(l => l.source !== nodeId && l.target !== nodeId);
    setLinks([...sr.links]);

    // Remove node
    sr.nodes = sr.nodes.filter(n => n.id !== nodeId);
    setNodes([...sr.nodes]);
    
    // Remove state
    delete sr.nodeStates[nodeId];
    setNodeStatesMirror({...sr.nodeStates});

    // Affected peers (were connected to the deleted node)
    const affectedNodeIds = new Set<string>();
    linksToRemove.forEach(l => {
      if (l.source !== nodeId) affectedNodeIds.add(l.source);
      if (l.target !== nodeId) affectedNodeIds.add(l.target);
    });

    // Notify neighbors explicitly and recalculate their routing
    affectedNodeIds.forEach(id => {
       recalculateRouting(id);
       if (sr.config.autoTriggerLspOnLinkChange) {
         triggerLSP(id);
       }
    });
  }, []);

  const removeLink = useCallback((linkId: string) => {
    const sr = stateRef.current;
    const link = sr.links.find(l => l.id === linkId);
    if (!link) return;

    sr.links = sr.links.filter(l => l.id !== linkId);
    setLinks([...sr.links]);

    recalculateRouting(link.source);
    recalculateRouting(link.target);

    if (sr.config.autoTriggerLspOnLinkChange) {
       triggerLSP(link.source);
       triggerLSP(link.target);
    } else {
       setNodeStatesMirror({...sr.nodeStates});
    }
  }, []);

  const addLink = (source: NodeId, target: NodeId, cost: number) => {
    const sr = stateRef.current;
    if (sr.links.find(l => (l.source === source && l.target === target) || (l.source === target && l.target === source))) {
        return;
    }
    const id = `${source}_${target}_${Date.now()}`;
    const newLink = { id, source, target, cost, up: true };
    sr.links = [...sr.links, newLink];
    setLinks(sr.links);
    
    recalculateRouting(source);
    recalculateRouting(target);
    
    if (sr.config.autoTriggerLspOnLinkChange) {
      triggerLSP(source);
      triggerLSP(target);
    } else {
      setNodeStatesMirror({...stateRef.current.nodeStates});
    }
  };
  
  const initTopology = (initialNodes: PhysicalNode[], initialLinks: PhysicalLink[], autoTriggerLsp: boolean = false) => {
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
      
      // Compute initial routing tables based on active local links
      initialNodes.forEach(n => {
          recalculateRouting(n.id);
      });
      
      setNodeStatesMirror({...stateRef.current.nodeStates});
      
      // Let nodes generate initial LSPs
      if (autoTriggerLsp) {
        setTimeout(() => {
            initialNodes.forEach(n => triggerLSP(n.id));
        }, 100);
      }
  };

  const clearRoutingTable = useCallback((nodeIds?: string[]) => {
    const sr = stateRef.current;
    const targetIds = nodeIds && nodeIds.length > 0 ? nodeIds : sr.nodes.map(n => n.id);
    targetIds.forEach(id => {
      const ns = sr.nodeStates[id];
      if (ns) {
        ns.lsdb = {};
        recalculateRouting(id);
      }
    });
    setNodeStatesMirror({...sr.nodeStates});
    setConvergenceStats(prev => ({...prev, isConverged: false}));
  }, []);

  const sendDataPacket = useCallback((sourceNodeId: NodeId, destNodeId: NodeId) => {
    const sr = stateRef.current;
    const ns = sr.nodeStates[sourceNodeId];
    if (!ns || sourceNodeId === destNodeId) return;

    // Look up routing table for next hop
    const route = ns.routingTable.find(r => r.destination === destNodeId);
    if (!route || route.nextHops.length === 0) {
      console.log(`No route from ${sourceNodeId} to ${destNodeId}`);
      return; // No route, cannot send
    }

    // Pick a next hop (ECMP randomly)
    const nextHop = route.nextHops[Math.floor(Math.random() * route.nextHops.length)];
    const maxDelay = Math.max(100, sr.config.baseDelayMs);
    const isLost = Math.random() < sr.config.packetLossRatio;
    
    const packet: Packet = {
      id: "data_" + Math.random().toString(36).substring(2, 11),
      type: 'data',
      from: sourceNodeId,
      to: nextHop,
      sourceNode: sourceNodeId,
      destNode: destNodeId,
      progress: 0,
      totalTransitTime: maxDelay + (Math.random() * 100),
      failed: isLost
    };
    
    sr.packets.push(packet);
    setPackets([...sr.packets]);
  }, []);

  const updateNode = useCallback((id: string, updates: Partial<Omit<PhysicalNode, "id">>) => {
    const newNodes = stateRef.current.nodes.map(n => n.id === id ? { ...n, ...updates } : n);
    stateRef.current.nodes = newNodes;
    setNodes(newNodes);
  }, []);

  const updateNodes = useCallback((updates: {id: string, update: Partial<Omit<PhysicalNode, "id">>}[] ) => {
    let newNodes = stateRef.current.nodes;
    updates.forEach(({id, update}) => {
      newNodes = newNodes.map(n => n.id === id ? { ...n, ...update } : n);
    });
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
    updateNodes,
    addNode,
    removeNode,
    addLink,
    removeLink,
    initTopology,
    triggerLSP,
    clearRoutingTable,
    sendDataPacket
  };
}
