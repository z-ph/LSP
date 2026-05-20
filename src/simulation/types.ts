import { RoutingEntry } from "../lib/dijkstra";

export type NodeId = string;

export interface PhysicalNode {
  id: NodeId;
  label: string;
  x: number;
  y: number;
  autoLspEnabled?: boolean;
  autoLspInterval?: number;
}

export interface PhysicalLink {
  id: string; // source_target
  source: NodeId;
  target: NodeId;
  cost: number;
  up: boolean;
}

export interface LSP {
  originator: NodeId;
  sequence: number;
  neighbors: Record<NodeId, number>; // neighbor_id -> cost
  timestamp: number;
}

// Each node's internal state
export interface NodeState {
  id: NodeId;
  lsdb: Record<NodeId, LSP>; // Latest LSPs received and their generation sequence
  routingTable: RoutingEntry[];
  seqCounter: number; // For generating new LSPs
  lastAutoLspTime?: number;
}

export interface Packet {
  id: string; // unique
  type: 'lsp' | 'data';
  from: NodeId;
  to: NodeId;
  sourceNode?: NodeId; // original data source
  destNode?: NodeId; // final data destination
  payload?: any; // LSP
  progress: number; // 0.0 to 1.0
  totalTransitTime: number; // based on current delay + link cost
  failed: boolean; // if randomly dropped
}

export interface SimulationConfig {
  baseDelayMs: number;
  packetLossRatio: number; // 0.0 to 1.0
  autoTriggerLspOnLinkChange?: boolean;
}
