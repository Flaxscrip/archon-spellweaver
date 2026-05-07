import type { RegistryItem } from '../../types/registry';
import type { RegistryGraph } from './graph';
import { getNeighbors } from './graph';
import type { Relation } from './relations';

export interface HighlightEdge {
  from: number;
  to: number;
  relation: Relation;
  fromItemId: string;
  toItemId: string;
}

export interface HighlightResult {
  vertices: Set<number>;
  edges: HighlightEdge[];   // deduped by (from, to, relation)
  items: Set<string>;       // item ids touched
}

export interface WalkOptions {
  /** How many hops from seeds to follow. Default 1. 0 returns seed vertices only. */
  hops?: number;
  /** Restrict traversal to these relation kinds. Default: all six. */
  relations?: Relation[];
}

/** A seed can be a full item, an item id/DID string, or a bare vertex id object. */
export type WalkSeed = RegistryItem | string | { vertexId: number };

/**
 * Walk outward from seeds up to `hops` steps, collecting vertices, typed edges,
 * and touched item ids.
 *
 * Normalization note: the previous code had two slightly different walk orders
 * (selectedItem branch vs. chronicle-hover branch) and ChroniclePanel omitted
 * the `controller` relation. All callers now use a single definition:
 *   parent → schema → issuer → subject → controller → children
 * This normalises the rare edge-cases where the two branches differed.
 */
export function walkFrom(
  graph: RegistryGraph,
  seeds: WalkSeed[],
  opts: WalkOptions = {},
): HighlightResult {
  const hops = opts.hops ?? 1;
  const allowedRelations = opts.relations ? new Set(opts.relations) : null;

  const vertices = new Set<number>();
  const touchedItems = new Set<string>();
  const edgeMap = new Map<string, HighlightEdge>();

  // ── Resolve seeds to starting item ids ──────────────────────────────────────
  const frontier = new Set<string>();

  for (const seed of seeds) {
    if (typeof seed === 'string') {
      const item = graph.byId.get(seed) ?? graph.byDid.get(seed);
      if (item) {
        addSeedItem(item, frontier, vertices, touchedItems);
      }
    } else if ('id' in seed) {
      addSeedItem(seed as RegistryItem, frontier, vertices, touchedItems);
    } else {
      // { vertexId: number } — expand to all items pinned at that vertex
      const { vertexId } = seed as { vertexId: number };
      vertices.add(vertexId);
      for (const item of graph.byVertexId.get(vertexId) ?? []) {
        addSeedItem(item, frontier, vertices, touchedItems);
      }
    }
  }

  if (hops === 0) {
    return { vertices, edges: [], items: touchedItems };
  }

  // ── BFS ─────────────────────────────────────────────────────────────────────
  let wave = new Set<string>(frontier);

  for (let hop = 0; hop < hops; hop++) {
    if (wave.size === 0) break;
    const nextWave = new Set<string>();

    for (const itemId of wave) {
      const item = graph.byId.get(itemId);
      if (!item) continue;

      for (const { item: neighbor, relation } of getNeighbors(graph, item)) {
        if (allowedRelations && !allowedRelations.has(relation)) continue;

        // Dedup edge by (from-vertex, to-vertex, relation)
        const key = `${item.vertexId}:${neighbor.vertexId}:${relation}`;
        if (!edgeMap.has(key)) {
          edgeMap.set(key, {
            from: item.vertexId,
            to: neighbor.vertexId,
            relation,
            fromItemId: item.id,
            toItemId: neighbor.id,
          });
        }

        vertices.add(neighbor.vertexId);

        if (!touchedItems.has(neighbor.id)) {
          touchedItems.add(neighbor.id);
          nextWave.add(neighbor.id);
        }
      }
    }

    wave = nextWave;
  }

  return {
    vertices,
    edges: Array.from(edgeMap.values()),
    items: touchedItems,
  };
}

function addSeedItem(
  item: RegistryItem,
  frontier: Set<string>,
  vertices: Set<number>,
  touched: Set<string>,
): void {
  frontier.add(item.id);
  vertices.add(item.vertexId);
  touched.add(item.id);
}
