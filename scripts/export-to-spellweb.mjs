#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// EXPORT-TO-SPELLWEB TRANSFORMER
// Converts spellweb-registry JSON export → spellweb.ai TypeScript modules
// Usage: node scripts/export-to-spellweb.mjs <registry-export.json> [contributor-name]
// ═══════════════════════════════════════════════════════════════

import * as fs from 'fs';

const HEXAGRAM_LAYER_NAMES = {
  0: 'Null',
  1: 'Single-edge',
  2: 'Twin-edge',
  3: 'Triple-edge',
  4: 'Quad-edge',
  5: 'Penta-edge',
  6: 'Dragon',
};

function typeToNodeType(type, role) {
  if (role === 'chronicle') return 'chronicle';
  switch (type) {
    case 'did': return 'persona';
    case 'vc': return 'spell';
    case 'schema': return 'theorem';
    case 'capability': return 'skill';
    default: return 'concept';
  }
}

function roleToDomain(role) {
  switch (role) {
    case 'sovereign': return 'first_person';
    case 'issuer':
    case 'verifier': return 'swordsman';
    case 'transmuted':
    case 'schema':
    default: return 'shared';
  }
}

function typeToLayer(type, role) {
  if (role === 'chronicle') return 'chronicle';
  return 'knowledge';
}

function vertexToDimensions(vertexId) {
  return {
    d1Hide:    (vertexId & 1)  ? 1.0 : 0.0,
    d2Commit:  (vertexId & 2)  ? 1.0 : 0.0,
    d3Prove:   (vertexId & 4)  ? 1.0 : 0.0,
    d4Connect: (vertexId & 8)  ? 1.0 : 0.0,
    d5Reflect: (vertexId & 16) ? 1.0 : 0.0,
    d6Delegate:(vertexId & 32) ? 1.0 : 0.0,
  };
}

function computeHexagramInfo(vertexId) {
  const d = vertexToDimensions(vertexId);
  const lines = [
    d.d1Hide >= 0.5 ? 1 : 0,
    d.d2Commit >= 0.5 ? 1 : 0,
    d.d3Prove >= 0.5 ? 1 : 0,
    d.d4Connect >= 0.5 ? 1 : 0,
    d.d5Reflect >= 0.5 ? 1 : 0,
    d.d6Delegate >= 0.5 ? 1 : 0,
  ];
  const yangCount = lines.reduce((s, l) => s + l, 0);
  const bladeId = lines[0] + lines[1]*2 + lines[2]*4 + lines[3]*8 + lines[4]*16 + lines[5]*32;
  return {
    lines,
    bladeId,
    layer: yangCount,
    layerName: HEXAGRAM_LAYER_NAMES[yangCount],
    yangCount,
  };
}

function sanitizeId(id) {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function makeNodeId(item) {
  const prefixMap = {
    did: 'per',
    vc: 'spell',
    schema: 'thm',
    capability: 'skill',
  };
  const prefix = prefixMap[item.type] || 'thm';
  const base = sanitizeId(item.label);
  return `${prefix}-${base}-${item.vertexId}`;
}

function buildDesc(item) {
  const parts = [];
  if (item.notes) parts.push(item.notes);
  parts.push(`DID: ${item.did}`);
  parts.push(`Vertex: ${item.vertexId} (stratum ${item.stratum})`);
  if (item.role) parts.push(`Role: ${item.role}`);
  if (item.tags?.length) parts.push(`Tags: ${item.tags.join(', ')}`);
  parts.push(`Registered: ${item.createdAt}`);
  return parts.join('. ');
}

function transform(data) {
  const nodes = [];
  const edges = [];

  const didToNodeId = new Map();
  const itemIdToNodeId = new Map();

  // Pass 1: Create all nodes
  for (const item of data.items) {
    const swType = typeToNodeType(item.type, item.role);
    const nodeId = makeNodeId(item);
    itemIdToNodeId.set(item.id, nodeId);
    didToNodeId.set(item.did, nodeId);

    const node = {
      id: nodeId,
      type: swType,
      label: item.label,
      domain: roleToDomain(item.role),
      layer: typeToLayer(item.type, item.role),
      desc: buildDesc(item),
      dimensions: vertexToDimensions(item.vertexId),
      hexagram: computeHexagramInfo(item.vertexId),
    };

    if (item.type === 'did' && item.role === 'sovereign') {
      node.tier = 1;
    }

    // V5.4 enrichment for chronicles and canonical personas
    if (item.role === 'chronicle') {
      node.version = '5.4';
      node.spellbook = 'first_person';
      if (item.tags?.includes('transmutation')) {
        node.proverb = 'One mirror sees; two mirrors make a door.';
      }
      if (item.tags?.includes('boundary-blade')) {
        node.proverb = 'The boundary is always enough.';
      }
    }

    // Mark canonical personas with version
    if (item.type === 'did' && item.role === 'transmuted') {
      node.version = '5.4';
      node.category = 'persona';
    }

    nodes.push(node);
  }

  // Pass 2: Create edges from VC relationships (schema, issuer, subject)
  for (const item of data.items) {
    if (item.type !== 'vc') continue;
    const vcNodeId = itemIdToNodeId.get(item.id);
    if (!vcNodeId) continue;

    if (item.schemaDid) {
      const schemaNodeId = didToNodeId.get(item.schemaDid);
      if (schemaNodeId) {
        edges.push({ source: vcNodeId, target: schemaNodeId, type: 'proves' });
      }
    }

    if (item.issuerDid) {
      const issuerNodeId = didToNodeId.get(item.issuerDid);
      if (issuerNodeId) {
        edges.push({ source: issuerNodeId, target: vcNodeId, type: 'generates' });
      }
    }

    if (item.subjectDid) {
      const subjectNodeId = didToNodeId.get(item.subjectDid);
      if (subjectNodeId) {
        edges.push({ source: vcNodeId, target: subjectNodeId, type: 'relates_to' });
      }
    }
  }

  // Pass 3: Chronicle sequential edges (follows)
  const chronicles = data.items
    .filter(i => i.role === 'chronicle')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (let i = 1; i < chronicles.length; i++) {
    const prevNodeId = itemIdToNodeId.get(chronicles[i - 1].id);
    const currNodeId = itemIdToNodeId.get(chronicles[i].id);
    if (prevNodeId && currNodeId) {
      edges.push({ source: currNodeId, target: prevNodeId, type: 'follows' });
    }
  }

  // Pass 4: Blade name nodes (canonical only)
  if (data.bladeNames) {
    for (const [bladeIdStr, blade] of Object.entries(data.bladeNames)) {
      const bladeId = parseInt(bladeIdStr, 10);
      if (!blade.isCanonical) continue;

      const bladeNodeId = `blade-${bladeId}`;
      const hex = computeHexagramInfo(bladeId);

      nodes.push({
        id: bladeNodeId,
        type: 'concept',
        label: `${blade.emoji} ${blade.name}`,
        domain: 'shared',
        layer: 'knowledge',
        desc: `Canonical blade name for vertex ${bladeId}. ${blade.source || 'PrivacyMage Reference Sheet'}. Stratum ${hex.layer} (${hex.layerName}).`,
        emoji: blade.emoji,
        dimensions: vertexToDimensions(bladeId),
        hexagram: hex,
      });

      for (const item of data.items) {
        if (item.vertexId === bladeId) {
          const itemNodeId = itemIdToNodeId.get(item.id);
          if (itemNodeId) {
            edges.push({ source: bladeNodeId, target: itemNodeId, type: 'names' });
          }
        }
      }
    }
  }

  return { nodes, edges };
}

function formatNode(node) {
  const fields = [];
  fields.push(`id: "${node.id}"`);
  fields.push(`type: "${node.type}"`);
  fields.push(`label: "${node.label}"`);
  fields.push(`domain: "${node.domain}"`);
  fields.push(`layer: "${node.layer}"`);
  fields.push(`desc: "${node.desc.replace(/"/g, '\\"')}"`);
  if (node.version) fields.push(`version: "${node.version}"`);
  if (node.tier !== undefined) fields.push(`tier: ${node.tier}`);
  if (node.emoji) fields.push(`emoji: "${node.emoji}"`);
  if (node.proverb) fields.push(`proverb: "${node.proverb}"`);
  if (node.spellbook) fields.push(`spellbook: "${node.spellbook}"`);
  if (node.category) fields.push(`category: "${node.category}"`);

  if (node.dimensions) {
    const d = node.dimensions;
    fields.push(`dimensions: { d1Hide: ${d.d1Hide}, d2Commit: ${d.d2Commit}, d3Prove: ${d.d3Prove}, d4Connect: ${d.d4Connect}, d5Reflect: ${d.d5Reflect}, d6Delegate: ${d.d6Delegate} }`);
  }

  if (node.hexagram) {
    const h = node.hexagram;
    fields.push(`hexagram: { lines: [${h.lines.join(', ')}], bladeId: ${h.bladeId}, layer: ${h.layer}, layerName: "${h.layerName}", yangCount: ${h.yangCount} }`);
  }

  return `  { ${fields.join(', ')} }`;
}

function formatEdge(edge) {
  return `  { source: "${edge.source}", target: "${edge.target}", type: "${edge.type}" }`;
}

function generateOutput(nodes, edges, contributor) {
  const timestamp = new Date().toISOString();

  return `import type { SpellwebNode } from '../types/graph';
import type { SpellwebEdge } from '../types/graph';

// ═══════════════════════════════════════════════════════════════
// REGISTRY CONTRIBUTION — Generated from spellweb-registry export
// Contributor: ${contributor}
// Generated: ${timestamp}
// Nodes: ${nodes.length} | Edges: ${edges.length}
// ═══════════════════════════════════════════════════════════════

export const REGISTRY_NODES: SpellwebNode[] = [
${nodes.map(formatNode).join(',\n')}
];

export const REGISTRY_EDGES: SpellwebEdge[] = [
${edges.map(formatEdge).join(',\n')}
];
`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/export-to-spellweb.mjs <registry-export.json> [contributor-name]');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/export-to-spellweb.mjs registry-export.json flaxscrip > spellweb-contribution.ts');
    process.exit(1);
  }

  const [jsonPath, contributor = 'anonymous'] = args;

  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: File not found: ${jsonPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`Error: Invalid JSON in ${jsonPath}`);
    process.exit(1);
  }

  const { nodes, edges } = transform(data);
  const output = generateOutput(nodes, edges, contributor);

  console.log(output);
}

main();
