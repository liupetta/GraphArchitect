
import React from 'react';
import { GraphNode, GraphEdge, NodeType } from '../types';

interface PropertyEditorProps {
  selectedNode: GraphNode | null;
  totalSelectedNodes: number;
  selectedEdge: GraphEdge | null;
  onUpdateNode: (id: string, data: Partial<GraphNode>) => void;
  onUpdateEdge: (id: string, data: Partial<GraphEdge>) => void;
  onCommit: () => void; 
  onDeleteNode: () => void; // Renamed to generic delete for selection
  onDeleteEdge: (id: string) => void;
}

export const PropertyEditor: React.FC<PropertyEditorProps> = ({
  selectedNode,
  totalSelectedNodes,
  selectedEdge,
  onUpdateNode,
  onUpdateEdge,
  onCommit,
  onDeleteNode,
  onDeleteEdge
}) => {
  // 1. No Selection
  if (totalSelectedNodes === 0 && !selectedEdge) {
    return (
      <div className="p-4 text-gray-400 text-center text-sm italic">
        Select a node or edge to edit properties.
      </div>
    );
  }

  // 2. Multiple Selection
  if (totalSelectedNodes > 1) {
      return (
        <div className="p-4 bg-white shadow-lg h-full border-l border-gray-200 w-80">
            <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">
                Multiple Selection
            </h3>
            <div className="text-sm text-gray-600 mb-6">
                {totalSelectedNodes} items selected.
            </div>
            <button
                onClick={onDeleteNode}
                className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm hover:bg-red-100"
            >
                Delete {totalSelectedNodes} Items (Del)
            </button>
        </div>
      );
  }

  const handleImmediateChange = (type: 'node' | 'edge', id: string, data: any) => {
      if (type === 'node') onUpdateNode(id, data);
      else onUpdateEdge(id, data);
      setTimeout(onCommit, 0); 
  };

  // 3. Single Node Selection
  if (selectedNode) {
    return (
    <div className="p-4 bg-white shadow-lg h-full overflow-y-auto border-l border-gray-200 w-80">
      <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">
        Node Properties
      </h3>
      <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Label</label>
            <input
              type="text"
              value={selectedNode.label}
              onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
              onBlur={onCommit}
              className="w-full border rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Type</label>
            <select
              value={selectedNode.type}
              onChange={(e) => handleImmediateChange('node', selectedNode.id, { type: e.target.value as NodeType })}
              className="w-full border rounded px-2 py-1 text-sm bg-white"
            >
              {Object.values(NodeType).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Capacity</label>
              <input
                type="number"
                value={selectedNode.capacity}
                onChange={(e) => onUpdateNode(selectedNode.id, { capacity: parseInt(e.target.value) })}
                onBlur={onCommit}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Safety Level</label>
              <input
                type="number"
                value={selectedNode.safetyLevel}
                onChange={(e) => onUpdateNode(selectedNode.id, { safetyLevel: parseInt(e.target.value) })}
                onBlur={onCommit}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>

          <div className="pt-2 border-t mt-2">
            <h4 className="text-xs font-bold text-gray-500 mb-2">Bounding Box</h4>
            
            {/* 2D Coords */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div>
                    <span className="text-gray-400">X1</span>
                    <input 
                        type="number" 
                        value={Math.round(selectedNode.boundingBox.x1)} 
                        onChange={(e) => onUpdateNode(selectedNode.id, { boundingBox: { ...selectedNode.boundingBox, x1: parseInt(e.target.value) }})}
                        onBlur={onCommit}
                        className="w-full border rounded px-2 py-1 mt-1"
                    />
                </div>
                <div>
                    <span className="text-gray-400">Y1</span>
                    <input 
                        type="number" 
                        value={Math.round(selectedNode.boundingBox.y1)} 
                        onChange={(e) => onUpdateNode(selectedNode.id, { boundingBox: { ...selectedNode.boundingBox, y1: parseInt(e.target.value) }})}
                        onBlur={onCommit}
                        className="w-full border rounded px-2 py-1 mt-1"
                    />
                </div>
                <div>
                    <span className="text-gray-400">X2</span>
                    <input 
                        type="number" 
                        value={Math.round(selectedNode.boundingBox.x2)} 
                        onChange={(e) => onUpdateNode(selectedNode.id, { boundingBox: { ...selectedNode.boundingBox, x2: parseInt(e.target.value) }})}
                        onBlur={onCommit}
                        className="w-full border rounded px-2 py-1 mt-1"
                    />
                </div>
                <div>
                    <span className="text-gray-400">Y2</span>
                    <input 
                        type="number" 
                        value={Math.round(selectedNode.boundingBox.y2)} 
                        onChange={(e) => onUpdateNode(selectedNode.id, { boundingBox: { ...selectedNode.boundingBox, y2: parseInt(e.target.value) }})}
                        onBlur={onCommit}
                        className="w-full border rounded px-2 py-1 mt-1"
                    />
                </div>
            </div>

            {/* Z Coords */}
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                    <span className="text-gray-400">Floor Start (Z1)</span>
                    <input 
                        type="number" 
                        value={selectedNode.boundingBox.z1} 
                        onChange={(e) => onUpdateNode(selectedNode.id, { boundingBox: { ...selectedNode.boundingBox, z1: parseInt(e.target.value) }})}
                        onBlur={onCommit}
                        className="w-full border rounded px-2 py-1 mt-1"
                    />
                </div>
                <div>
                    <span className="text-gray-400">Floor End (Z2)</span>
                    <input 
                        type="number" 
                        value={selectedNode.boundingBox.z2} 
                        onChange={(e) => onUpdateNode(selectedNode.id, { boundingBox: { ...selectedNode.boundingBox, z2: parseInt(e.target.value) }})}
                        onBlur={onCommit}
                        className="w-full border rounded px-2 py-1 mt-1"
                    />
                </div>
            </div>
          </div>

          <button
            onClick={onDeleteNode}
            className="w-full mt-6 bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm hover:bg-red-100"
          >
            Delete Node (Del)
          </button>
        </div>
    </div>
    );
  }

  // 4. Edge Selection
  if (selectedEdge) {
    return (
        <div className="p-4 bg-white shadow-lg h-full overflow-y-auto border-l border-gray-200 w-80">
            <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">
                Edge Properties
            </h3>
        <div className="space-y-4">
          <div className="text-xs text-gray-500 mb-2">
            ID: <span className="font-mono">{selectedEdge.id.substring(0, 8)}...</span>
          </div>

          <div>
             <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedEdge.active}
                  onChange={(e) => handleImmediateChange('edge', selectedEdge.id, { active: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 font-medium">Active (Passable)</span>
             </label>
          </div>
          
          <div>
             <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedEdge.bidirectional}
                  onChange={(e) => handleImmediateChange('edge', selectedEdge.id, { bidirectional: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 font-medium">Bidirectional</span>
             </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Traversal Time (s)</label>
              <input
                type="number"
                value={selectedEdge.traversalTime}
                onChange={(e) => onUpdateEdge(selectedEdge.id, { traversalTime: parseInt(e.target.value) })}
                onBlur={onCommit}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Capacity</label>
              <input
                type="number"
                value={selectedEdge.capacity}
                onChange={(e) => onUpdateEdge(selectedEdge.id, { capacity: parseInt(e.target.value) })}
                onBlur={onCommit}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>

          <button
            onClick={() => onDeleteEdge(selectedEdge.id)}
            className="w-full mt-6 bg-red-50 text-red-600 border border-red-200 py-2 rounded text-sm hover:bg-red-100"
          >
            Delete Edge (Del)
          </button>
        </div>
      </div>
    );
  }
  
  return null;
};
