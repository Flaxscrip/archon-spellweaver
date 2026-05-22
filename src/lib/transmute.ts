// ═══════════════════════════════════════════════════════════════
// TRANSMUTATION ENGINE — pure module, no React, no DOM
// Converts spellweb-registry items → spellweb.ai node/edge format
// Used by: PublishPanel.tsx (UI preview) and scripts/transmute-to-spellweb.ts (CLI)
//
// Upstream taxonomy constraints (verified against tools/spellweb/src/types/graph.ts):
//   valid types  : act | concept | skill | persona | document | spell | theorem | term | chronicle
//   valid layers : knowledge | narrative | chronicle
//   valid domains: shared | swordsman | mage | first_person
// ═══════════════════════════════════════════════════════════════

import type { RegistryItem, ChronicleEntry } from '../types/registry';
import { BLADE_NAMES } from '../types/registry';

// ── Output types ──

export type SpellwebNodeType = 'act' | 'concept' | 'skill' | 'persona' | 'document' | 'spell' | 'theorem' | 'term' | 'chronicle';
export type SpellwebLayer = 'knowledge' | 'narrative' | 'chronicle';
export type SpellwebDomain = 'shared' | 'swordsman' | 'mage' | 'first_person';

export interface NodeDimensions {
  d1Hide: number;
  d2Commit: number;
  d3Prove: number;
  d4Connect: number;
  d5Reflect: number;
  d6Delegate: number;
}

export interface HexagramInfo {
  bladeId: number;
  layer: number;
  layerName: string;
  yangCount: number;
  lines: [number, number, number, number, number, number];
}

export interface SpellwebNode {
  id: string;
  type: SpellwebNodeType;
  label: string;
  domain: SpellwebDomain;
  layer: SpellwebLayer;
  desc: string;
  hexagram?: HexagramInfo;
  poetic?: string;
  emoji?: string;
  dimensions?: NodeDimensions;
  tier?: number;
  category?: string;
  spellbook?: string;
}

export interface SpellwebEdge {
  source: string;
  target: string;
  type: string;
  vcDid?: string;        // did:cid of the VC backing this edge (when issued via Keymaster)
  issuerDid?: string;    // DID of the agent that signed the relationship claim
  issuanceDate?: string; // ISO timestamp from the VC
}

export interface TransmutationResult {
  nodes: SpellwebNode[];
  edges: SpellwebEdge[];
}

// ── Taxonomy constants ──

export const VALID_TYPES = new Set<string>(['act', 'concept', 'skill', 'persona', 'document', 'spell', 'theorem', 'term', 'chronicle']);
export const VALID_LAYERS = new Set<string>(['knowledge', 'narrative', 'chronicle']);
export const VALID_DOMAINS = new Set<string>(['shared', 'swordsman', 'mage', 'first_person']);

// ── Internal helpers ──

// Matches HEXAGRAM_LAYER_NAMES in tools/spellweb/src/types/graph.ts
const LAYER_NAMES = ['Null', 'Single-edge', 'Twin-edge', 'Triple-edge', 'Quad-edge', 'Penta-edge', 'Dragon'];

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
}

function computeHexagram(vertexId: number, stratum: number): HexagramInfo {
  const lines: [number, number, number, number, number, number] = [
    (vertexId >> 0) & 1,
    (vertexId >> 1) & 1,
    (vertexId >> 2) & 1,
    (vertexId >> 3) & 1,
    (vertexId >> 4) & 1,
    (vertexId >> 5) & 1,
  ];
  return {
    bladeId: vertexId,
    layer: stratum,
    layerName: LAYER_NAMES[stratum] ?? 'Unknown',
    yangCount: stratum,
    lines,
  };
}

function buildDimensions(v: number): NodeDimensions {
  return {
    d1Hide:     (v & 1)  ? 1.0 : 0.0,   // Protection
    d2Commit:   (v & 2)  ? 1.0 : 0.0,   // Delegation
    d3Prove:    (v & 4)  ? 1.0 : 0.0,   // Memory
    d4Connect:  (v & 8)  ? 1.0 : 0.0,   // Connection
    d5Reflect:  (v & 16) ? 1.0 : 0.0,   // Computation
    d6Delegate: (v & 32) ? 1.0 : 0.0,   // Value
  };
}

// Strip DID strings and capability/decomposition URNs from free text.
function blind(text: string | undefined, didBlind: boolean): string {
  if (!text) return '';
  if (!didBlind) return text;
  return text
    .replace(/did:[a-z]+:[a-zA-Z0-9]+/g, '[DID]')
    .replace(/urn:capability:[^\s,)]+/g, '[CAPABILITY]')
    .replace(/urn:decomposition:[^\s,)]+/g, '[DECOMP]');
}

// Resolve domain for a capability by inspecting its parent item.
// - Parent is a sovereign DID → swordsman
// - Parent is a transmuted DID → mage
// - Parent is a VC (decomposition node) → shared
function resolveCapabilityDomain(item: RegistryItem, items: RegistryItem[]): SpellwebDomain {
  if (!item.parentDid) return 'shared';
  const parent = items.find(i => i.did === item.parentDid);
  if (!parent) return 'shared';
  if (parent.type === 'vc') return 'shared';
  if (parent.type === 'did') {
    if (parent.role === 'sovereign') return 'swordsman';
    if (parent.role === 'transmuted') return 'mage';
  }
  return 'shared';
}

// Resolve domain for a schema by inspecting its controllerDid.
function resolveSchemaControllerDomain(item: RegistryItem, items: RegistryItem[]): SpellwebDomain {
  if (!item.controllerDid) return 'shared';
  const controller = items.find(i => i.did === item.controllerDid);
  if (!controller) return 'shared';
  if (controller.role === 'sovereign') return 'swordsman';
  if (controller.role === 'transmuted') return 'mage';
  return 'shared';
}

// ── Main export ──

export function transmuteToSpellweb(
  items: RegistryItem[],
  _chronicle: ChronicleEntry[],
  didBlind = true,
): TransmutationResult {
  const nodes: SpellwebNode[] = [];
  const edges: SpellwebEdge[] = [];

  // item.id → spellweb node id
  const idMap = new Map<string, string>();

  // ── Build nodes ──
  for (const item of items) {
    const v = item.vertexId;
    const s = item.stratum;
    const blade = BLADE_NAMES[v];
    const hexagram = computeHexagram(v, s);

    let node: SpellwebNode | null = null;

    const descText = blind(item.notes, didBlind) || '';
    const poeticText = item.poeticOverlay ? blind(item.poeticOverlay, didBlind) : undefined;

    // ── chronicle role → type="chronicle", layer="chronicle" ──
    if (item.role === 'chronicle') {
      node = {
        id: `chr-${slug(item.label)}-${v}`,
        type: 'chronicle',
        label: item.label,
        domain: 'swordsman',
        layer: 'chronicle',
        desc: descText,
        hexagram,
        ...(poeticText ? { poetic: poeticText } : {}),
        emoji: blade?.emoji ?? '📜',
      };
    }

    // ── asset → type="document", layer="narrative" ──
    else if (item.type === 'asset') {
      node = {
        id: `doc-${slug(item.label)}-${v}`,
        type: 'document',
        label: item.label,
        domain: 'swordsman',
        layer: 'narrative',
        desc: descText,
        hexagram,
        ...(poeticText ? { poetic: poeticText } : {}),
        emoji: blade?.emoji ?? '📄',
      };
    }

    // ── DID / persona ──
    else if (item.type === 'did') {
      const domain: SpellwebDomain = item.role === 'sovereign' ? 'swordsman'
                                   : item.role === 'transmuted' ? 'mage'
                                   : 'shared';
      node = {
        id: `per-${slug(item.label)}-${v}`,
        type: 'persona',
        label: item.label,
        domain,
        layer: 'knowledge',
        desc: descText,
        hexagram,
        ...(poeticText ? { poetic: poeticText } : {}),
        emoji: blade?.emoji ?? (item.role === 'sovereign' ? '☀' : '⚡'),
        dimensions: buildDimensions(v),
        ...(item.role === 'sovereign' ? { tier: 1 } : {}),
      };
    }

    // ── VC / spell ──
    else if (item.type === 'vc') {
      node = {
        id: `spell-${slug(item.label)}-${v}`,
        type: 'spell',
        label: item.label,
        domain: 'shared',
        layer: 'knowledge',
        desc: descText,
        hexagram,
        ...(poeticText ? { poetic: poeticText } : {}),
        emoji: '🤝',
      };
    }

    // ── schema / theorem ──
    else if (item.type === 'schema') {
      const domain = resolveSchemaControllerDomain(item, items);
      node = {
        id: `schema-${slug(item.label)}-${v}`,
        type: 'theorem',
        label: item.label,
        domain,
        layer: 'knowledge',
        desc: descText,
        hexagram,
        ...(poeticText ? { poetic: poeticText } : {}),
        emoji: '♾️',
      };
    }

    // ── capability / skill ──
    else if (item.type === 'capability') {
      const domain = resolveCapabilityDomain(item, items);
      node = {
        id: `skill-${slug(item.label)}-${v}`,
        type: 'skill',
        label: item.label,
        domain,
        layer: 'knowledge',
        desc: descText,
        hexagram,
        ...(poeticText ? { poetic: poeticText } : {}),
        emoji: '⚙️',
      };
    }

    if (node) {
      idMap.set(item.id, node.id);
      nodes.push(node);
    }
  }

  // ── Build edges from relationship fields ──
  for (const item of items) {
    const sourceId = idMap.get(item.id);
    if (!sourceId) continue;

    if (item.type === 'vc') {
      // Archon VC metadata — carried on every edge originating from this VC
      const vcMeta: Pick<SpellwebEdge, 'vcDid' | 'issuerDid' | 'issuanceDate'> = {};
      if (item.vcPayload) {
        const vc = item.vcPayload as { issuanceDate?: string };
        vcMeta.vcDid = blind(item.did, didBlind);
        vcMeta.issuerDid = blind(item.issuerDid, didBlind);
        vcMeta.issuanceDate = vc.issuanceDate;
      }

      // VC → Schema: proves
      if (item.schemaDid) {
        const schemaItem = items.find(i => i.did === item.schemaDid);
        const targetId = schemaItem ? idMap.get(schemaItem.id) : undefined;
        if (targetId) edges.push({ source: sourceId, target: targetId, type: 'proves', ...vcMeta });
      }
      // Issuer → VC: generates
      if (item.issuerDid) {
        const issuerItem = items.find(i => i.did === item.issuerDid);
        const issuerNodeId = issuerItem ? idMap.get(issuerItem.id) : undefined;
        if (issuerNodeId) edges.push({ source: issuerNodeId, target: sourceId, type: 'generates', ...vcMeta });
      }
      // VC → Subject: relates_to
      if (item.subjectDid) {
        const subjectItem = items.find(i => i.did === item.subjectDid);
        const targetId = subjectItem ? idMap.get(subjectItem.id) : undefined;
        if (targetId) edges.push({ source: sourceId, target: targetId, type: 'relates_to', ...vcMeta });
      }
    }

    // Capability → parent (DID or VC): manifests_as
    if (item.type === 'capability' && item.parentDid) {
      const parentItem = items.find(i => i.did === item.parentDid);
      const parentNodeId = parentItem ? idMap.get(parentItem.id) : undefined;
      if (parentNodeId) edges.push({ source: parentNodeId, target: sourceId, type: 'manifests_as' });
    }

    // Schema → controller: OMITTED
    // The domain enrichment (swordsman/mage) carries the structural meaning.
    // No edge type exists in the upstream taxonomy for this relationship.
  }

  // Chronicle sequential edges (older ← newer: newer "follows" older)
  const chronicleItems = items.filter(i => i.role === 'chronicle');
  chronicleItems.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (let i = 1; i < chronicleItems.length; i++) {
    const prevId = idMap.get(chronicleItems[i - 1].id);
    const currId = idMap.get(chronicleItems[i].id);
    if (prevId && currId) edges.push({ source: currId, target: prevId, type: 'follows' });
  }

  return { nodes, edges };
}

// ── File generators (used by CLI) ──

function serializeNode(n: SpellwebNode): string {
  const fields: string[] = [
    `    id: ${JSON.stringify(n.id)},`,
    `    type: ${JSON.stringify(n.type)},`,
    `    label: ${JSON.stringify(n.label)},`,
    `    domain: ${JSON.stringify(n.domain)},`,
    `    layer: ${JSON.stringify(n.layer)},`,
    `    desc: ${JSON.stringify(n.desc)},`,
    ...(n.hexagram
      ? [`    hexagram: { bladeId: ${n.hexagram.bladeId}, layer: ${n.hexagram.layer}, layerName: ${JSON.stringify(n.hexagram.layerName)}, yangCount: ${n.hexagram.yangCount}, lines: [${n.hexagram.lines.join(', ')}] },`]
      : []),
  ];
  if (n.poetic !== undefined) fields.push(`    poetic: ${JSON.stringify(n.poetic)},`);
  if (n.emoji !== undefined)  fields.push(`    emoji: ${JSON.stringify(n.emoji)},`);
  if (n.dimensions !== undefined) {
    const dimStr = Object.entries(n.dimensions).map(([k, v]) => `${k}: ${v}`).join(', ');
    fields.push(`    dimensions: { ${dimStr} },`);
  }
  if (n.tier !== undefined) fields.push(`    tier: ${n.tier},`);
  return `  {\n${fields.join('\n')}\n  }`;
}

export function generateNodesTs(
  nodes: SpellwebNode[],
  sourceName: string,
  didBlind: boolean,
  timestamp: string,
): string {
  const nodeLines = nodes.map(serializeNode).join(',\n');
  return `// AUTO-GENERATED by transmute-to-spellweb — DO NOT EDIT BY HAND
// Source: ${sourceName}
// Generated: ${timestamp}
// Nodes: ${nodes.length} | DID-Blind: ${didBlind}
// Layer 3 of the Sovereign Anchor cloaking demo (anonymized public layer)

import type { SpellwebNode } from '../types/graph';

export const NODES: SpellwebNode[] = [
${nodeLines}
];
`;
}

export function generateEdgesTs(
  edges: SpellwebEdge[],
  sourceName: string,
  didBlind: boolean,
  timestamp: string,
): string {
  const edgeLines = edges
    .map(e => `  { source: ${JSON.stringify(e.source)}, target: ${JSON.stringify(e.target)}, type: ${JSON.stringify(e.type)} }`)
    .join(',\n');
  return `// AUTO-GENERATED by transmute-to-spellweb — DO NOT EDIT BY HAND
// Source: ${sourceName}
// Generated: ${timestamp}
// Edges: ${edges.length} | DID-Blind: ${didBlind}

import type { SpellwebEdge } from '../types/graph';

export const EDGES: SpellwebEdge[] = [
${edgeLines}
];
`;
}

// ── Safety checks ──

export function containsDids(content: string): boolean {
  return /did:[a-z]+:[a-zA-Z0-9]+/.test(content);
}

export interface TaxonomyViolation {
  nodeId: string;
  field: string;
  value: string;
  message: string;
}

export function checkTaxonomy(nodes: SpellwebNode[]): TaxonomyViolation[] {
  const violations: TaxonomyViolation[] = [];
  for (const node of nodes) {
    if (!VALID_TYPES.has(node.type)) {
      violations.push({ nodeId: node.id, field: 'type', value: node.type, message: `Invalid type "${node.type}" — must be one of: ${[...VALID_TYPES].join(', ')}` });
    }
    if (!VALID_LAYERS.has(node.layer)) {
      violations.push({ nodeId: node.id, field: 'layer', value: node.layer, message: `Invalid layer "${node.layer}" — must be one of: ${[...VALID_LAYERS].join(', ')}` });
    }
    if (!VALID_DOMAINS.has(node.domain)) {
      violations.push({ nodeId: node.id, field: 'domain', value: node.domain, message: `Invalid domain "${node.domain}" — must be one of: ${[...VALID_DOMAINS].join(', ')}` });
    }
  }
  return violations;
}
