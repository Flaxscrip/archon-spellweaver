import { useState } from 'react';
import type { ChronicleEntry, RegistryItem } from '../types/registry';
import { getVertexLabel, getStratumColor } from '../types/registry';

interface ChroniclePanelProps {
  entries: ChronicleEntry[];
  items: RegistryItem[];
  onClose: () => void;
  onSelectVertex: (v: number) => void;
  onHoverLine?: (vertices: Set<number>) => void;
}

export function ChroniclePanel({
  entries,
  items,
  onClose,
  onSelectVertex,
  onHoverLine,
}: ChroniclePanelProps) {
  const [viewMode, setViewMode] = useState<'technical' | 'poetic' | 'both'>('both');

  // Compute all vertices connected to a given item
  const getConnectedVertices = (entry: ChronicleEntry): Set<number> => {
    const verts = new Set<number>();
    if (entry.vertexId !== null) verts.add(entry.vertexId);
    if (!entry.itemId) return verts;

    const item = items.find(i => i.id === entry.itemId);
    if (!item) return verts;

    if (item.schemaDid) {
      const sch = items.find(i => i.did === item.schemaDid);
      if (sch) verts.add(sch.vertexId);
    }
    if (item.issuerDid) {
      const iss = items.find(i => i.did === item.issuerDid);
      if (iss) verts.add(iss.vertexId);
    }
    if (item.subjectDid) {
      const subj = items.find(i => i.did === item.subjectDid);
      if (subj) verts.add(subj.vertexId);
    }
    if (item.parentDid) {
      const par = items.find(i => i.did === item.parentDid);
      if (par) verts.add(par.vertexId);
    }
    const children = items.filter(i => i.parentDid === item.did);
    children.forEach(c => verts.add(c.vertexId));

    return verts;
  };

  const hasAnyPoetry = entries.some(e => e.poeticOverlay);

  return (
    <div className="w-[420px] border-l border-border bg-bg-panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-bright">
          📜 The Chronicle
        </h2>
        <button onClick={onClose} className="text-text-dim hover:text-danger text-lg leading-none">
          ×
        </button>
      </div>

      {/* View mode toggle */}
      {hasAnyPoetry && (
        <div className="flex gap-1 px-4 py-2 border-b border-border bg-bg-card">
          {([
            { key: 'technical' as const, label: 'Tech', icon: '⚙️' },
            { key: 'poetic' as const, label: 'Poetic', icon: '✨' },
            { key: 'both' as const, label: 'Both', icon: '⊕' },
          ]).map(mode => (
            <button
              key={mode.key}
              onClick={() => setViewMode(mode.key)}
              className={`flex-1 py-1 rounded text-[10px] font-mono transition-all ${
                viewMode === mode.key
                  ? 'bg-accent/20 text-accent border border-accent/40'
                  : 'text-text-dim hover:text-text-primary border border-transparent'
              }`}
            >
              {mode.icon} {mode.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {entries.length === 0 ? (
          <div className="text-xs text-text-dim/60 italic text-center py-8">
            The chronicle is empty.<br />
            Register items to begin the witness.
          </div>
        ) : (
          <div className="space-y-3 text-xs leading-relaxed">
            {entries.map((entry) => {
              const item = entry.itemId ? items.find((i) => i.id === entry.itemId) : null;
              const connected = getConnectedVertices(entry);
              const showTech = viewMode === 'technical' || viewMode === 'both';
              const showPoetic = (viewMode === 'poetic' || viewMode === 'both') && entry.poeticOverlay;

              return (
                <div
                  key={entry.id}
                  className={`group rounded border border-border/50 hover:border-border transition-colors cursor-pointer overflow-hidden ${
                    entry.vertexId !== null ? 'hover:bg-accent/5' : 'hover:bg-bg-card'
                  }`}
                  onMouseEnter={() => onHoverLine?.(connected)}
                  onMouseLeave={() => onHoverLine?.(new Set())}
                  onClick={() => {
                    if (entry.vertexId !== null) {
                      onSelectVertex(entry.vertexId);
                    }
                  }}
                  title={entry.vertexId !== null ? `Blade ${entry.vertexId} (${getVertexLabel(entry.vertexId)}) — click to view` : undefined}
                >
                  {/* Header row */}
                  <div className="flex gap-2 items-start px-2 py-1.5">
                    {/* Timestamp */}
                    <div className="text-[9px] font-mono text-text-dim/50 pt-0.5 w-12 shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {/* Verb badge */}
                    <div className="shrink-0 mt-0.5">
                      {verbBadge(entry.verb)}
                    </div>

                    {/* Date */}
                    <div className="text-[9px] font-mono text-text-dim/40 pt-0.5">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </div>

                    {/* Vertex indicator(s) */}
                    {connected.size > 0 && (
                      <div className="shrink-0 ml-auto flex gap-0.5">
                        {Array.from(connected).slice(0, 3).map(v => (
                          <span
                            key={v}
                            className="inline-block w-5 h-5 rounded-full text-[9px] font-mono font-bold text-center leading-5"
                            style={{
                              background: getStratumColor(getStratum(v)) + '30',
                              color: getStratumColor(getStratum(v)),
                            }}
                          >
                            {v}
                          </span>
                        ))}
                        {connected.size > 3 && (
                          <span className="text-[9px] text-text-dim/50 self-center">+{connected.size - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="px-2 pb-2 space-y-1.5">
                    {/* Technical text */}
                    {showTech && (
                      <p className="text-text-primary opacity-90 group-hover:opacity-100 transition-opacity pl-7">
                        {entry.text}
                      </p>
                    )}

                    {/* Poetic overlay */}
                    {showPoetic && entry.poeticOverlay && (
                      <div className="pl-7 border-l-2 border-purple-500/30 ml-7 mt-2">
                        <p className="text-text-dim/80 italic leading-relaxed whitespace-pre-line">
                          {entry.poeticOverlay.replace(/\\n/g, '\n')}
                        </p>
                      </div>
                    )}

                    {/* Item reference */}
                    {item && (
                      <p className="text-[9px] text-text-dim/40 pl-7 truncate">
                        {item.label} @ V{item.vertexId} · S{item.stratum}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function verbBadge(verb: ChronicleEntry['verb']) {
  const styles: Record<ChronicleEntry['verb'], string> = {
    registered: 'text-success bg-success/10',
    imported: 'text-accent bg-accent/10',
    cleared: 'text-danger bg-danger/10',
    resolved: 'text-warning bg-warning/10',
  };
  const icons: Record<ChronicleEntry['verb'], string> = {
    registered: '⊕',
    imported: '⬇️',
    cleared: '✕',
    resolved: '↻',
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${styles[verb]}`}
      title={verb}
    >
      {icons[verb]}
    </span>
  );
}

function getStratum(vertexId: number): number {
  let v = vertexId;
  let count = 0;
  while (v) { count += v & 1; v >>= 1; }
  return count;
}
