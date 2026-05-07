import type { RegistryItem } from '../../types/registry';
import type { Relation } from './relations';
import { extractRelations } from './relations';

export interface RegistryGraph {
  readonly byDid: ReadonlyMap<string, RegistryItem>;
  readonly byId: ReadonlyMap<string, RegistryItem>;
  readonly byVertexId: ReadonlyMap<number, readonly RegistryItem[]>;
  /** parentDid → items whose parentDid equals that DID */
  readonly childrenByParent: ReadonlyMap<string, readonly RegistryItem[]>;
}

export interface GraphNeighbor {
  item: RegistryItem;
  relation: Relation;
}

/** O(N) index build. Call once per items[] reference change (e.g. in useMemo). */
export function buildGraph(items: RegistryItem[]): RegistryGraph {
  const byDid = new Map<string, RegistryItem>();
  const byId = new Map<string, RegistryItem>();
  const byVertexId = new Map<number, RegistryItem[]>();
  const childrenByParent = new Map<string, RegistryItem[]>();

  for (const item of items) {
    byDid.set(item.did, item);
    byId.set(item.id, item);

    const vList = byVertexId.get(item.vertexId);
    if (vList) vList.push(item);
    else byVertexId.set(item.vertexId, [item]);

    if (item.parentDid) {
      const pList = childrenByParent.get(item.parentDid);
      if (pList) pList.push(item);
      else childrenByParent.set(item.parentDid, [item]);
    }
  }

  return { byDid, byId, byVertexId, childrenByParent };
}

/**
 * Returns all directly related items and the relation kind for each,
 * including the inverse child relationship.
 */
export function getNeighbors(graph: RegistryGraph, item: RegistryItem): GraphNeighbor[] {
  const neighbors: GraphNeighbor[] = [];

  for (const { targetDid, relation } of extractRelations(item)) {
    const target = graph.byDid.get(targetDid);
    if (target) neighbors.push({ item: target, relation });
  }

  const children = graph.childrenByParent.get(item.did);
  if (children) {
    for (const child of children) {
      neighbors.push({ item: child, relation: 'child' });
    }
  }

  return neighbors;
}
