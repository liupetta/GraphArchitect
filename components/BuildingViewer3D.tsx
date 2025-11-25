
import React, { useState, useMemo } from 'react';
import { Floor, GraphNode, GraphEdge, NodeType, FLOOR_HEIGHT } from '../types';

interface BuildingViewer3DProps {
  floors: Floor[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Helper to determine colors
const getNodeColor = (type: NodeType, opacity: number = 0.8) => {
  const colors: Record<NodeType, string> = {
    [NodeType.Classroom]: `rgba(59, 130, 246, ${opacity})`, // Blue
    [NodeType.Corridor]: `rgba(16, 185, 129, ${opacity})`,  // Green
    [NodeType.Stairs]: `rgba(245, 158, 11, ${opacity})`,    // Orange
    [NodeType.Outdoor]: `rgba(107, 114, 128, ${opacity})`,  // Gray
    [NodeType.Office]: `rgba(139, 92, 246, ${opacity})`,    // Purple
    [NodeType.Service]: `rgba(236, 72, 153, ${opacity})`,   // Pink
    [NodeType.Bathroom]: `rgba(6, 182, 212, ${opacity})`,   // Cyan
  };
  return colors[type] || `rgba(200, 200, 200, ${opacity})`;
};

const getNodeStroke = (type: NodeType) => {
    const colors: Record<NodeType, string> = {
      [NodeType.Classroom]: '#1E40AF',
      [NodeType.Corridor]: '#065F46',
      [NodeType.Stairs]: '#92400E',
      [NodeType.Outdoor]: '#374151',
      [NodeType.Office]: '#5B21B6',
      [NodeType.Service]: '#9D174D',
      [NodeType.Bathroom]: '#155E75',
    };
    return colors[type] || '#4B5563';
};

export const BuildingViewer3D: React.FC<BuildingViewer3DProps> = ({ floors, nodes, edges }) => {
  // View State
  const [angle, setAngle] = useState(45); // Rotation around Y axis
  const [tilt, setTilt] = useState(0.5);  // Camera tilt (0 to 1)
  const [zoom, setZoom] = useState(0.5);
  const [separation, setSeparation] = useState(1.5); // Z-axis expansion for visibility

  // Center calculation for rotation
  const center = useMemo(() => {
    if (floors.length === 0) return { x: 500, y: 500 };
    const maxWidth = Math.max(...floors.map(f => f.width));
    const maxHeight = Math.max(...floors.map(f => f.height));
    return { x: maxWidth / 2, y: maxHeight / 2 };
  }, [floors]);

  // Project point to screen space
  const project = (x: number, y: number, z: number) => {
    const dx = x - center.x;
    const dy = y - center.y;
    const rad = (angle * Math.PI) / 180;
    
    // Rotate
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

    // Isometric-ish projection with Z offset
    const zDisplay = z * separation;

    return {
      x: rx,
      y: ry * tilt - zDisplay
    };
  };

  // Organize data by layers (floors)
  const layers = useMemo(() => {
    const sortedFloors = [...floors].sort((a, b) => a.level - b.level);
    
    return sortedFloors.map(floor => {
        const zBase = floor.level * FLOOR_HEIGHT;
        
        // Nodes on this floor
        const floorNodes = nodes.filter(n => {
             // Check if node belongs primarily to this floor level
             // Simple check: middle of node Z is within floor range
             const midZ = (n.boundingBox.z1 + n.boundingBox.z2) / 2;
             return midZ >= zBase && midZ < zBase + FLOOR_HEIGHT;
        });

        // Edges on this floor (both nodes on this floor)
        // or edges connecting TO this floor from below?
        // We'll render edges associated with the 'source' if both on same floor,
        // or just render all edges in a final pass to ensure visibility?
        // Let's render edges in the layer of their highest node to avoid occlusion by the floor image.
        const floorEdges = edges.filter(e => {
            const source = nodes.find(n => n.id === e.source);
            const target = nodes.find(n => n.id === e.target);
            if (!source || !target) return false;
            
            const maxZ = Math.max(source.boundingBox.z1, target.boundingBox.z1);
            // Belongs to this layer if the highest point is on this floor
            return maxZ >= zBase && maxZ < zBase + FLOOR_HEIGHT;
        });

        return {
            floor,
            nodes: floorNodes,
            edges: floorEdges,
            z: zBase
        };
    });
  }, [floors, nodes, edges]);

  // Calculate SVG Matrix for Image Projection
  // We need to map (0,0) -> p0, (w,0) -> p1, (0,h) -> p2
  const getFloorTransform = (floor: Floor, z: number) => {
     const rad = (angle * Math.PI) / 180;
     const cos = Math.cos(rad);
     const sin = Math.sin(rad);
     const zDisplay = z * separation;
     
     // Affine Transform Coefficients
     // x' = a*x + c*y + e
     // y' = b*x + d*y + f
     
     // Based on projection logic:
     // rx = (x - cx)cos - (y - cy)sin
     // ry = ((x - cx)sin + (y - cy)cos) * tilt - zDisplay
     
     // Expand X:
     // x_screen = x(cos) + y(-sin) + (-cx*cos + cy*sin)
     const a = cos;
     const c = -sin;
     const e = -center.x * cos + center.y * sin;
     
     // Expand Y:
     // y_screen = x(sin*tilt) + y(cos*tilt) + ((-cx*sin - cy*cos)*tilt - zDisplay)
     const b = sin * tilt;
     const d = cos * tilt;
     const f = (-center.x * sin - center.y * cos) * tilt - zDisplay;

     return `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
  };

  return (
    <div className="w-full h-full relative bg-gray-900 overflow-hidden flex flex-col items-center justify-center">
      
      {/* Controls Overlay */}
      <div className="absolute top-4 left-4 bg-gray-800/80 p-4 rounded text-white text-sm z-10 backdrop-blur border border-gray-700 w-64">
        <h3 className="font-bold mb-3 border-b border-gray-600 pb-1">3D Controls</h3>
        
        <div className="mb-2">
            <label className="block text-xs text-gray-400">Rotation</label>
            <input 
                type="range" min="0" max="360" value={angle} 
                onChange={e => setAngle(Number(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
        </div>

        <div className="mb-2">
            <label className="block text-xs text-gray-400">Tilt</label>
            <input 
                type="range" min="0.1" max="1" step="0.05" value={tilt} 
                onChange={e => setTilt(Number(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
        </div>

        <div className="mb-2">
            <label className="block text-xs text-gray-400">Zoom</label>
            <input 
                type="range" min="0.1" max="2" step="0.1" value={zoom} 
                onChange={e => setZoom(Number(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
        </div>

        <div className="mb-2">
            <label className="block text-xs text-gray-400">Floor Separation</label>
            <input 
                type="range" min="0" max="5" step="0.1" value={separation} 
                onChange={e => setSeparation(Number(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
        </div>

        <div className="mt-4 text-xs text-gray-500">
            {nodes.length} Nodes, {edges.length} Edges
        </div>
      </div>

      {/* SVG Canvas */}
      <svg className="w-full h-full cursor-move" viewBox="-1000 -1000 2000 2000">
        <g transform={`scale(${zoom}) translate(0, 200)`}>
            
            {layers.map((layer) => (
                <g key={layer.floor.id}>
                    {/* 1. Floor Image Plane */}
                    <g transform={getFloorTransform(layer.floor, layer.z)} style={{ opacity: 0.5 }}>
                        {/* Outline */}
                        <rect 
                            x="0" y="0" 
                            width={layer.floor.width} height={layer.floor.height} 
                            fill="rgba(255,255,255,0.1)" 
                            stroke="rgba(255,255,255,0.3)" strokeWidth="4" 
                        />
                        {/* Image */}
                        <image 
                            href={layer.floor.imageUrl} 
                            x="0" y="0" 
                            width={layer.floor.width} height={layer.floor.height} 
                        />
                    </g>

                    {/* 2. Nodes (Flat on Floor) */}
                    {layer.nodes.map(node => {
                        const { x1, y1, x2, y2 } = node.boundingBox;
                        const z = layer.z; // Draw at floor level
                        
                        // Project 4 corners
                        const p0 = project(x1, y1, z);
                        const p1 = project(x2, y1, z);
                        const p2 = project(x2, y2, z);
                        const p3 = project(x1, y2, z);
                        
                        const path = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} Z`;
                        const color = getNodeColor(node.type, 0.6);
                        const stroke = getNodeStroke(node.type);
                        
                        const centerP = project((x1+x2)/2, (y1+y2)/2, z);

                        return (
                            <g key={node.id} className="hover:opacity-100 transition-opacity">
                                <path d={path} fill={color} stroke={stroke} strokeWidth="1" />
                                {zoom > 0.6 && (
                                    <text 
                                        x={centerP.x} 
                                        y={centerP.y} 
                                        fill="white" 
                                        fontSize="12" 
                                        textAnchor="middle" 
                                        alignmentBaseline="middle"
                                        style={{ textShadow: '0px 1px 2px black', pointerEvents: 'none' }}
                                    >
                                        {node.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* 3. Edges (On this layer) */}
                    {layer.edges.map(edge => {
                        const source = nodes.find(n => n.id === edge.source);
                        const target = nodes.find(n => n.id === edge.target);
                        if (!source || !target) return null;

                        const sCx = (source.boundingBox.x1 + source.boundingBox.x2) / 2;
                        const sCy = (source.boundingBox.y1 + source.boundingBox.y2) / 2;
                        const sCz = layer.z; // Flat connection at floor level? Or Use real Z?
                        // Use real Z for inter-floor connections to look correct
                        const realSCz = source.boundingBox.z1;

                        const tCx = (target.boundingBox.x1 + target.boundingBox.x2) / 2;
                        const tCy = (target.boundingBox.y1 + target.boundingBox.y2) / 2;
                        const realTCz = target.boundingBox.z1;

                        const p1 = project(sCx, sCy, realSCz);
                        const p2 = project(tCx, tCy, realTCz);

                        return (
                            <line 
                                key={edge.id}
                                x1={p1.x} y1={p1.y}
                                x2={p2.x} y2={p2.y}
                                stroke={edge.active ? "#F87171" : "#4B5563"} 
                                strokeWidth="2" 
                                strokeDasharray={edge.active ? "" : "4"}
                                opacity="0.9"
                            />
                        );
                    })}
                </g>
            ))}

        </g>
      </svg>
    </div>
  );
};
