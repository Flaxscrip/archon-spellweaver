export type { Relation, RelationPointer } from './relations';
export { extractRelations } from './relations';

export type { RegistryGraph, GraphNeighbor } from './graph';
export { buildGraph, getNeighbors } from './graph';

export type { HighlightEdge, HighlightResult, WalkOptions, WalkSeed } from './walker';
export { walkFrom } from './walker';
