
import React, { useRef, useState } from 'react';
import { Floor, GraphNode, GraphEdge, ToolMode, NodeType, FLOOR_HEIGHT } from '../types';

interface GraphCanvasProps {
  floor: Floor;
  nodes: GraphNode[];
  edges: GraphEdge[];
  toolMode: ToolMode;
  selectedNodeIds: Set<string>;
  selectedEdgeId: string | null;
  onSelectNodes: (ids: Set<string>) => void;
  onSelectEdge: (id: string | null) => void;
  onUpdateNode: (id: string, data: Partial<GraphNode>) => void;
  onBulkUpdateNode: (updates: {id: string, data: Partial<GraphNode>}[]) => void;
  onInteractionEnd: () => void;
  onAddNode: (node: GraphNode) => void;
  onAddEdge: (edge: GraphEdge) => void;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  floor,
  nodes,
  edges,
  toolMode,
  selectedNodeIds,
  selectedEdgeId,
  onSelectNodes,
  onSelectEdge,
  onUpdateNode,
  onBulkUpdateNode,
  onInteractionEnd,
  onAddNode,
  onAddEdge,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  
  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragAction, setDragAction] = useState<'move' | 'resize' | 'create' | 'select-box'>('move');
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [didModify, setDidModify] = useState(false);

  // Temporary Visuals
  const [tempNodeBox, setTempNodeBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  
  const [edgeStartNodeId, setEdgeStartNodeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);

  // Filter nodes/edges for current floor
  const activeNodes = nodes.filter((n) => {
    const floorMinZ = floor.level * FLOOR_HEIGHT;
    const floorMaxZ = (floor.level + 1) * FLOOR_HEIGHT;
    // Check overlap: box.z1 < floorMax && box.z2 > floorMin
    const zOverlap = n.boundingBox.z1 < floorMaxZ && n.boundingBox.z2 > floorMinZ;
    return n.floorLevels.includes(floor.level) || zOverlap;
  });

  const activeEdges = edges.filter((e) => {
    const source = activeNodes.find(n => n.id === e.source);
    const target = activeNodes.find(n => n.id === e.target);
    return source && target;
  });

  // Styles
  const getNodeColor = (type: NodeType) => {
    switch (type) {
      case NodeType.Classroom: return 'rgba(59, 130, 246, 0.4)'; 
      case NodeType.Corridor: return 'rgba(16, 185, 129, 0.4)'; 
      case NodeType.Stairs: return 'rgba(245, 158, 11, 0.4)'; 
      case NodeType.Outdoor: return 'rgba(107, 114, 128, 0.4)'; 
      case NodeType.Office: return 'rgba(139, 92, 246, 0.4)'; 
      case NodeType.Service: return 'rgba(236, 72, 153, 0.4)';
      case NodeType.Bathroom: return 'rgba(6, 182, 212, 0.4)';
      default: return 'rgba(200, 200, 200, 0.4)';
    }
  };

  const getNodeBorder = (type: NodeType) => {
    switch (type) {
      case NodeType.Classroom: return '#2563EB';
      case NodeType.Corridor: return '#059669';
      case NodeType.Stairs: return '#D97706';
      case NodeType.Bathroom: return '#0891B2';
      default: return '#4B5563';
    }
  };

  const getNodeCenter = (node: GraphNode) => ({
    x: (node.boundingBox.x1 + node.boundingBox.x2) / 2,
    y: (node.boundingBox.y1 + node.boundingBox.y2) / 2,
  });

  // Handlers
  const getLocalCoords = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getLocalCoords(e);
    setDragStart({ x, y });

    // Background click logic
    if (e.target === e.currentTarget) {
      if (toolMode === 'select') {
         if (!e.shiftKey) {
            onSelectNodes(new Set());
            onSelectEdge(null);
         }
         setIsDragging(true);
         setDragAction('select-box');
         setSelectionBox({ x, y, w: 0, h: 0 });
         setEdgeStartNodeId(null);

      } else if (toolMode === 'add-node') {
         setIsDragging(true);
         setDragAction('create');
         setTempNodeBox({ x, y, w: 0, h: 0 });
      }
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      const { x, y } = getLocalCoords(e);
      
      if (toolMode === 'select') {
          let newSelection = new Set(selectedNodeIds);
          
          if (e.shiftKey) {
              // Toggle
              if (newSelection.has(nodeId)) newSelection.delete(nodeId);
              else newSelection.add(nodeId);
              onSelectNodes(newSelection);
          } else {
              // If not holding shift, and clicking a node NOT in selection, select only it
              if (!newSelection.has(nodeId)) {
                  newSelection = new Set([nodeId]);
                  onSelectNodes(newSelection);
              }
              // If clicking a node ALREADY in selection, keep selection as is to allow dragging group
          }
          
          onSelectEdge(null);
          setIsDragging(true);
          setDragStart({ x, y });
          setDragAction('move');
          setDidModify(false);

      } else if (toolMode === 'add-edge') {
          handleEdgeCreationStep(nodeId);
      }
  };

  const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => {
      e.stopPropagation();
      const { x, y } = getLocalCoords(e);
      setIsDragging(true);
      setDragStart({ x, y });
      setDragAction('resize');
      setResizeHandle(handle);
      setDidModify(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getLocalCoords(e);
    setMousePos({ x, y });

    if (!isDragging || !dragStart) return;

    if (dragAction === 'create' && toolMode === 'add-node') {
      setTempNodeBox({
        x: Math.min(dragStart.x, x),
        y: Math.min(dragStart.y, y),
        w: Math.abs(x - dragStart.x),
        h: Math.abs(y - dragStart.y),
      });
    } 
    else if (dragAction === 'select-box') {
        setSelectionBox({
            x: Math.min(dragStart.x, x),
            y: Math.min(dragStart.y, y),
            w: Math.abs(x - dragStart.x),
            h: Math.abs(y - dragStart.y),
        });
    }
    else if (dragAction === 'move' && selectedNodeIds.size > 0) {
        const dx = x - dragStart.x;
        const dy = y - dragStart.y;
        
        setDidModify(true);
        
        // Batch update to avoid jitter / single node moving
        const updates: {id: string, data: Partial<GraphNode>}[] = [];
        
        selectedNodeIds.forEach(id => {
            const node = nodes.find(n => n.id === id);
            if (node) {
                updates.push({
                    id,
                    data: {
                        boundingBox: {
                            ...node.boundingBox,
                            x1: node.boundingBox.x1 + dx,
                            y1: node.boundingBox.y1 + dy,
                            x2: node.boundingBox.x2 + dx,
                            y2: node.boundingBox.y2 + dy,
                        }
                    }
                });
            }
        });
        
        onBulkUpdateNode(updates);
        setDragStart({ x, y }); // Incremental update
    }
    else if (dragAction === 'resize' && selectedNodeIds.size === 1 && resizeHandle) {
        // Resizing only supported for single node selection
        const nodeId = Array.from(selectedNodeIds)[0];
        const dx = x - dragStart.x;
        const dy = y - dragStart.y;
        const node = nodes.find(n => n.id === nodeId);
        
        if (node) {
            setDidModify(true);
            let { x1, y1, x2, y2 } = node.boundingBox;
            
            if (resizeHandle === 'nw') { x1 += dx; y1 += dy; }
            if (resizeHandle === 'ne') { x2 += dx; y1 += dy; }
            if (resizeHandle === 'sw') { x1 += dx; y2 += dy; }
            if (resizeHandle === 'se') { x2 += dx; y2 += dy; }

            // Simple constraint: min width/height 10px
            if (x2 - x1 < 10) {
                if (resizeHandle.includes('e')) x2 = x1 + 10; else x1 = x2 - 10;
            }
            if (y2 - y1 < 10) {
                if (resizeHandle.includes('s')) y2 = y1 + 10; else y1 = y2 - 10;
            }

            onUpdateNode(nodeId, { boundingBox: { ...node.boundingBox, x1, y1, x2, y2 } });
            setDragStart({ x, y });
        }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    setDragStart(null);
    setResizeHandle(null);

    if (dragAction === 'create' && tempNodeBox) {
      if (tempNodeBox.w > 10 && tempNodeBox.h > 10) {
        const newNode: GraphNode = {
          id: crypto.randomUUID(),
          label: 'New Room',
          type: NodeType.Classroom,
          capacity: 30,
          safetyLevel: 1,
          floorLevels: [floor.level],
          boundingBox: {
            x1: tempNodeBox.x,
            y1: tempNodeBox.y,
            x2: tempNodeBox.x + tempNodeBox.w,
            y2: tempNodeBox.y + tempNodeBox.h,
            z1: floor.level * FLOOR_HEIGHT,
            z2: (floor.level + 1) * FLOOR_HEIGHT
          }
        };
        onAddNode(newNode);
        onSelectNodes(new Set([newNode.id]));
      }
      setTempNodeBox(null);
    } 
    else if (dragAction === 'select-box' && selectionBox) {
        // Calculate intersection
        const bx1 = selectionBox.x;
        const by1 = selectionBox.y;
        const bx2 = selectionBox.x + selectionBox.w;
        const by2 = selectionBox.y + selectionBox.h;

        const newSelected = new Set<string>(selectedNodeIds); // Keep existing if Shift?
        // Actually standard behavior is: if no shift, replace. If shift, union.
        if (!e.shiftKey) newSelected.clear();

        activeNodes.forEach(n => {
            // Check Overlap
            const nx1 = n.boundingBox.x1;
            const ny1 = n.boundingBox.y1;
            const nx2 = n.boundingBox.x2;
            const ny2 = n.boundingBox.y2;

            const overlap = !(nx2 < bx1 || nx1 > bx2 || ny2 < by1 || ny1 > by2);
            if (overlap) {
                newSelected.add(n.id);
            }
        });
        onSelectNodes(newSelected);
        setSelectionBox(null);
    }
    else if ((dragAction === 'move' || dragAction === 'resize') && didModify) {
        onInteractionEnd();
    }
    
    setDragAction('move');
  };

  const handleEdgeCreationStep = (nodeId: string) => {
      if (!edgeStartNodeId) {
          setEdgeStartNodeId(nodeId);
          onSelectNodes(new Set([nodeId]));
      } else {
          if (edgeStartNodeId !== nodeId) {
              const newEdge: GraphEdge = {
                  id: crypto.randomUUID(),
                  source: edgeStartNodeId,
                  target: nodeId,
                  active: true,
                  capacity: 100,
                  traversalTime: 10,
                  bidirectional: true
              };
              onAddEdge(newEdge);
          }
          setEdgeStartNodeId(null);
      }
  };

  const ResizeHandleRect = ({ x, y, cursor, handle }: { x: number, y: number, cursor: string, handle: ResizeHandle }) => (
      <rect 
        x={x - 4} y={y - 4} width={8} height={8} 
        fill="white" stroke="#2563EB" strokeWidth="1"
        className="cursor-pointer hover:fill-indigo-100"
        style={{ cursor }}
        onMouseDown={(e) => handleResizeStart(e, handle)}
      />
  );

  return (
    <div className="relative w-full h-full overflow-auto bg-gray-200 border border-gray-300 flex justify-center">
      <div 
        ref={containerRef}
        className="relative bg-white shadow-lg origin-top-left"
        style={{ 
            width: floor.width, 
            height: floor.height,
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
            marginBottom: '500px',
            marginRight: '500px',
            cursor: toolMode === 'add-edge' ? 'crosshair' : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Background Image */}
        <img 
            src={floor.imageUrl} 
            alt="Floor Plan" 
            className="absolute top-0 left-0 select-none pointer-events-none"
            style={{ width: '100%', height: '100%' }}
        />

        {/* SVG Overlay */}
        <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none">
            <defs>
                 <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#374151" />
                 </marker>
            </defs>

            {/* Edges */}
            {activeEdges.map(edge => {
                const source = activeNodes.find(n => n.id === edge.source)!;
                const target = activeNodes.find(n => n.id === edge.target)!;
                const p1 = getNodeCenter(source);
                const p2 = getNodeCenter(target);
                const isSelected = edge.id === selectedEdgeId;

                return (
                    <g 
                        key={edge.id} 
                        onClick={(e) => {
                            e.stopPropagation(); 
                            if(toolMode === 'select') onSelectEdge(edge.id);
                        }}
                        className="cursor-pointer pointer-events-auto"
                    >
                        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth="15" />
                        <line 
                            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} 
                            stroke={isSelected ? '#4F46E5' : (edge.active ? '#374151' : '#EF4444')} 
                            strokeWidth={isSelected ? 4 : 2}
                            strokeDasharray={edge.active ? '0' : '4'}
                        />
                        <text 
                            x={(p1.x + p2.x)/2} 
                            y={(p1.y + p2.y)/2} 
                            fill="black" 
                            fontSize="12" 
                            stroke="white" 
                            strokeWidth="0.5"
                            textAnchor="middle"
                        >
                            {edge.traversalTime}s
                        </text>
                    </g>
                );
            })}

            {/* Temporary Edge Line */}
            {toolMode === 'add-edge' && edgeStartNodeId && mousePos && (
                (() => {
                    const startNode = activeNodes.find(n => n.id === edgeStartNodeId);
                    if (!startNode) return null;
                    const p1 = getNodeCenter(startNode);
                    return (
                        <line 
                            x1={p1.x} y1={p1.y} 
                            x2={mousePos.x} y2={mousePos.y} 
                            stroke="#6366F1" 
                            strokeWidth="2" 
                            strokeDasharray="5,5"
                        />
                    )
                })()
            )}

            {/* Nodes */}
            {activeNodes.map(node => {
                const isSelected = selectedNodeIds.has(node.id);
                const isHoverTarget = toolMode === 'add-edge' && edgeStartNodeId && edgeStartNodeId !== node.id;

                return (
                    <g key={node.id} className="pointer-events-auto">
                        <rect
                            x={node.boundingBox.x1}
                            y={node.boundingBox.y1}
                            width={node.boundingBox.x2 - node.boundingBox.x1}
                            height={node.boundingBox.y2 - node.boundingBox.y1}
                            fill={getNodeColor(node.type)}
                            stroke={isSelected ? '#4F46E5' : (isHoverTarget ? '#F59E0B' : getNodeBorder(node.type))}
                            strokeWidth={isSelected ? 3 : (isHoverTarget ? 3 : 1)}
                            className={`${toolMode === 'add-edge' ? 'cursor-crosshair' : 'cursor-pointer'} hover:opacity-90 transition-opacity`}
                            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                        />
                        <text
                            x={node.boundingBox.x1 + 5}
                            y={node.boundingBox.y1 + 15}
                            fontSize="12"
                            fontWeight="bold"
                            fill="rgba(0,0,0,0.7)"
                            className="pointer-events-none select-none"
                        >
                            {node.label}
                        </text>

                        {/* Resize Handles (Only if SINGLE selection) */}
                        {isSelected && selectedNodeIds.size === 1 && toolMode === 'select' && (
                            <>
                                <ResizeHandleRect x={node.boundingBox.x1} y={node.boundingBox.y1} cursor="nw-resize" handle="nw" />
                                <ResizeHandleRect x={node.boundingBox.x2} y={node.boundingBox.y1} cursor="ne-resize" handle="ne" />
                                <ResizeHandleRect x={node.boundingBox.x1} y={node.boundingBox.y2} cursor="sw-resize" handle="sw" />
                                <ResizeHandleRect x={node.boundingBox.x2} y={node.boundingBox.y2} cursor="se-resize" handle="se" />
                            </>
                        )}
                    </g>
                );
            })}

            {/* Selection Box */}
            {selectionBox && (
                <rect 
                    x={selectionBox.x}
                    y={selectionBox.y}
                    width={selectionBox.w}
                    height={selectionBox.h}
                    fill="rgba(99, 102, 241, 0.1)"
                    stroke="#4F46E5"
                    strokeWidth="1"
                    strokeDasharray="4"
                />
            )}

            {/* Temporary Drawing Node */}
            {tempNodeBox && (
                <rect 
                    x={tempNodeBox.x}
                    y={tempNodeBox.y}
                    width={tempNodeBox.w}
                    height={tempNodeBox.h}
                    fill="rgba(99, 102, 241, 0.2)"
                    stroke="#4F46E5"
                    strokeWidth="2"
                    strokeDasharray="4"
                />
            )}
        </svg>
      </div>

      {/* Zoom Controls */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-2 bg-white p-2 rounded shadow-lg z-20">
          <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-2 hover:bg-gray-100 rounded">-</button>
          <span className="text-center text-xs text-gray-500">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-2 hover:bg-gray-100 rounded">+</button>
      </div>
    </div>
  );
};
