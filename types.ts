export enum NodeType {
  Classroom = 'classroom',
  Corridor = 'corridor',
  Stairs = 'stairs',
  Outdoor = 'outdoor',
  Office = 'office',
  Service = 'service'
}

export interface BoundingBox3D {
  x1: number; // pixels relative to image width
  y1: number; // pixels relative to image height
  z1: number; // Start floor index
  x2: number;
  y2: number;
  z2: number; // End floor index (inclusive)
}

export interface GraphNode {
  id: string;
  label: string;
  boundingBox: BoundingBox3D;
  floorLevels: number[]; // Array of floors this node exists on
  capacity: number;
  type: NodeType;
  safetyLevel: number;
}

export interface GraphEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  traversalTime: number; // seconds
  capacity: number;
  active: boolean;
  bidirectional: boolean;
}

export interface Floor {
  id: string;
  level: number; // z-index
  name: string;
  imageUrl: string;
  width: number; // Original image width
  height: number; // Original image height
}

export type ToolMode = 'select' | 'add-node' | 'add-edge';

export interface AppState {
  floors: Floor[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  activeFloorId: string | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  toolMode: ToolMode;
}
