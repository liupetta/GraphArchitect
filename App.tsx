
import React, { useState, useEffect, useCallback } from 'react';
import { Floor, GraphNode, GraphEdge, ToolMode, NodeType, FLOOR_HEIGHT } from './types';
import { FloorManager } from './components/FloorManager';
import { PropertyEditor } from './components/PropertyEditor';
import { GraphCanvas } from './components/GraphCanvas';
import { BuildingViewer3D } from './components/BuildingViewer3D';
import { extractGraphFromImage } from './services/geminiService';
import { preprocessImageForAI } from './services/imageProcessing';

// Helper to download files without external dependencies
const downloadFile = (content: Blob | string, fileName: string) => {
  const link = document.createElement('a');
  let url = '';
  
  if (content instanceof Blob) {
    url = URL.createObjectURL(content);
  } else {
    url = content; // Assume string is a valid URI (data: or http:)
  }
  
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  if (content instanceof Blob) {
    URL.revokeObjectURL(url);
  }
};

// Placeholder image helper
const getImageDimensions = (src: string): Promise<{ w: number, h: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.src = src;
  });
};

const App: React.FC = () => {
  // --- State ---
  const [floors, setFloors] = useState<Floor[]>([]);
  
  // History Management
  const [history, setHistory] = useState<{nodes: GraphNode[], edges: GraphEdge[]}[]>([{nodes: [], edges: []}]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Current State
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  
  // Multi-selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null); // Keep edge single select for now
  
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [useEnhancement, setUseEnhancement] = useState(true); // Image processing toggle
  
  // View Mode: 'editor' or '3d'
  const [viewMode, setViewMode] = useState<'editor' | '3d'>('editor');

  // --- Derived State ---
  const activeFloor = floors.find(f => f.id === activeFloorId);
  
  // Helper for property editor to get the "primary" node if multiple selected
  const primarySelectedNode = selectedNodeIds.size === 1 
    ? nodes.find(n => n.id === Array.from(selectedNodeIds)[0]) || null 
    : null;
    
  const selectedEdge = edges.find(e => e.id === selectedEdgeId) || null;

  // --- History Helpers ---
  const addToHistory = useCallback((newNodes: GraphNode[], newEdges: GraphEdge[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: newNodes, edges: newEdges });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const state = history[prevIndex];
      setNodes(state.nodes);
      setEdges(state.edges);
      setHistoryIndex(prevIndex);
      // Clear selections to avoid ghost IDs
      setSelectedNodeIds(new Set());
      setSelectedEdgeId(null);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const state = history[nextIndex];
      setNodes(state.nodes);
      setEdges(state.edges);
      setHistoryIndex(nextIndex);
    }
  }, [historyIndex, history]);

  // --- Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Avoid deleting when in input fields
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
        
        if (selectedNodeIds.size > 0) {
          handleDeleteSelectedNodes();
        } else if (selectedEdgeId) {
          handleDeleteEdge(selectedEdgeId);
        }
      }

      // Undo: Cmd+Z
      if (cmdKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Redo: Cmd+Shift+Z or Cmd+Y
      if ((cmdKey && e.key.toLowerCase() === 'z' && e.shiftKey) || (cmdKey && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, selectedEdgeId, handleUndo, handleRedo]);

  // --- Data Handlers ---

  const commitState = () => {
    addToHistory(nodes, edges);
  };

  // Handlers passed to children
  const handleNodeUpdate = (id: string, data: Partial<GraphNode>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
  };

  // Batch move handler for multi-select
  const handleBatchNodeMove = (deltas: {id: string, x: number, y: number}[]) => {
    setNodes(prev => {
      const next = [...prev];
      deltas.forEach(d => {
         const nodeIndex = next.findIndex(n => n.id === d.id);
         if(nodeIndex !== -1) {
           next[nodeIndex] = {
             ...next[nodeIndex],
             boundingBox: {
               ...next[nodeIndex].boundingBox,
               x1: d.x, 
             }
           };
         }
      });
      return next;
    });
  };

  // New Bulk Update Method
  const handleBulkNodeUpdate = (updates: {id: string, data: Partial<GraphNode>}[]) => {
     setNodes(prev => {
       const next = [...prev];
       updates.forEach(u => {
         const idx = next.findIndex(n => n.id === u.id);
         if (idx !== -1) {
           next[idx] = { ...next[idx], ...u.data };
         }
       });
       return next;
     });
  };

  const handleEdgeUpdate = (id: string, data: Partial<GraphEdge>) => {
    setEdges(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
  };

  const handleCommit = () => {
    commitState();
  };

  const handleAddNode = (node: GraphNode) => {
    const newNodes = [...nodes, node];
    setNodes(newNodes);
    addToHistory(newNodes, edges);
  };

  const handleAddEdge = (edge: GraphEdge) => {
    const newEdges = [...edges, edge];
    setEdges(newEdges);
    addToHistory(nodes, newEdges);
  };

  const handleDeleteSelectedNodes = () => {
    const idsToDelete = selectedNodeIds;
    const newNodes = nodes.filter(n => !idsToDelete.has(n.id));
    const newEdges = edges.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target));
    setNodes(newNodes);
    setEdges(newEdges);
    addToHistory(newNodes, newEdges);
    setSelectedNodeIds(new Set());
  };

  const handleDeleteEdge = (id: string) => {
    const newEdges = edges.filter(e => e.id !== id);
    setEdges(newEdges);
    addToHistory(nodes, newEdges);
    setSelectedEdgeId(null);
  };

  const handleAddFloor = async (file: File, level: number) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const dims = await getImageDimensions(dataUrl);
      const newFloor: Floor = {
        id: crypto.randomUUID(),
        level,
        name: file.name,
        imageUrl: dataUrl,
        width: dims.w,
        height: dims.h
      };
      setFloors(prev => [...prev, newFloor]);
      if (!activeFloorId) setActiveFloorId(newFloor.id);
    };
    reader.readAsDataURL(file);
  };

  const handleAutoExtract = async () => {
    if (!activeFloor || !activeFloorId) {
      alert("Select a floor first");
      return;
    }
    if (!process.env.API_KEY) {
      alert("API Key not configured in environment. Please check setup.");
      return;
    }

    setIsProcessing(true);
    try {
      let base64ToUse = activeFloor.imageUrl.split(',')[1];
      let mimeType = activeFloor.imageUrl.split(';')[0].split(':')[1];

      if (useEnhancement) {
        // Enhance image contrast to detect walls better
        const processedDataUrl = await preprocessImageForAI(activeFloor.imageUrl);
        base64ToUse = processedDataUrl.split(',')[1];
        mimeType = "image/jpeg";
      }
      
      const data = await extractGraphFromImage(base64ToUse, mimeType, activeFloor.level);
      
      if (data && data.nodes) {
        const newNodesList: GraphNode[] = [];
        const newEdgesList: GraphEdge[] = [];
        const labelToIdMap: Record<string, string> = {};

        data.nodes.forEach((n: any) => {
          const id = crypto.randomUUID();
          labelToIdMap[n.label] = id;
          
          const ymin = n.box_2d[0] / 1000 * activeFloor.height;
          const xmin = n.box_2d[1] / 1000 * activeFloor.width;
          const ymax = n.box_2d[2] / 1000 * activeFloor.height;
          const xmax = n.box_2d[3] / 1000 * activeFloor.width;

          let type = NodeType.Classroom;
          const tLower = n.type ? n.type.toLowerCase() : "classroom";
          if (tLower.includes('corridor')) type = NodeType.Corridor;
          else if (tLower.includes('stair')) type = NodeType.Stairs;
          else if (tLower.includes('out')) type = NodeType.Outdoor;
          else if (tLower.includes('office')) type = NodeType.Office;
          else if (tLower.includes('bath') || tLower.includes('wc') || tLower.includes('toilet') || tLower.includes('restroom')) type = NodeType.Bathroom;
          else if (tLower.includes('service')) type = NodeType.Service;

          newNodesList.push({
            id,
            label: n.label || "Unknown",
            type,
            capacity: 20,
            safetyLevel: 1,
            floorLevels: [activeFloor.level],
            boundingBox: {
              x1: xmin, y1: ymin, x2: xmax, y2: ymax,
              z1: activeFloor.level * FLOOR_HEIGHT, 
              z2: (activeFloor.level + 1) * FLOOR_HEIGHT
            }
          });
        });

        if (data.connections) {
           data.connections.forEach((c: any) => {
               const sourceId = labelToIdMap[c.source_label];
               const targetId = labelToIdMap[c.target_label];
               if (sourceId && targetId) {
                   newEdgesList.push({
                       id: crypto.randomUUID(),
                       source: sourceId,
                       target: targetId,
                       active: true,
                       capacity: 100,
                       traversalTime: 5,
                       bidirectional: true
                   });
               }
           });
        }

        const mergedNodes = [...nodes, ...newNodesList];
        const mergedEdges = [...edges, ...newEdgesList];
        setNodes(mergedNodes);
        setEdges(mergedEdges);
        addToHistory(mergedNodes, mergedEdges);
      }

    } catch (err) {
      console.error(err);
      alert("Failed to extract graph: " + err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportJson = () => {
    const data = {
      metadata: {
          generated: new Date().toISOString(),
          app: "Building Graph Architect"
      },
      floors: floors, 
      nodes,
      edges
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadFile(blob, 'building_graph.json');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const json = JSON.parse(evt.target?.result as string);
            if (json.floors && json.nodes && json.edges) {
                setFloors(json.floors);
                setNodes(json.nodes);
                setEdges(json.edges);
                setHistory([{nodes: json.nodes, edges: json.edges}]);
                setHistoryIndex(0);
                if (json.floors.length > 0) {
                    setActiveFloorId(json.floors[0].id);
                }
            } else {
                alert("Invalid JSON format: Missing required fields.");
            }
        } catch (err) {
            console.error(err);
            alert("Error parsing JSON file.");
        }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportCsv = () => {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "id,label,type,x1,y1,z1,x2,y2,z2,capacity,safetyLevel\n";
      nodes.forEach(n => {
          csvContent += `${n.id},"${n.label}",${n.type},${n.boundingBox.x1},${n.boundingBox.y1},${n.boundingBox.z1},${n.boundingBox.x2},${n.boundingBox.y2},${n.boundingBox.z2},${n.capacity},${n.safetyLevel}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      downloadFile(encodedUri, "nodes.csv");

      setTimeout(() => {
          let edgeCsv = "data:text/csv;charset=utf-8,";
          edgeCsv += "id,source,target,traversalTime,capacity,active,bidirectional\n";
          edges.forEach(e => {
             edgeCsv += `${e.id},${e.source},${e.target},${e.traversalTime},${e.capacity},${e.active},${e.bidirectional}\n`;
          });
          const encodedEdgeUri = encodeURI(edgeCsv);
          downloadFile(encodedEdgeUri, "edges.csv");
      }, 500);
  };

  return (
    <div className="flex h-screen w-full flex-col">
      {/* Header */}
      <header className="bg-gray-900 text-white h-14 flex items-center justify-between px-4 shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-xl tracking-tight">Graph<span className="text-indigo-400">Architect</span></h1>
          <div className="h-6 w-px bg-gray-700 mx-2"></div>
          
          {/* View Toggle */}
          <div className="flex bg-gray-800 rounded p-1 gap-1">
             <button
               onClick={() => setViewMode('editor')}
               className={`px-3 py-1 text-xs rounded uppercase font-bold transition-colors ${viewMode === 'editor' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
             >
               2D Editor
             </button>
             <button
               onClick={() => setViewMode('3d')}
               className={`px-3 py-1 text-xs rounded uppercase font-bold transition-colors ${viewMode === '3d' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
             >
               3D View
             </button>
          </div>
          
          {viewMode === 'editor' && (
            <>
              <div className="h-6 w-px bg-gray-700 mx-2"></div>
              {/* Tools */}
              <div className="flex bg-gray-800 rounded p-1 gap-1">
                <button 
                    onClick={() => setToolMode('select')}
                    title="Select (V)"
                    className={`px-3 py-1 text-xs rounded uppercase font-bold transition-colors ${toolMode === 'select' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Select
                </button>
                <button 
                    onClick={() => setToolMode('add-node')}
                    title="Add Node (N)"
                    className={`px-3 py-1 text-xs rounded uppercase font-bold transition-colors ${toolMode === 'add-node' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Add Node
                </button>
                <button 
                    onClick={() => setToolMode('add-edge')}
                    title="Add Edge (E)"
                    className={`px-3 py-1 text-xs rounded uppercase font-bold transition-colors ${toolMode === 'add-edge' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Add Edge
                </button>
              </div>

              {/* Undo/Redo */}
              <div className="flex items-center gap-1 ml-2">
                 <button onClick={handleUndo} disabled={historyIndex <= 0} className={`p-1.5 rounded hover:bg-gray-700 ${historyIndex <= 0 ? 'opacity-30 cursor-not-allowed' : ''}`} title="Undo (Ctrl+Z)">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                 </button>
                 <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={`p-1.5 rounded hover:bg-gray-700 ${historyIndex >= history.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`} title="Redo (Ctrl+Y)">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"></path></svg>
                 </button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
           {viewMode === 'editor' && (
               <div className="flex items-center mr-2 gap-1">
                  <input 
                    type="checkbox" 
                    id="enhance" 
                    checked={useEnhancement} 
                    onChange={(e) => setUseEnhancement(e.target.checked)}
                    className="rounded text-indigo-500 bg-gray-700 border-gray-600"
                  />
                  <label htmlFor="enhance" className="text-xs text-gray-300 cursor-pointer">Enhance Walls</label>
               </div>
           )}
           
           {viewMode === 'editor' && (
             <button 
               onClick={handleAutoExtract}
               disabled={isProcessing || !activeFloor}
               className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-all ${isProcessing ? 'bg-gray-600 cursor-wait' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/30'}`}
             >
               {isProcessing ? (
                 <>
                   <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                   <span>AI Processing...</span>
                 </>
               ) : (
                 <>
                   <span>✨ AI Extract</span>
                 </>
               )}
             </button>
           )}
           <div className="h-6 w-px bg-gray-700 mx-2"></div>
           
           <label className="cursor-pointer px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm border border-gray-700 flex items-center gap-1 hover:text-white text-gray-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              <span>Load JSON</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
           </label>

           <button onClick={handleExportJson} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm border border-gray-700 text-gray-300 hover:text-white transition-colors">Save JSON</button>
           <button onClick={handleExportCsv} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm border border-gray-700 text-gray-300 hover:text-white transition-colors">CSV</button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {viewMode === 'editor' && (
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col z-20 overflow-y-auto">
                <div className="p-4">
                    <FloorManager 
                        floors={floors}
                        activeFloorId={activeFloorId}
                        onAddFloor={handleAddFloor}
                        onSelectFloor={setActiveFloorId}
                        onDeleteFloor={(id) => {
                            setFloors(f => f.filter(x => x.id !== id));
                            if(activeFloorId === id) setActiveFloorId(null);
                        }}
                    />
                    
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
                        <h4 className="font-bold mb-1">Shortcuts</h4>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                            <li><strong>Del / Backspace</strong>: Delete Selected</li>
                            <li><strong>Ctrl + Z</strong>: Undo</li>
                            <li><strong>Ctrl + Shift + Z</strong>: Redo</li>
                        </ul>
                        <h4 className="font-bold mb-1 mt-3">Mouse Actions</h4>
                        <ul className="list-disc pl-4 space-y-1 text-xs">
                            <li><strong>Shift + Click</strong>: Add to selection.</li>
                            <li><strong>Drag Background</strong>: Box selection.</li>
                        </ul>
                    </div>
                </div>
            </div>
        )}

        {/* Center: Canvas or 3D View */}
        <div className="flex-1 relative bg-gray-100 overflow-hidden">
            {viewMode === 'editor' ? (
                activeFloor ? (
                    <GraphCanvas 
                        floor={activeFloor}
                        nodes={nodes}
                        edges={edges}
                        toolMode={toolMode}
                        selectedNodeIds={selectedNodeIds}
                        selectedEdgeId={selectedEdgeId}
                        onSelectNodes={setSelectedNodeIds}
                        onSelectEdge={setSelectedEdgeId}
                        onUpdateNode={handleNodeUpdate}
                        onBulkUpdateNode={handleBulkNodeUpdate}
                        onInteractionEnd={handleCommit}
                        onAddNode={handleAddNode}
                        onAddEdge={handleAddEdge}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 flex-col">
                        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        <p>Select or add a floor to begin.</p>
                    </div>
                )
            ) : (
                <BuildingViewer3D floors={floors} nodes={nodes} edges={edges} />
            )}
        </div>

        {/* Right Sidebar: Properties (only in editor mode) */}
        {viewMode === 'editor' && (
            <div className="w-80 bg-white border-l border-gray-200 z-20">
                 <PropertyEditor 
                    selectedNode={primarySelectedNode}
                    totalSelectedNodes={selectedNodeIds.size}
                    selectedEdge={selectedEdge}
                    onUpdateNode={handleNodeUpdate}
                    onUpdateEdge={handleEdgeUpdate}
                    onCommit={handleCommit}
                    onDeleteNode={handleDeleteSelectedNodes} // Renamed prop usage
                    onDeleteEdge={handleDeleteEdge}
                 />
            </div>
        )}

      </div>
    </div>
  );
};

export default App;
