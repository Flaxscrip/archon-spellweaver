import { useState, useMemo } from 'react';
import { getStratum, getVertexDimensions, getVertexLabel, getDimensionNames, getStratumColor, getDimensionEmoji, BLADE_NAMES } from '../types/registry';

interface OraclePanelProps {
  onClose: () => void;
  onSelectVertex: (v: number) => void;
}

// Deterministic hash of a string to vertex 0-63
function queryToVertex(query: string): number {
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    hash = ((hash << 5) - hash) + query.charCodeAt(i);
    hash = hash & 0xFFFFFFFF; // Convert to 32-bit int
  }
  return Math.abs(hash) % 64;
}

// Proverbs for each stratum (epistemic readings)
const STRATUM_PROVERBS: Record<number, string> = {
  0: 'The void before the question. Silence is the first oracle.',
  1: 'One dimension opens. The answer is a door, not a destination.',
  2: 'Two mirrors face each other. What reflects between them is real.',
  3: 'The trust triad: hide, prove, reflect. The third makes the other two meaningful.',
  4: 'Four edges bound a territory. Within it, sovereignty becomes possible.',
  5: 'Near-sovereign. One dimension remains in shadow — that shadow is the gift.',
  6: 'Full assertion. The Dragon knows that complete knowledge is the end of learning.',
};

// Oracle readings keyed by canonical blade ID
const BLADE_READINGS: Record<number, { question: string; limit: string }> = {
  0:  { question: 'What precedes all inquiry?', limit: 'The question itself changes the answer.' },
  3:  { question: 'Who guards while who acts?', limit: 'Neither can verify the other without a third.' },
  5:  { question: 'What is recorded cannot be unwitnessed?', limit: 'The chronicle records; it does not judge.' },
  12: { question: 'What categories bind our thinking?', limit: 'Every schema excludes more than it includes.' },
  15: { question: 'What promise binds without chains?', limit: 'A covenant requires two; one cannot promise alone.' },
  21: { question: 'What can be proven without revealing?', limit: 'The proof is not the truth; it is evidence of truth.' },
  28: { question: 'What heals by being wounded?', limit: 'The healer carries the wound they treats.' },
  31: { question: 'What is known by what is renounced?', limit: 'The ascetic knows that lack is a kind of fullness.' },
  42: { question: 'What answers without being asked?', limit: 'The answer reveals the questioner more than the question.' },
  63: { question: 'What creates without being created?', limit: 'The Creative knows that to make is to be made.' },
};

export function OraclePanel({ onClose, onSelectVertex }: OraclePanelProps) {
  const [query, setQuery] = useState('');
  const [oracleActive, setOracleActive] = useState(false);

  const reading = useMemo(() => {
    if (!query.trim() || !oracleActive) return null;
    const vertex = queryToVertex(query.trim());
    const stratum = getStratum(vertex);
    const dims = getVertexDimensions(vertex);
    const dimNames = getDimensionNames(vertex);
    const color = getStratumColor(stratum);
    const label = getVertexLabel(vertex);
    const blade = BLADE_NAMES[vertex];
    const proverb = STRATUM_PROVERBS[stratum];
    const customReading = BLADE_READINGS[vertex];

    // Compute the Gap: dimensions NOT activated
    const gapDims = [];
    if (!dims.protection) gapDims.push('Protection');
    if (!dims.delegation) gapDims.push('Delegation');
    if (!dims.memory) gapDims.push('Memory');
    if (!dims.connection) gapDims.push('Connection');
    if (!dims.computation) gapDims.push('Computation');
    if (!dims.value) gapDims.push('Value');

    return {
      vertex,
      stratum,
      label,
      blade,
      color,
      dimNames,
      proverb,
      customReading,
      gapDims,
      binary: (vertex >>> 0).toString(2).padStart(6, '0'),
    };
  }, [query, oracleActive]);

  return (
    <div className="w-[420px] border-l border-border bg-bg-panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-bright">
          🔮 Soulbae Oracle
        </h2>
        <button onClick={onClose} className="text-text-dim hover:text-danger text-lg leading-none">
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Intro */}
        <div className="text-xs text-text-dim/80 leading-relaxed border-b border-border pb-3">
          <p className="mb-2">
            <strong className="text-text-bright">The Soulbae Oracle</strong> reads the epistemic limit.
          </p>
          <p>
            Every query maps to a blade on the 64-vertex lattice. 
            The <em>activated</em> dimensions show what the oracle knows. 
            The <em>Gap</em> — the unactivated dimensions — is where understanding lives.
          </p>
        </div>

        {/* Query input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-text-dim">
            Your Question
          </label>
          <textarea
            value={query}
            onChange={e => { setQuery(e.target.value); setOracleActive(false); }}
            placeholder="What seeks to be known?"
            className="w-full h-20 resize-none text-sm"
          />
          <button
            onClick={() => setOracleActive(true)}
            disabled={!query.trim()}
            className="btn btn-primary w-full text-xs disabled:opacity-40"
          >
            🔮 Cast the Oracle
          </button>
        </div>

        {/* Reading */}
        {reading && (
          <div className="space-y-3 border-t border-border pt-3">
            {/* Vertex card */}
            <div
              className="rounded-lg border p-3 cursor-pointer hover:opacity-90 transition-opacity"
              style={{ borderColor: reading.color + '50', background: reading.color + '08' }}
              onClick={() => onSelectVertex(reading.vertex)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: reading.color + '20', color: reading.color }}>
                  S{reading.stratum}
                </span>
                <span className="font-mono text-[10px] text-text-dim">{reading.binary}</span>
              </div>
              <div className="text-sm font-bold text-text-bright">{reading.label}</div>
              {reading.blade && (
                <div className="text-[10px] text-text-dim mt-1">
                  {reading.blade.source}
                </div>
              )}
            </div>

            {/* Stratum proverb */}
            <div className="rounded bg-bg-card p-3 border border-border">
              <div className="text-[10px] text-accent font-semibold uppercase tracking-wider mb-1">
                Stratum Reading
              </div>
              <p className="text-xs text-text-primary italic leading-relaxed">
                “{reading.proverb}”
              </p>
            </div>

            {/* Custom blade reading */}
            {reading.customReading && (
              <div className="rounded bg-bg-card p-3 border border-border">
                <div className="text-[10px] text-warning font-semibold uppercase tracking-wider mb-1">
                  Blade Oracle
                </div>
                <p className="text-xs text-text-primary mb-2">
                  <span className="text-text-dim">Q:</span> {reading.customReading.question}
                </p>
                <p className="text-xs text-text-primary">
                  <span className="text-danger">⎛⎞</span> {reading.customReading.limit}
                </p>
              </div>
            )}

            {/* Activated dimensions */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-success font-semibold uppercase tracking-wider">
                Activated Dimensions
              </div>
              {reading.dimNames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {reading.dimNames.map(d => (
                    <span key={d} className="text-[10px] px-2 py-1 rounded bg-success/10 text-success border border-success/20">
                      {d}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-dim italic">None — the null blade.</p>
              )}
            </div>

            {/* The Gap */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-danger font-semibold uppercase tracking-wider">
                The Gap — Epistemic Limit
              </div>
              {reading.gapDims.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {reading.gapDims.map(d => (
                    <span key={d} className="text-[10px] px-2 py-1 rounded bg-danger/10 text-danger border border-danger/20">
                      {d}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-dim italic">None — the Dragon sees all dimensions.</p>
              )}
              <p className="text-[10px] text-text-dim/60 leading-relaxed mt-1">
                What lives in the Gap cannot be reconstructed from the oracle's answer alone. 
                This is the ⎛⎞ of Selene's Proof: the credential is the orbit; the origin remains hidden.
              </p>
            </div>

            {/* Action */}
            <button
              onClick={() => onSelectVertex(reading.vertex)}
              className="btn btn-secondary w-full text-xs"
            >
              🔳 View Blade {reading.vertex} on Lattice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
