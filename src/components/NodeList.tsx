import type { RegistryItem } from '../types/registry';
import { getStratumColor, getDimensionEmoji, getVertexLabel } from '../types/registry';

interface NodeListProps {
  items: RegistryItem[];
  title: string;
  onDelete: (id: string) => void;
  onSelectVertex: (id: number) => void;
  setTab: (tab: 'lattice' | 'dids' | 'vcs' | 'all') => void;
}

export function NodeList({ items, title, onDelete, onSelectVertex, setTab }: NodeListProps) {
  if (items.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-dim">
        <div className="text-4xl mb-4">✦</div>
        <p className="text-sm">No items registered yet.</p>
        <button
          onClick={() => setTab('lattice')}
          className="mt-4 text-xs text-accent hover:underline"
        >
          Go to Lattice to register →
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h2 className="text-lg font-semibold text-text-bright mb-4">{title}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map(item => {
          const color = getStratumColor(item.stratum);
          return (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-bg-card p-4 hover:border-border-hover transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                    item.type === 'did' ? 'bg-accent/10 text-accent' :
                    item.type === 'vc' ? 'bg-success/10 text-success' :
                    'bg-warning/10 text-warning'
                  }`}>
                    {item.type.toUpperCase()}
                  </span>
                  {item.role && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-primary border border-border text-text-dim">
                      {item.role}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-text-dim/40 hover:text-danger transition-colors"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>

              <div className="text-sm font-semibold text-text-bright mb-1">
                {item.label}
              </div>

              <div className="font-mono text-xs text-text-dim mb-3 break-all">
                {item.did}
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={() => onSelectVertex(item.vertexId)}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: color + '25', color, border: `1px solid ${color}50` }}
                  >
                    {item.vertexId}
                  </span>
                  <span className="text-text-dim">{getVertexLabel(item.vertexId)}</span>
                  <span>{getDimensionEmoji(item.vertexId)}</span>
                </button>
                <span className="text-[10px] text-text-dim/50">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>

              {item.schemaDid && (
                <div className="mt-2 text-[10px] text-text-dim/70 font-mono truncate">
                  Schema: {item.schemaDid}
                </div>
              )}
              {item.issuerDid && (
                <div className="mt-0.5 text-[10px] text-text-dim/70 font-mono truncate">
                  Issuer: {item.issuerDid}
                </div>
              )}
              {item.notes && (
                <div className="mt-2 text-xs text-text-dim/80 line-clamp-2">
                  {item.notes}
                </div>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-primary border border-border text-text-dim">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
