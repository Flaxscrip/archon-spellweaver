import { useState, useMemo } from 'react';
import type { RegistryItem, ChronicleEntry } from '../types/registry';
import {
  transmuteToSpellweb,
  generateNodesTs,
  generateEdgesTs,
  type SpellwebNode,
  type SpellwebEdge,
} from '../lib/transmute';
import { useKeymaster } from '../contexts/KeymasterContext';

interface PublishPanelProps {
  items: RegistryItem[];
  chronicle: ChronicleEntry[];
  onClose: () => void;
}

export function PublishPanel({ items, chronicle, onClose }: PublishPanelProps) {
  const [didBlind, setDidBlind] = useState(true);
  const [showPreview, setShowPreview] = useState<'nodes' | 'edges' | 'module'>('nodes');
  const [vaultStatus, setVaultStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [vaultItemName, setVaultItemName] = useState<string | null>(null);
  const { walletState, saveToWeaverVault } = useKeymaster();

  const { nodes, edges, tsModule } = useMemo(() => {
    const ts = new Date().toISOString();
    const { nodes, edges } = transmuteToSpellweb(items, chronicle, didBlind);
    const nodesTs = generateNodesTs(nodes, 'spellweb-registry (UI)', didBlind, ts);
    const edgesTs = generateEdgesTs(edges, 'spellweb-registry (UI)', didBlind, ts);
    const tsModule = nodesTs + '\n' + edgesTs;
    return { nodes, edges, tsModule };
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

  const handleSaveToVault = async () => {
    setVaultStatus('saving');
    const now = new Date();
    const d = now.toISOString().slice(0, 10).replace(/-/g, '');
    const t = now.toISOString().slice(11, 19).replace(/:/g, '');
    const name = `weaver-${d}-${t}.json`;
    const snapshot = JSON.stringify({ exportedAt: now.toISOString(), didBlind, nodes, edges }, null, 2);
    try {
      await saveToWeaverVault(name, snapshot);
      setVaultItemName(name);
      setVaultStatus('saved');
      setTimeout(() => setVaultStatus('idle'), 4000);
    } catch (err) {
      console.error('[weaver-vault] save failed:', err);
      setVaultStatus('error');
      setTimeout(() => setVaultStatus('idle'), 4000);
    }
  };

  const nodeCounts = {
    persona:   nodes.filter(n => n.type === 'persona').length,
    spell:     nodes.filter(n => n.type === 'spell').length,
    theorem:   nodes.filter(n => n.type === 'theorem').length,
    skill:     nodes.filter(n => n.type === 'skill').length,
    chronicle: nodes.filter(n => n.type === 'chronicle').length,
    document:  nodes.filter(n => n.type === 'document').length,
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
        <div className="grid grid-cols-6 gap-2 px-6 py-3 border-b border-border bg-bg-primary">
          <StatBox label="Personas"   value={nodeCounts.persona}   color="text-purple-400" />
          <StatBox label="Spells"     value={nodeCounts.spell}     color="text-amber-400" />
          <StatBox label="Theorems"   value={nodeCounts.theorem}   color="text-cyan-400" />
          <StatBox label="Skills"     value={nodeCounts.skill}     color="text-emerald-400" />
          <StatBox label="Chronicles" value={nodeCounts.chronicle} color="text-rose-400" />
          <StatBox label="Documents"  value={nodeCounts.document}  color="text-blue-400" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {showPreview === 'nodes' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {nodes.length === 0 ? (
                <div className="text-center text-text-dim/50 py-12 italic">No transmutable items found.</div>
              ) : (
                nodes.map((node: SpellwebNode) => (
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
                edges.map((edge: SpellwebEdge, i: number) => (
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
                <button
                  onClick={handleSaveToVault}
                  disabled={walletState !== 'unlocked' || vaultStatus === 'saving'}
                  title={walletState !== 'unlocked' ? 'Connect wallet to save to vault' : 'Save snapshot to Weaver Vault'}
                  className="btn text-xs flex-1 transition-colors"
                  style={{
                    background: vaultStatus === 'saved' ? 'var(--success)' : vaultStatus === 'error' ? 'var(--danger)' : 'var(--accent)',
                    color: '#000',
                    opacity: walletState !== 'unlocked' ? 0.4 : 1,
                    cursor: walletState !== 'unlocked' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {vaultStatus === 'saving' ? '⏳ Saving…' : vaultStatus === 'saved' ? '✓ Saved' : vaultStatus === 'error' ? '✗ Error' : '🔒 Save to Vault'}
                </button>
              </div>
              {vaultStatus === 'saved' && vaultItemName && (
                <div className="px-4 pb-3 text-[10px] text-text-dim font-mono">
                  Saved as <span className="text-accent">{vaultItemName}</span> in Weaver Vault
                </div>
              )}
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
    persona:   '👤',
    spell:     '✨',
    theorem:   '📐',
    skill:     '⚙️',
    chronicle: '📜',
    document:  '📄',
    act:       '🎭',
    concept:   '💡',
    term:      '🔤',
  };
  return map[type] || '○';
}

