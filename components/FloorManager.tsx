import React, { useState } from 'react';
import { Floor } from '../types';

interface FloorManagerProps {
  floors: Floor[];
  activeFloorId: string | null;
  onAddFloor: (file: File, level: number) => void;
  onSelectFloor: (id: string) => void;
  onDeleteFloor: (id: string) => void;
}

export const FloorManager: React.FC<FloorManagerProps> = ({
  floors,
  activeFloorId,
  onAddFloor,
  onSelectFloor,
  onDeleteFloor
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newLevel, setNewLevel] = useState<number>(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAddFloor(e.target.files[0], newLevel);
      setIsAdding(false);
      setNewLevel(prev => prev + 1);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <h3 className="font-bold text-lg mb-2 text-gray-700">Floors</h3>
      <div className="flex flex-col gap-2">
        {floors.map((f) => (
          <div
            key={f.id}
            onClick={() => onSelectFloor(f.id)}
            className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
              activeFloorId === f.id
                ? 'bg-indigo-100 border-indigo-500 border'
                : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
               <span className="font-mono text-xs bg-gray-200 px-1 rounded">L{f.level}</span>
               <span className="text-sm font-medium truncate w-32">{f.name}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFloor(f.id);
              }}
              className="text-red-400 hover:text-red-600"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {isAdding ? (
        <div className="mt-3 p-2 border border-dashed border-gray-300 rounded bg-gray-50">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-500">Level Index (Z)</label>
            <input
              type="number"
              value={newLevel}
              onChange={(e) => setNewLevel(parseInt(e.target.value))}
              className="border rounded px-2 py-1 text-sm"
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <button 
              onClick={() => setIsAdding(false)}
              className="text-xs text-gray-500 underline mt-1 text-left"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="mt-3 w-full py-1 text-sm text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 flex items-center justify-center gap-1"
        >
          <span>+</span> Add Floor
        </button>
      )}
    </div>
  );
};
