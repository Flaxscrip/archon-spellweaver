import { useState, useMemo } from 'react';
import type { RegistryItem, ChronicleEntry } from '../types/registry';
import { getStratum, BLADE_NAMES } from '../types/registry';

interface PublishPanelProps {
  items: RegistryItem[];
  chronicle: ChronicleEntry[];
  onClose: () => void;
}

export function PublishPanel({ items, chronicle, onClose }: PublishPanelProps) {
  const [didBlind, setDidBlind] = useState(true);
  const [showPreview, setShowPreview] = useState<'nodes' | 'edges' | 'module'>('nodes');

  const { nodes, edges, tsModule } = useMemo(() => {
    return transmuteToSpellweb(items, chronicle, didBlind);
  }, [items, chronicle, didBlind]);

  const handleDownload = () => {
    const blob = new Blob([tsModule], { type: 'application/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spellweb-contribution-${new Date().toISOString().slice(0, 10)}.ts`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tsModule);
  };

  const nodeCounts = {
    persona: nodes.filter(n => n.type === 'persona').length,
    spell: nodes.filter(n => n.type === 'spell').length,
    theorem: nodes.filter(n => n.type === 'theorem').length,
    skill: nodes.filter(n => n.type === 'skill').length,
    chronicle: nodes.filter(n => n.type === 'chronicle').length,
  };

  const edgeCounts = {
    generates: edges.filter(e => e.type === 'generates').length,
    proves: edges.filter(e => e.type === 'proves').length,
    relates_to: edges.filter(e => e.type === 'relates_to').length,
    follows: edges.filter(e => e.type === 'follows').length,
    manifests_as: edges.filter(e => e.type === 'manifests_as').length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="w-full max-w-4xl max-h-[90vh] bg-bg-panel border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-text-bright">📤 Publish to Spellweb</h2>
            <p className="text-xs text-text-dim mt-0.5">Transmute your registry into spellweb.ai format</p>
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-danger text-xl leading-none">×</button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-bg-card">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={didBlind}
              onChange={e => setDidBlind(e.target.checked)}
              className="accent-accent"
            />
            <span className={didBlind ? 'text-accent' : 'text-text-dim'}>
              🔒 DID-Blind (strip cryptographic addresses)
            </span>
          </label>

          <div className="flex gap-1 ml-auto">
            {(['nodes', 'edges', 'module'] as const).map(key => (
              <button
                key={key}
                onClick={() => setShowPreview(key)}
                className={`px-3 py-1 rounded text-xs font-mono capitalize transition-all ${
                  showPreview === key
                    ? 'bg-accent/20 text-accent border border-accent/40'
                    : 'text-text-dim hover:text-text-primary border border-transparent'
                }`}
              >
                {key === 'module' ? 'TS Module' : key}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-2 px-6 py-3 border-b border-border bg-bg-primary">
          <StatBox label="Personas" value={nodeCounts.persona} color="text-purple-400" />
          <StatBox label="Spells" value={nodeCounts.spell} color="text-amber-400" />
          <StatBox label="Theorems" value={nodeCounts.theorem} color="text-cyan-400" />
          <StatBox label="Skills" value={nodeCounts.skill} color="text-emerald-400" />
          <StatBox label="Chronicles" value={nodeCounts.chronicle} color="text-rose-400" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {showPreview === 'nodes' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {nodes.length === 0 ? (
                <div className="text-center text-text-dim/50 py-12 italic">No transmutable items found.</div>
              ) : (
                nodes.map(node => (
                  <div key={node.id} className="flex items-start gap-3 p-3 rounded border border-border/50 hover:border-border bg-bg-card text-xs">
                    <span className="mt-0.5">{typeEmoji(node.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-text-bright">{node.id}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-bg-primary border border-border text-text-dim">{node.type}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-bg-primary border border-border text-text-dim">{node.domain}</span>
                      </div>
                      <div className="mt-1 text-text-primary">{node.label}</div>
                      {node.poetic && (
                        <div className="mt-1.5 text-text-dim/70 italic whitespace-pre-line pl-3 border-l-2 border-purple-500/30">
                          {node.poetic.slice(0, 120)}{node.poetic.length > 120 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {showPreview === 'edges' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {edges.length === 0 ? (
                <div className="text-center text-text-dim/50 py-12 italic">No edges generated.</div>
              ) : (
                edges.map((edge, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded border border-border/50 hover:border-border bg-bg-card text-xs">
                    <span className="font-mono text-text-bright truncate max-w-[180px]">{edge.source}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent/10 text-accent border border-accent/20">
                      → {edge.type} →
                    </span>
                    <span className="font-mono text-text-bright truncate max-w-[180px]">{edge.target}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {showPreview === 'module' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 bg-bg-primary">
                <pre className="text-[11px] font-mono text-text-dim/80 whitespace-pre-wrap leading-relaxed">
                  {tsModule}
                </pre>
              </div>
              <div className="flex gap-2 p-4 border-t border-border bg-bg-panel">
                <button onClick={handleDownload} className="btn btn-primary text-xs flex-1">
                  📥 Download .ts
                </button>
                <button onClick={handleCopy} className="btn btn-secondary text-xs flex-1">
                  📋 Copy to Clipboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-2 rounded bg-bg-card border border-border">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-text-dim uppercase tracking-wider">{label}</div>
    </div>
  );
}

function typeEmoji(type: string): string {
  const map: Record<string, string> = {
    persona: '👤',
    spell: '✨',
    theorem: '📐',
    skill: '⚙️',
    chronicle: '📜',
  };
  return map[type] || '○';
}

// ═════════════════════════════════════════════════════════════════════════════════════
// TRANSMUTATION ENGINE
// ═════════════════════════════════════════════════════════════════════════════════════

interface SpellwebNode {
  id: string;
  type: 'persona' | 'spell' | 'theorem' | 'skill' | 'chronicle';
  label: string;
  domain: string;
  layer: string;
  desc: string;
  hexagram?: { bladeId: number; layer: number; layerName: string };
  poetic?: string;
  emoji?: string;
  dimensions?: Record<string, number>;
  tier?: number;
}

interface SpellwebEdge {
  source: string;
  target: string;
  type: string;
}

function transmuteToSpellweb(
  items: RegistryItem[],
  _chronicle: ChronicleEntry[],
  didBlind: boolean
): { nodes: SpellwebNode[]; edges: SpellwebEdge[]; tsModule: string } {
  const nodes: SpellwebNode[] = [];
  const edges: SpellwebEdge[] = [];

  // Map from registry item id → spellweb node id
  const idMap = new Map<string, string>();

  // Helper: strip DID strings from text
  const blind = (text?: string) => {
    if (!text || !didBlind) return text || '';
    return text
      .replace(/did:\w+:[a-z0-9]+/gi, '[DID]')
      .replace(/urn:capability:[^\s]+/gi, '[CAPABILITY]');
  };

  // ── Build nodes ──
  items.forEach(item => {
    const v = item.vertexId;
    const s = item.stratum;
    const layerNames = ['Void', 'Single-edge', 'Twin-edge', 'Triple-edge', 'Quad-edge', 'Pent-edge', 'Dragon'];
    const blade = BLADE_NAMES[v];

    let node: SpellwebNode;

    // Determine type based on registry type + role
    if (item.role === 'chronicle') {
      node = {
        id: `chronicle-${slug(item.label)}-${v}`,
        type: 'chronicle',
        label: item.label,
        domain: 'shared',
        layer: 'chronicle',
        desc: blind(item.notes),
        hexagram: { bladeId: v, layer: s, layerName: layerNames[s] },
        poetic: item.poeticOverlay ? blind(item.poeticOverlay) : undefined,
        emoji: blade?.emoji || '📜',
      };
    } else {
      switch (item.type) {
        case 'did': {
          const isSovereign = item.role === 'sovereign';
          node = {
            id: `per-${slug(item.label)}-${v}`,
            type: 'persona',
            label: item.label,
            domain: isSovereign ? 'first_person' : 'shared',
            layer: 'knowledge',
            desc: blind(item.notes),
            hexagram: { bladeId: v, layer: s, layerName: layerNames[s] },
            poetic: item.poeticOverlay ? blind(item.poeticOverlay) : undefined,
            emoji: blade?.emoji || (isSovereign ? '☀' : '⚡'),
            dimensions: buildDimensions(v),
            tier: isSovereign ? 1 : undefined,
          };
          break;
        }
        case 'vc': {
          node = {
            id: `spell-${slug(item.label)}-${v}`,
            type: 'spell',
            label: item.label,
            domain: 'shared',
            layer: 'knowledge',
            desc: blind(item.notes),
            hexagram: { bladeId: v, layer: s, layerName: layerNames[s] },
            poetic: item.poeticOverlay ? blind(item.poeticOverlay) : undefined,
            emoji: '🤝',
          };
          break;
        }
        case 'schema': {
          node = {
            id: `schema-${slug(item.label)}-${v}`,
            type: 'theorem',
            label: item.label,
            domain: item.role === 'sovereign' ? 'first_person' : 'shared',
            layer: 'knowledge',
            desc: blind(item.notes),
            hexagram: { bladeId: v, layer: s, layerName: layerNames[s] },
            poetic: item.poeticOverlay ? blind(item.poeticOverlay) : undefined,
            emoji: '♾️',
          };
          break;
        }
        case 'asset': {
          node = {
            id: `asset-${slug(item.label)}-${v}`,
            type: 'chronicle',
            label: item.label,
            domain: 'shared',
            layer: 'chronicle',
            desc: blind(item.notes),
            hexagram: { bladeId: v, layer: s, layerName: layerNames[s] },
            poetic: item.poeticOverlay ? blind(item.poeticOverlay) : undefined,
            emoji: blade?.emoji || '📜',
          };
          break;
        }
        case 'capability': {
          node = {
            id: `skill-${slug(item.label)}-${v}`,
            type: 'skill',
            label: item.label,
            domain: 'shared',
            layer: 'knowledge',
            desc: blind(item.notes),
            hexagram: { bladeId: v, layer: s, layerName: layerNames[s] },
            poetic: item.poeticOverlay ? blind(item.poeticOverlay) : undefined,
            emoji: '⚙️',
          };
          break;
        }
        default: return;
      }
    }

    idMap.set(item.id, node.id);
    nodes.push(node);
  });

  // ── Build edges from VC relationships ──
  items.forEach(item => {
    const sourceId = idMap.get(item.id);
    if (!sourceId) return;

    if (item.type === 'vc') {
      // VC → Schema: proves
      if (item.schemaDid) {
        const schemaItem = items.find(i => i.did === item.schemaDid);
        if (schemaItem) {
          const targetId = idMap.get(schemaItem.id);
          if (targetId) edges.push({ source: sourceId, target: targetId, type: 'proves' });
        }
      }
      // Issuer → VC: generates
      if (item.issuerDid) {
        const issuerItem = items.find(i => i.did === item.issuerDid);
        if (issuerItem) {
          const issuerNodeId = idMap.get(issuerItem.id);
          if (issuerNodeId) edges.push({ source: issuerNodeId, target: sourceId, type: 'generates' });
        }
      }
      // VC → Subject: relates_to
      if (item.subjectDid) {
        const subjectItem = items.find(i => i.did === item.subjectDid);
        if (subjectItem) {
          const targetId = idMap.get(subjectItem.id);
          if (targetId) edges.push({ source: sourceId, target: targetId, type: 'relates_to' });
        }
      }
    }

    // Capability → Parent DID: manifests_as
    if (item.type === 'capability' && item.parentDid) {
      const parentItem = items.find(i => i.did === item.parentDid);
      if (parentItem) {
        const parentNodeId = idMap.get(parentItem.id);
        if (parentNodeId) edges.push({ source: parentNodeId, target: sourceId, type: 'manifests_as' });
      }
    }
  });

  // Chronicle sequential edges (by createdAt)
  const chronicleItems = items.filter(i => i.role === 'chronicle' || i.type === 'asset');
  chronicleItems.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (let i = 1; i < chronicleItems.length; i++) {
    const prevId = idMap.get(chronicleItems[i - 1].id);
    const currId = idMap.get(chronicleItems[i].id);
    if (prevId && currId) {
      edges.push({ source: currId, target: prevId, type: 'follows' });
    }
  }

  // ── Generate TS module string ──
  const tsModule = generateTsModule(nodes, edges, items.length, didBlind);

  return { nodes, edges, tsModule };
}

function buildDimensions(v: number): Record<string, number> {
  const d = {
    d1Protection: (v & 1) ? 1.0 : 0.0,
    d2Delegation: (v & 2) ? 1.0 : 0.0,
    d3Memory: (v & 4) ? 1.0 : 0.0,
    d4Connection: (v & 8) ? 1.0 : 0.0,
    d5Computation: (v & 16) ? 1.0 : 0.0,
    d6Value: (v & 32) ? 1.0 : 0.0,
  };
  return d;
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
}

function generateTsModule(
  nodes: SpellwebNode[],
  edges: SpellwebEdge[],
  sourceCount: number,
  didBlind: boolean
): string {
  const nodeLines = nodes.map(n => {
    const fields: string[] = [
      `    id: "${n.id}",`,
      `    type: "${n.type}",`,
      `    label: "${n.label}",`,
      `    domain: "${n.domain}",`,
      `    layer: "${n.layer}",`,
      `    desc: "${n.desc}",`,
    ];
    if (n.hexagram) {
      fields.push(`    hexagram: { bladeId: ${n.hexagram.bladeId}, layer: ${n.hexagram.layer}, layerName: "${n.hexagram.layerName}" },`);
    }
    if (n.poetic) {
      const escaped = n.poetic.replace(/"/g, '\\"').split('\n').join('\\n" +\n      "');
      fields.push(`    poetic: "${escaped}",`);
    }
    if (n.emoji) fields.push(`    emoji: "${n.emoji}",`);
    if (n.dimensions) {
      const d = n.dimensions;
      fields.push(`    dimensions: { d1Protection: ${d.d1Protection}, d2Delegation: ${d.d2Delegation}, d3Memory: ${d.d3Memory}, d4Connection: ${d.d4Connection}, d5Computation: ${d.d5Computation}, d6Value: ${d.d6Value} },`);
    }
    if (n.tier) fields.push(`    tier: ${n.tier},`);
    return `  {\n${fields.join('\n')}\n  }`;
  });

  const edgeLines = edges.map(e =>
    `  { source: "${e.source}", target: "${e.target}", type: "${e.type}" }`
  );

  return `// ═════════════════════════════════════════════════════════════════════════════════════
// TRANSMUTATION: spellweb-registry → spellweb.ai upstream
// Generated: ${new Date().toISOString()}
// Source Items: ${sourceCount} | Nodes: ${nodes.length} | Edges: ${edges.length}
// DID-Blind: ${didBlind ? 'true' : 'false'}
// ═════════════════════════════════════════════════════════════════════════════════════

export const REGISTRY_NODES = [
${nodeLines.join(',\n')}
];

export const REGISTRY_EDGES = [
${edgeLines.join(',\n')}
];
`;
}
