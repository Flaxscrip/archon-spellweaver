import { useState } from 'react';
import type { RegistryItem } from '../types/registry';
import { getStratum, toBinary, getDimensionNames, getStratumColor, getDimensionEmoji } from '../types/registry';

interface VCFormProps {
  onSubmit: (item: RegistryItem) => void;
  selectedVertex: number | null;
  availableDIDs: RegistryItem[];
}

export function VCForm({ onSubmit, selectedVertex, availableDIDs }: VCFormProps) {
  const [did, setDid] = useState('');
  const [label, setLabel] = useState('');
  const [vertexId, setVertexId] = useState(selectedVertex?.toString() ?? '25');
  const [schemaDid, setSchemaDid] = useState('');
  const [issuerDid, setIssuerDid] = useState('');
  const [subjectDid, setSubjectDid] = useState('');
  const [notes, setNotes] = useState('');
  const [poeticOverlay, setPoeticOverlay] = useState('');
  const [tags, setTags] = useState('');

  const vId = parseInt(vertexId, 10) || 0;
  const clamped = Math.max(0, Math.min(63, vId));
  const stratum = getStratum(clamped);
  const binary = toBinary(clamped);
  const dimNames = getDimensionNames(clamped);
  const color = getStratumColor(stratum);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!did.trim() || !label.trim()) return;

    const item: RegistryItem = {
      id: `vc-${Date.now()}`,
      type: 'vc',
      label: label.trim(),
      did: did.trim(),
      vertexId: clamped,
      stratum,
      createdAt: new Date().toISOString(),
      schemaDid: schemaDid.trim() || undefined,
      issuerDid: issuerDid.trim() || undefined,
      subjectDid: subjectDid.trim() || undefined,
      notes: notes.trim() || undefined,
      poeticOverlay: poeticOverlay.trim() || undefined,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    };

    onSubmit(item);
    setDid('');
    setLabel('');
    setSchemaDid('');
    setIssuerDid('');
    setSubjectDid('');
    setNotes('');
    setPoeticOverlay('');
    setTags('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Vertex selector */}
      <div className="rounded-lg border border-border bg-bg-card p-3">
        <label className="block text-xs font-semibold text-text-dim mb-2">
          Lattice Position (0-63)
        </label>
        <input
          type="number"
          min={0}
          max={63}
          value={vertexId}
          onChange={e => setVertexId(e.target.value)}
          className="w-full"
        />
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded font-mono" style={{ background: color + '20', color }}>
            S{stratum}
          </span>
          <span className="font-mono text-text-dim">{binary}</span>
          <span className="text-text-dim">{getDimensionEmoji(clamped)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {dimNames.map(d => (
            <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-primary border border-border text-text-dim">
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* VC DID */}
      <div>
        <label className="block text-xs font-semibold text-text-dim mb-1">VC DID</label>
        <input
          type="text"
          value={did}
          onChange={e => setDid(e.target.value)}
          placeholder="did:web:example.com#credential-1"
          className="w-full"
          required
        />
      </div>

      {/* Label */}
      <div>
        <label className="block text-xs font-semibold text-text-dim mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g., MedicalLicense Decomposed"
          className="w-full"
          required
        />
      </div>

      {/* Schema DID */}
      <div>
        <label className="block text-xs font-semibold text-text-dim mb-1">Schema DID</label>
        <select
          value={schemaDid}
          onChange={e => setSchemaDid(e.target.value)}
          className="w-full mb-1"
        >
          <option value="">-- Select registered schema --</option>
          {availableDIDs.filter(d => d.type === 'schema').map(d => (
            <option key={d.id} value={d.did}>{d.label} ({shortDid(d.did)})</option>
          ))}
        </select>
        <input
          type="text"
          value={schemaDid}
          onChange={e => setSchemaDid(e.target.value)}
          placeholder="Or type manually..."
          className="w-full"
        />
      </div>

      {/* Issuer DID */}
      <div>
        <label className="block text-xs font-semibold text-text-dim mb-1">Issuer DID</label>
        <select
          value={issuerDid}
          onChange={e => setIssuerDid(e.target.value)}
          className="w-full mb-1"
        >
          <option value="">-- Select registered issuer --</option>
          {availableDIDs.filter(d => d.type === 'did').map(d => (
            <option key={d.id} value={d.did}>{d.label} {roleBadge(d.role)} ({shortDid(d.did)})</option>
          ))}
        </select>
        <input
          type="text"
          value={issuerDid}
          onChange={e => setIssuerDid(e.target.value)}
          placeholder="Or type manually..."
          className="w-full"
        />
      </div>

      {/* Subject DID */}
      <div>
        <label className="block text-xs font-semibold text-text-dim mb-1">Subject DID</label>
        <select
          value={subjectDid}
          onChange={e => setSubjectDid(e.target.value)}
          className="w-full mb-1"
        >
          <option value="">-- Select registered subject --</option>
          {availableDIDs.filter(d => d.type === 'did').map(d => (
            <option key={d.id} value={d.did}>{d.label} {roleBadge(d.role)} ({shortDid(d.did)})</option>
          ))}
        </select>
        <input
          type="text"
          value={subjectDid}
          onChange={e => setSubjectDid(e.target.value)}
          placeholder="Or type manually..."
          className="w-full"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-text-dim mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Decomposition details, selective disclosure fields..."
          className="w-full h-20 resize-none"
        />
      </div>

      {/* Poetic Overlay */}
      <div>
        <label className="block text-xs font-semibold text-text-dim mb-1">Poetic Overlay / Lyric</label>
        <textarea
          value={poeticOverlay}
          onChange={e => setPoeticOverlay(e.target.value)}
          placeholder="The oracle's verse. What the lattice whispers about this credential..."
          className="w-full h-24 resize-none"
        />
        <p className="text-[9px] text-text-dim/50 mt-0.5">Appears in the Chronicle as the poetic layer.</p>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-semibold text-text-dim mb-1">Tags (comma-separated)</label>
        <input
          type="text"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="medical, consent, demo"
          className="w-full"
        />
      </div>

      <button type="submit" className="btn btn-primary w-full">
        Register VC
      </button>
    </form>
  );
}

function shortDid(did: string): string {
  if (did.length <= 24) return did;
  return did.slice(0, 16) + '...' + did.slice(-6);
}

function roleBadge(role?: string): string {
  const map: Record<string, string> = {
    sovereign: '👑',
    transmuted: '⚡',
    issuer: '🏛️',
    verifier: '🔍',
    schema: '📋',
  };
  return map[role || ''] || '◦';
}
