import React, { useRef, useState, useEffect } from 'react';
import { PhysicalLink, PhysicalNode, Packet } from '../simulation/types';
import { cn } from '../lib/utils';

interface NetworkGraphProps {
  nodes: PhysicalNode[];
  links: PhysicalLink[];
  packets: Packet[];
  onNodeMove: (id: string, x: number, y: number) => void;
  onNodeClick: (id: string, multi?: boolean) => void;
  onLinkClick: (id: string) => void;
  selectedNodeIds: string[];
  selectedLinkId?: string;
  onSelectionBox?: (nodeIds: string[]) => void;
}

export function NetworkGraph({
  nodes,
  links,
  packets,
  onNodeMove,
  onNodeClick,
  onLinkClick,
  selectedNodeIds,
  selectedLinkId,
  onSelectionBox
}: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Simple drag implementation for nodes
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  
  // Box selection implementation
  const [selectionBox, setSelectionBox] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      const CTM = svg.getScreenCTM();
      if (!CTM) return;
      
      const mouseX = (e.clientX - CTM.e) / CTM.a;
      const mouseY = (e.clientY - CTM.f) / CTM.d;

      setTransform(prev => {
        const zoomSensitivity = 0.005;
        const delta = -e.deltaY * zoomSensitivity;
        let newK = prev.k * Math.exp(delta);
        newK = Math.max(0.1, Math.min(newK, 10));

        const gX = (mouseX - prev.x) / prev.k;
        const gY = (mouseY - prev.y) / prev.k;

        return {
          x: mouseX - gX * newK,
          y: mouseY - gY * newK,
          k: newK
        };
      });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      svg.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setDraggedNode(id);
    onNodeClick(id, e.ctrlKey || e.metaKey);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.target !== svgRef.current) return;
    
    if (e.ctrlKey || e.metaKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;
    const CTM = svg.getScreenCTM();
    if (!CTM) return;
    const x = (e.clientX - CTM.e) / CTM.a;
    const y = (e.clientY - CTM.f) / CTM.d;
    const gX = (x - transform.x) / transform.k;
    const gY = (y - transform.y) / transform.k;
    setSelectionBox({ x1: gX, y1: gY, x2: gX, y2: gY });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: prev.x + (e.clientX - panStart.x),
        y: prev.y + (e.clientY - panStart.y),
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;
    const CTM = svg.getScreenCTM();
    if (!CTM) return;
    const x = (e.clientX - CTM.e) / CTM.a;
    const y = (e.clientY - CTM.f) / CTM.d;
    const gX = (x - transform.x) / transform.k;
    const gY = (y - transform.y) / transform.k;

    if (draggedNode) {
      onNodeMove(draggedNode, gX, gY);
    } else if (selectionBox) {
      setSelectionBox(prev => prev ? { ...prev, x2: gX, y2: gY } : null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture(e.pointerId);
    if (isPanning) {
        setIsPanning(false);
        return;
    }
    if (draggedNode) {
       setDraggedNode(null);
    } else if (selectionBox) {
       const minX = Math.min(selectionBox.x1, selectionBox.x2);
       const maxX = Math.max(selectionBox.x1, selectionBox.x2);
       const minY = Math.min(selectionBox.y1, selectionBox.y2);
       const maxY = Math.max(selectionBox.y1, selectionBox.y2);
       
       const selectedIds = nodes.filter(n => n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY).map(n => n.id);
       
       if (selectedIds.length > 0 && onSelectionBox) {
           onSelectionBox(selectedIds);
       } else if (selectedIds.length === 0) {
           // Treated as click on background
           onNodeClick('', false);
           onLinkClick('');
       }
       setSelectionBox(null);
    }
  };

  return (
    <svg 
      ref={svgRef}
      className="w-full h-full bg-slate-50 cursor-crosshair touch-none select-none"
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      // removing click to avoid conflict with box selection
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
        <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
      </defs>

      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
        {/* Links */}
        {links.map(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (!source || !target) return null;

        const isSelected = selectedLinkId === link.id;
        const color = link.up ? (isSelected ? '#3b82f6' : '#cbd5e1') : '#ef4444';
        
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;

        return (
          <g key={link.id} onClick={(e) => { e.stopPropagation(); onLinkClick(link.id); }}>
            <line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={color}
              strokeWidth={isSelected ? 6 : 4}
              className="transition-all duration-200 cursor-pointer hover:stroke-blue-400"
              strokeDasharray={link.up ? "none" : "5,5"}
            />
            {link.up && (
              <g className="cursor-pointer">
                <circle cx={midX} cy={midY} r={14} fill="white" stroke={color} strokeWidth={2} />
                <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="bold" fill="#333">
                  {link.cost}
                </text>
              </g>
            )}
           {!link.up && (
               <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central" fontSize="18" fill="#ef4444" fontWeight="bold">
                   Ã
               </text>
           )}
          </g>
        );
      })}

      {/* Packets */}
      {packets.map(p => {
        const source = nodes.find(n => n.id === p.from);
        const target = nodes.find(n => n.id === p.to);
        if (!source || !target) return null;

        const curX = source.x + (target.x - source.x) * p.progress;
        const curY = source.y + (target.y - source.y) * p.progress;

        const originatorNode = nodes.find(n => n.id === p.payload.originator);
        const originatorLabel = originatorNode ? originatorNode.label : p.payload.originator;

        return (
          <g key={p.id} transform={`translate(${curX}, ${curY})`} className="pointer-events-none">
            <circle
              r={8}
              fill={p.failed ? "#ef4444" : "#10b981"}
            />
            {!p.failed && (
              <text
                 y="-12"
                 textAnchor="middle"
                 fontSize="12"
                 fontWeight="bold"
                 fill="#059669"
                 style={{ textShadow: '0 1px 2px white, 0 -1px 2px white, 1px 0 2px white, -1px 0 2px white' }}
              >
                 LSP({originatorLabel} #{p.payload.sequence})
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const isSelected = selectedNodeIds.includes(node.id);
        
        return (
          <g 
            key={node.id} 
            transform={`translate(${node.x},${node.y})`}
            onPointerDown={(e) => handlePointerDown(e, node.id)}
            onClick={(e) => e.stopPropagation()}
            className="cursor-move"
          >
            <circle
              r={24}
              fill="white"
              stroke={isSelected ? "#2563eb" : "#475569"}
              strokeWidth={3}
              className="transition-colors drop-shadow-md hover:stroke-blue-400"
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fontWeight="bold"
              fill="#1e293b"
              className="pointer-events-none select-none"
            >
              {node.label}
            </text>
          </g>
        );
      })}
        {/* Selection Box */}
        {selectionBox && (
          <rect
            x={Math.min(selectionBox.x1, selectionBox.x2)}
            y={Math.min(selectionBox.y1, selectionBox.y2)}
            width={Math.abs(selectionBox.x2 - selectionBox.x1)}
            height={Math.abs(selectionBox.y2 - selectionBox.y1)}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="rgba(59, 130, 246, 0.5)"
            strokeWidth="1"
            className="pointer-events-none"
          />
        )}
      </g>
    </svg>
  );
}
