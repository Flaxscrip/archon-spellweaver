// ═══════════════════════════════════════════════════════════════
// SPELLWEB REGISTRY TYPE DEFINITIONS
// For Transmuted DIDs and Decomposed VCs on the 64-vertex lattice
// ═══════════════════════════════════════════════════════════════

export interface LatticeVertex {
  id: number;        // 0-63
  binary: string;    // 6-bit binary string
  stratum: number;   // 0-6 (Hamming weight)
  x: number;         // SVG x coordinate
  y: number;         // SVG y coordinate
  dimensions: {
    protection: boolean;  // bit0 = 1
    delegation: boolean;  // bit1 = 2
    memory: boolean;      // bit2 = 4
    connection: boolean;  // bit3 = 8
    computation: boolean; // bit4 = 16
    value: boolean;       // bit5 = 32
  };
}

export type RegistryItemType = 'did' | 'vc' | 'schema' | 'asset' | 'capability';

// Chronicle entry: a narrative record of each registry operation
export interface ChronicleEntry {
  id: string;            // Unique entry ID (timestamp-based)
  text: string;          // Human-readable narrative of the event
  poeticOverlay?: string; // Optional artistic/poetic expression of the same event
  verb: 'registered' | 'imported' | 'cleared' | 'resolved';
  vertexId: number | null; // Blade referenced, if any
  itemId: string | null;   // The affected item, if any
  timestamp: string;     // ISO timestamp
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface RegistryItem {
  id: string;           // Unique identifier
  type: RegistryItemType;
  label: string;        // Human-readable name
  did: string;          // The DID string (or capability URI)
  vertexId: number;     // 0-63 lattice position
  stratum: number;      // Cached Hamming weight
  createdAt: string;    // ISO timestamp
  notes?: string;       // Optional technical description
  poeticOverlay?: string; // Optional lyric / poetic description for chronicle
  // For VCs
  schemaDid?: string;   // Schema DID reference
  issuerDid?: string;   // Issuer DID reference
  subjectDid?: string;  // VC subject DID reference
  // For assets: controller DID resolved from DID Document (agent with signing keys)
  controllerDid?: string; // **RESOLVED** — do NOT set manually
  role?: 'sovereign' | 'transmuted' | 'schema' | 'issuer' | 'verifier' | 'chronicle';
  // For capabilities: parent DID this capability belongs to
  parentDid?: string;   // Anchor DID this capability decomposes from
  // Archon identity layer
  vcPayload?: object;         // W3C VC JSON for type: 'vc' items issued via Keymaster
  archonVerified?: boolean;   // DID/VC confirmed on Gatekeeper
  archonAnchor?: string;      // Registry where anchored: 'hyperswarm' | 'BTC' | 'local'
  // Metadata
  tags?: string[];
}

export interface RegistryState {
  items: RegistryItem[];
  chronicle: ChronicleEntry[];
  version: number;
}

export const REGISTRY_STORAGE_KEY = 'spellweb-registry-v1';
export const CHRONICLE_STORAGE_KEY = 'spellweb-chronicle-v1';

// ═══════════════════════════════════════════════════════════════
// DIMENSION HELPERS
// ═══════════════════════════════════════════════════════════════

export function getVertexDimensions(vertexId: number): LatticeVertex['dimensions'] {
  return {
    protection: (vertexId & 1) !== 0,
    delegation: (vertexId & 2) !== 0,
    memory: (vertexId & 4) !== 0,
    connection: (vertexId & 8) !== 0,
    computation: (vertexId & 16) !== 0,
    value: (vertexId & 32) !== 0,
  };
}

export function getStratum(vertexId: number): number {
  let count = 0;
  for (let i = 0; i < 6; i++) {
    if ((vertexId >> i) & 1) count++;
  }
  return count;
}

export function toBinary(vertexId: number): string {
  return (vertexId >>> 0).toString(2).padStart(6, '0');
}

export function getDimensionNames(vertexId: number): string[] {
  const d = getVertexDimensions(vertexId);
  const names: string[] = [];
  if (d.protection) names.push('Prot');
  if (d.delegation) names.push('Delg');
  if (d.memory) names.push('Mem');
  if (d.connection) names.push('Conn');
  if (d.computation) names.push('Comp');
  if (d.value) names.push('Val');
  return names;
}

export function getDimensionEmoji(vertexId: number): string {
  const d = getVertexDimensions(vertexId);
  let emoji = '';
  if (d.protection) emoji += '🛡️';
  if (d.delegation) emoji += '🤝';
  if (d.memory) emoji += '📜';
  if (d.connection) emoji += '🔗';
  if (d.computation) emoji += '⚡';
  if (d.value) emoji += '💎';
  return emoji || '☷';
}

export function getStratumColor(stratum: number): string {
  const colors = [
    '#ff4444', // S0: Void
    '#ff9955', // S1
    '#ffdd55', // S2
    '#55ff55', // S3
    '#5599ff', // S4
    '#aa55ff', // S5
    '#ffd700', // S6: Full
  ];
  return colors[stratum] ?? '#888888';
}

// ═══════════════════════════════════════════════════════════════
// CANONICAL BLADE NAMES (PrivacyMage Reference Sheet)
// 7 of 64 named canonically. 57 remain open frontier.
// ═══════════════════════════════════════════════════════════════

export interface BladeName {
  name: string;
  emoji: string;
  hexagram?: string;      // I Ching name if applicable
  isCanonical: boolean;   // From official reference sheet
  source?: string;        // e.g., 'The Boundary Blade', 'Soulbae Oracle'
}

export const BLADE_NAMES: Record<number, BladeName> = {
  // ── Stratum 0 ──
  0:  { name: 'The Null Blade', emoji: '☷', hexagram: '坤 The Receptive', isCanonical: true, source: '64 Blades Reference Sheet' },

  // ── Stratum 1 (Chiron capability blades) ──
  4:  { name: 'Mnemosyne', emoji: '📜', isCanonical: false, source: 'Chiron — Memory / Recall capability' },
  8:  { name: 'Iris', emoji: '🌈', isCanonical: false, source: 'Chiron — Connection / Bridge capability' },
  16: { name: 'Logos', emoji: '⚡', isCanonical: false, source: 'Chiron — Computation / Reasoning capability' },

  // ── Stratum 2 ──
  3:  { name: 'The Dual Agent', emoji: '⚔️', isCanonical: true, source: '64 Blades Reference Sheet' },
  5:  { name: 'The Chronicle', emoji: '📖', isCanonical: false, source: 'flaxscrip — shared memory of collaboration' },
  12: { name: 'The Taxonomist', emoji: '📋', isCanonical: false, source: 'flaxscrip — schema type classification' },
  20: { name: 'Techne', emoji: '🛠️', isCanonical: false, source: 'Chiron — Skill / Learning capability' },
  24: { name: 'Hephaestus', emoji: '🔨', isCanonical: false, source: 'Chiron — Forge / Tool-binding capability' },

  // ── Stratum 3 (Sovereign Anchor trilogy + Chiron) ──
  17: { name: 'NIZK', emoji: '⚔️', isCanonical: false, source: 'The Boundary Blade (Part 2)' },
  25: { name: 'Aletheia', emoji: '⚔️', isCanonical: false, source: 'Soulbae Oracle (Part 3)' },
  28: { name: 'Chiron', emoji: '🐎', isCanonical: false, source: 'flaxscrip — transmuted augmentation agent, wounded healer' },
  38: { name: 'Lethe', emoji: '🧙', isCanonical: false, source: 'Soulbae Oracle (Part 3)' },

  // ── Stratum 4 ──
  15: { name: 'The Covenant', emoji: '🧡', isCanonical: false, source: 'flaxscrip — bilateral trust attestation' },
  21: { name: 'The Prover', emoji: '🛡️', isCanonical: true, source: '64 Blades Reference Sheet' },
  42: { name: 'The Answer', emoji: '🔮', isCanonical: true, source: '64 Blades Reference Sheet' },

  // ── Stratum 5 ──
  31: { name: 'The Ascetic', emoji: '📜', isCanonical: true, source: '64 Blades Reference Sheet' },
  62: { name: 'The Unguarded', emoji: '🛡️', isCanonical: true, source: '64 Blades Reference Sheet' },

  // ── Stratum 6 ──
  63: { name: 'The Creative', emoji: '☰', hexagram: '乾 The Creative', isCanonical: true, source: '64 Blades Reference Sheet' },
};

export function getVertexLabel(vertexId: number): string {
  const blade = BLADE_NAMES[vertexId];
  if (blade) {
    return `${blade.emoji} ${blade.name}`;
  }
  return `V${vertexId}`;
}

export function getVertexShortLabel(vertexId: number): string {
  const blade = BLADE_NAMES[vertexId];
  if (blade) {
    return `${blade.emoji} ${blade.name.split(' ').pop()}`;
  }
  return `${vertexId}`;
}

export function isCanonicalName(vertexId: number): boolean {
  return BLADE_NAMES[vertexId]?.isCanonical ?? false;
}
