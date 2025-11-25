
import React, { useState, useMemo, useRef } from 'react';
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
  const svgRef = useRef<SVGSVGElement>(null);

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
             const midZ = (n.boundingBox.z1 + n.boundingBox.z2) / 2;
             return midZ >= zBase && midZ < zBase + FLOOR_HEIGHT;
        });

        // Edges on this floor
        const floorEdges = edges.filter(e => {
            const source = nodes.find(n => n.id === e.source);
            const target = nodes.find(n => n.id === e.target);
            if (!source || !target) return false;
            
            const maxZ = Math.max(source.boundingBox.z1, target.boundingBox.z1);
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
  const getFloorTransform = (floor: Floor, z: number) => {
     const rad = (angle * Math.PI) / 180;
     const cos = Math.cos(rad);
     const sin = Math.sin(rad);
     const zDisplay = z * separation;
     
     const a = cos;
     const c = -sin;
     const e = -center.x * cos + center.y * sin;
     
     const b = sin * tilt;
     const d = cos * tilt;
     const f = (-center.x * sin - center.y * cos) * tilt - zDisplay;

     return `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
  };

  const handleExportImage = () => {
    if (!svgRef.current) return;

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    // Set high resolution for export
    canvas.width = 2000;
    canvas.height = 2000;

    // Load SVG into image
    img.setAttribute("src", "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData))));

    img.onload = () => {
      if (ctx) {
          // Fill white background for PNG
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw image centered-ish (the viewBox is -1000 -1000 2000 2000)
          // We map the 2000x2000 viewBox directly to 2000x2000 canvas
          ctx.drawImage(img, 0, 0, 2000, 2000);

          const pngUrl = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.href = pngUrl;
          downloadLink.download = "building_3d_view.png";
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
      }
    };
  };

  return (
    <div className="w-full h-full relative bg-white overflow-hidden flex flex-col items-center justify-center">
      
      {/* Controls Overlay */}
      <div className="absolute top-4 left-4 bg-white/90 p-4 rounded text-gray-800 text-sm z-10 backdrop-blur-md border border-gray-200 w-64 shadow-xl">
        <h3 className="font-bold mb-3 border-b border-gray-200 pb-1 text-gray-700">3D Controls</h3>
        
        <div className="mb-2">
            <label className="block text-xs text-gray-500 font-medium">Rotation</label>
            <input 
                type="range" min="0" max="360" value={angle} 
                onChange={e => setAngle(Number(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
        </div>

        <div className="mb-2">
            <label className="block text-xs text-gray-500 font-medium">Tilt</label>
            <input 
                type="range" min="0.1" max="1" step="0.05" value={tilt} 
                onChange={e => setTilt(Number(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
        </div>

        <div className="mb-2">
            <label className="block text-xs text-gray-500 font-medium">Zoom</label>
            <input 
                type="range" min="0.1" max="2" step="0.1" value={zoom} 
                onChange={e => setZoom(Number(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
        </div>

        <div className="mb-2">
            <label className="block text-xs text-gray-500 font-medium">Floor Separation</label>
            <input 
                type="range" min="0" max="5" step="0.1" value={separation} 
                onChange={e => setSeparation(Number(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
        </div>

        <button 
            onClick={handleExportImage}
            className="mt-3 w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
            <span>📸</span> Snapshot PNG
        </button>

        <div className="mt-3 text-xs text-gray-400 border-t pt-2">
            {nodes.length} Nodes, {edges.length} Edges
        </div>
      </div>

      {/* SVG Canvas */}
      <svg 
        ref={svgRef}
        className="w-full h-full cursor-move" 
        viewBox="-1000 -1000 2000 2000"
      >
        <g transform={`scale(${zoom}) translate(0, 200)`}>
            
            {layers.map((layer) => (
                <g key={layer.floor.id}>
                    {/* 1. Floor Image Plane */}
                    <g transform={getFloorTransform(layer.floor, layer.z)} style={{ opacity: 0.6 }}>
                        {/* Outline */}
                        <rect 
                            x="0" y="0" 
                            width={layer.floor.width} height={layer.floor.height} 
                            fill="rgba(255,255,255,0.4)" 
                            stroke="rgba(0,0,0,0.15)" strokeWidth="4" 
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
                        const color = getNodeColor(node.type, 0.7);
                        const stroke = getNodeStroke(node.type);
                        
                        const centerP = project((x1+x2)/2, (y1+y2)/2, z);

                        return (
                            <g key={node.id} className="hover:opacity-100 transition-opacity">
                                <path d={path} fill={color} stroke={stroke} strokeWidth="1" />
                                {zoom > 0.4 && (
                                    <text 
                                        x={centerP.x} 
                                        y={centerP.y} 
                                        fill="#0f172a" 
                                        fontSize="14"
                                        fontWeight="bold" 
                                        textAnchor="middle" 
                                        alignmentBaseline="middle"
                                        style={{ 
                                            textShadow: '0px 0px 3px rgba(255,255,255,0.9), 0px 0px 1px white',
                                            pointerEvents: 'none',
                                            fontFamily: 'sans-serif'
                                        }}
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
                        const sCz = layer.z; 
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
                                stroke={edge.active ? "#DC2626" : "#9CA3AF"} 
                                strokeWidth="2" 
                                strokeDasharray={edge.active ? "" : "4"}
                                opacity="0.8"
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
