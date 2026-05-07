import { describe, it, expect } from 'vitest';
import { transmuteToSpellweb, containsDids, checkTaxonomy, VALID_TYPES, VALID_LAYERS, VALID_DOMAINS } from './transmute';
import type { RegistryItem, ChronicleEntry } from '../types/registry';

// ── Fixture items ──

const FLAXSCRIP_DID = 'did:cid:bagaaieraTESTSOVEREIGN';
const GENITRIX_DID  = 'did:cid:bagaaieraTESTMEAGE';
const SCHEMA_DID    = 'did:cid:bagaaieraTESTSCHEMA';
const VC_DID        = 'did:cid:bagaaieraTESTVC';

const SOVEREIGN: RegistryItem = {
  id: 'did-test-sovereign',
  type: 'did',
  label: 'TestSovereign',
  did: FLAXSCRIP_DID,
  vertexId: 63,
  stratum: 6,
  createdAt: '2026-01-01T00:00:00.000Z',
  role: 'sovereign',
  notes: 'Test sovereign at V63.',
};

const TRANSMUTED: RegistryItem = {
  id: 'did-test-transmuted',
  type: 'did',
  label: 'TestMage',
  did: GENITRIX_DID,
  vertexId: 28,
  stratum: 3,
  createdAt: '2026-01-01T00:00:30.000Z',
  role: 'transmuted',
  notes: 'Test transmuted agent.',
};

const SCHEMA: RegistryItem = {
  id: 'schema-test',
  type: 'schema',
  label: 'TestSchema',
  did: SCHEMA_DID,
  vertexId: 12,
  stratum: 2,
  createdAt: '2026-01-01T00:01:00.000Z',
  role: 'schema',
  controllerDid: FLAXSCRIP_DID,
  notes: 'A test schema.',
};

const SCHEMA_MAGE: RegistryItem = {
  id: 'schema-mage-test',
  type: 'schema',
  label: 'MageSchema',
  did: 'did:cid:bagaaieraMGSCHEMA',
  vertexId: 12,
  stratum: 2,
  createdAt: '2026-01-01T00:01:01.000Z',
  role: 'schema',
  controllerDid: GENITRIX_DID,
  notes: 'Schema controlled by the transmuted agent.',
};

const VC: RegistryItem = {
  id: 'vc-test',
  type: 'vc',
  label: 'TestCredential',
  did: VC_DID,
  vertexId: 15,
  stratum: 4,
  createdAt: '2026-01-01T00:02:00.000Z',
  issuerDid: FLAXSCRIP_DID,
  subjectDid: GENITRIX_DID,
  schemaDid: SCHEMA_DID,
  notes: 'A test VC.',
};

const CAPABILITY_MAGE: RegistryItem = {
  id: 'cap-from-mage',
  type: 'capability',
  label: 'TestCapMage',
  did: 'urn:capability:test:recall',
  vertexId: 4,
  stratum: 1,
  createdAt: '2026-01-01T00:03:00.000Z',
  parentDid: GENITRIX_DID,
  notes: 'Child of transmuted agent.',
};

const CAPABILITY_VC: RegistryItem = {
  id: 'cap-from-vc',
  type: 'capability',
  label: 'TestDecomp',
  did: 'urn:decomposition:test:subject',
  vertexId: 3,
  stratum: 2,
  createdAt: '2026-01-01T00:04:00.000Z',
  parentDid: VC_DID,
  poeticOverlay: 'The name does not pass through the valve.',
};

const ASSET_CHRONICLE: RegistryItem = {
  id: 'asset-test-chronicle',
  type: 'asset',
  label: 'The Chronicle',
  did: 'did:cid:bagaaieraTESTCHRON',
  vertexId: 5,
  stratum: 2,
  createdAt: '2026-01-01T00:05:00.000Z',
  role: 'chronicle',
  controllerDid: FLAXSCRIP_DID,
  notes: 'A test chronicle asset.',
};

const CHRONICLE: ChronicleEntry[] = [];

// ── Core taxonomy tests ──

describe('taxonomy correctness', () => {
  it('DID role=sovereign → domain swordsman', () => {
    const { nodes } = transmuteToSpellweb([SOVEREIGN], CHRONICLE);
    expect(nodes[0].domain).toBe('swordsman');
  });

  it('DID role=transmuted → domain mage', () => {
    const { nodes } = transmuteToSpellweb([TRANSMUTED], CHRONICLE);
    expect(nodes[0].domain).toBe('mage');
  });

  it('asset role=chronicle → type document, layer narrative', () => {
    const { nodes } = transmuteToSpellweb([ASSET_CHRONICLE], CHRONICLE);
    expect(nodes[0].type).toBe('document');
    expect(nodes[0].layer).toBe('narrative');
  });

  it('asset role=chronicle → domain swordsman (controlled by chronicler)', () => {
    const { nodes } = transmuteToSpellweb([ASSET_CHRONICLE], CHRONICLE);
    expect(nodes[0].domain).toBe('swordsman');
  });

  it('capability with transmuted-DID parent → domain mage', () => {
    const { nodes } = transmuteToSpellweb([TRANSMUTED, CAPABILITY_MAGE], CHRONICLE);
    const cap = nodes.find(n => n.type === 'skill');
    expect(cap?.domain).toBe('mage');
  });

  it('capability with VC parent (decomposition node) → domain shared', () => {
    const { nodes } = transmuteToSpellweb([VC, CAPABILITY_VC], CHRONICLE);
    const decomp = nodes.find(n => n.type === 'skill');
    expect(decomp?.domain).toBe('shared');
  });

  it('schema with sovereign controller → domain swordsman', () => {
    const { nodes } = transmuteToSpellweb([SOVEREIGN, SCHEMA], CHRONICLE);
    const schema = nodes.find(n => n.type === 'theorem');
    expect(schema?.domain).toBe('swordsman');
  });

  it('schema with transmuted controller → domain mage', () => {
    const { nodes } = transmuteToSpellweb([TRANSMUTED, SCHEMA_MAGE], CHRONICLE);
    const schema = nodes.find(n => n.type === 'theorem');
    expect(schema?.domain).toBe('mage');
  });

  it('VC is always shared domain', () => {
    const { nodes } = transmuteToSpellweb([VC], CHRONICLE);
    expect(nodes[0].domain).toBe('shared');
  });

  it('no node emits type="chronicle" (bug 1 guard)', () => {
    const items = [SOVEREIGN, TRANSMUTED, SCHEMA, VC, CAPABILITY_MAGE, CAPABILITY_VC, ASSET_CHRONICLE];
    const { nodes } = transmuteToSpellweb(items, CHRONICLE);
    expect(nodes.every(n => n.type !== 'chronicle')).toBe(true);
  });

  it('no node emits layer="chronicle" (bug 2 guard)', () => {
    const items = [SOVEREIGN, TRANSMUTED, SCHEMA, VC, CAPABILITY_MAGE, CAPABILITY_VC, ASSET_CHRONICLE];
    const { nodes } = transmuteToSpellweb(items, CHRONICLE);
    expect(nodes.every(n => n.layer !== 'chronicle')).toBe(true);
  });

  it('all nodes pass checkTaxonomy with no violations', () => {
    const items = [SOVEREIGN, TRANSMUTED, SCHEMA, SCHEMA_MAGE, VC, CAPABILITY_MAGE, CAPABILITY_VC, ASSET_CHRONICLE];
    const { nodes } = transmuteToSpellweb(items, CHRONICLE);
    const violations = checkTaxonomy(nodes);
    expect(violations).toHaveLength(0);
  });
});

// ── checkTaxonomy guard tests ──

describe('checkTaxonomy', () => {
  it('flags type="chronicle"', () => {
    const bad = [{ id: 'x', type: 'chronicle', label: 'X', domain: 'shared', layer: 'knowledge', desc: '', hexagram: { bladeId: 5, layer: 2, layerName: 'Twin-edge', yangCount: 2, lines: [1,0,1,0,0,0] } }] as any;
    const v = checkTaxonomy(bad);
    expect(v.some(x => x.field === 'type')).toBe(true);
  });

  it('flags layer="chronicle"', () => {
    const bad = [{ id: 'x', type: 'document', label: 'X', domain: 'shared', layer: 'chronicle', desc: '', hexagram: { bladeId: 5, layer: 2, layerName: 'Twin-edge', yangCount: 2, lines: [1,0,1,0,0,0] } }] as any;
    const v = checkTaxonomy(bad);
    expect(v.some(x => x.field === 'layer')).toBe(true);
  });

  it('flags unknown domain', () => {
    const bad = [{ id: 'x', type: 'persona', label: 'X', domain: 'first-person', layer: 'knowledge', desc: '', hexagram: { bladeId: 63, layer: 6, layerName: 'Dragon', yangCount: 6, lines: [1,1,1,1,1,1] } }] as any;
    const v = checkTaxonomy(bad);
    expect(v.some(x => x.field === 'domain')).toBe(true);
  });

  it('valid sets are correct', () => {
    expect(VALID_TYPES.has('chronicle')).toBe(false);
    expect(VALID_LAYERS.has('chronicle')).toBe(false);
    expect(VALID_TYPES.has('document')).toBe(true);
    expect(VALID_LAYERS.has('narrative')).toBe(true);
    expect(VALID_DOMAINS.has('swordsman')).toBe(true);
    expect(VALID_DOMAINS.has('mage')).toBe(true);
  });
});

// ── Edge construction tests ──

describe('edge construction', () => {
  const items = [SOVEREIGN, TRANSMUTED, SCHEMA, VC, CAPABILITY_MAGE, CAPABILITY_VC];

  it('proves edge from VC to schema', () => {
    const { nodes, edges } = transmuteToSpellweb(items, CHRONICLE);
    const vcNode = nodes.find(n => n.type === 'spell');
    const schemaNode = nodes.find(n => n.type === 'theorem');
    const e = edges.find(e => e.source === vcNode!.id && e.target === schemaNode!.id && e.type === 'proves');
    expect(e).toBeDefined();
  });

  it('generates edge from issuer to VC', () => {
    const { nodes, edges } = transmuteToSpellweb(items, CHRONICLE);
    const issuerNode = nodes.find(n => n.label === 'TestSovereign');
    const vcNode = nodes.find(n => n.type === 'spell');
    const e = edges.find(e => e.source === issuerNode!.id && e.target === vcNode!.id && e.type === 'generates');
    expect(e).toBeDefined();
  });

  it('relates_to edge from VC to subject', () => {
    const { nodes, edges } = transmuteToSpellweb(items, CHRONICLE);
    const vcNode = nodes.find(n => n.type === 'spell');
    const subjectNode = nodes.find(n => n.label === 'TestMage');
    const e = edges.find(e => e.source === vcNode!.id && e.target === subjectNode!.id && e.type === 'relates_to');
    expect(e).toBeDefined();
  });

  it('manifests_as edge from parent DID to capability', () => {
    const { nodes, edges } = transmuteToSpellweb(items, CHRONICLE);
    const mageNode = nodes.find(n => n.label === 'TestMage');
    const capNode = nodes.find(n => n.label === 'TestCapMage');
    const e = edges.find(e => e.source === mageNode!.id && e.target === capNode!.id && e.type === 'manifests_as');
    expect(e).toBeDefined();
  });

  it('manifests_as edge from VC to decomp capability', () => {
    const { nodes, edges } = transmuteToSpellweb(items, CHRONICLE);
    const vcNode = nodes.find(n => n.type === 'spell');
    const decompNode = nodes.find(n => n.label === 'TestDecomp');
    const e = edges.find(e => e.source === vcNode!.id && e.target === decompNode!.id && e.type === 'manifests_as');
    expect(e).toBeDefined();
  });

  it('no schema→controller edge (omitted by design)', () => {
    const { nodes, edges } = transmuteToSpellweb([SOVEREIGN, SCHEMA], CHRONICLE);
    const schemaNode = nodes.find(n => n.type === 'theorem');
    const sovereignNode = nodes.find(n => n.type === 'persona');
    const e = edges.find(e => e.source === schemaNode!.id && e.target === sovereignNode!.id);
    expect(e).toBeUndefined();
  });

  it('chronicle follows edge between two assets', () => {
    const ASSET2: RegistryItem = { ...ASSET_CHRONICLE, id: 'asset-2', label: 'Second Chronicle', did: 'did:cid:bagaaieraASSET2', createdAt: '2026-01-01T00:06:00.000Z' };
    const { nodes, edges } = transmuteToSpellweb([ASSET_CHRONICLE, ASSET2], CHRONICLE);
    const e = edges.find(e => e.type === 'follows');
    expect(e).toBeDefined();
  });
});

// ── DID-blind safety ──

describe('DID-blind', () => {
  it('no did:cid: strings in any output field when blind=true (default)', () => {
    const items = [SOVEREIGN, TRANSMUTED, SCHEMA, VC, CAPABILITY_MAGE, CAPABILITY_VC, ASSET_CHRONICLE];
    const result = transmuteToSpellweb(items, CHRONICLE, true);
    expect(containsDids(JSON.stringify(result))).toBe(false);
  });

  it('poetic field has DIDs stripped when blind', () => {
    const item: RegistryItem = { ...SOVEREIGN, id: 'did-p', did: 'did:cid:bagaaieraPOETICDID', poeticOverlay: 'Root is did:cid:bagaaieraXXX.' };
    const { nodes } = transmuteToSpellweb([item], CHRONICLE, true);
    expect(nodes[0].poetic).not.toContain('did:cid:');
    expect(nodes[0].poetic).toContain('[DID]');
  });

  it('poetic overlay preserved from item when present', () => {
    const { nodes } = transmuteToSpellweb([CAPABILITY_VC], CHRONICLE, true);
    expect(nodes[0].poetic).toContain('name does not pass through the valve');
  });
});

// ── Act-7 full fixture ──

describe('Act-7 full fixture (18 items)', () => {
  const FXCRIP = 'did:cid:bagaaiera7FLAXSCRIP';
  const GNTRIX  = 'did:cid:bagaaieraGENITRIX';
  const SCOLLAB = 'did:cid:bagaaieraSCHEMACOLLAB';
  const SLOC    = 'did:cid:bagaaieraSCHEMALOC';
  const VCFG    = 'did:cid:bagaaieraVCFIVEGUYS';

  const act7Items: RegistryItem[] = [
    { id: 'did-flaxscrip',  type: 'did',         label: 'flaxscrip',   did: FXCRIP,  vertexId: 63, stratum: 6, createdAt: '2026-05-07T15:30:00Z', role: 'sovereign' },
    { id: 'did-genitrix',   type: 'did',         label: 'GenitriX',    did: GNTRIX,  vertexId: 28, stratum: 3, createdAt: '2026-05-07T15:35:00Z', role: 'transmuted' },
    { id: 'cap-mnemosyne',  type: 'capability',  label: 'Chiron-Recall',    did: 'urn:capability:chiron:mnemosyne', vertexId: 4,  stratum: 1, createdAt: '2026-05-07T15:42:00Z', parentDid: GNTRIX },
    { id: 'cap-iris',       type: 'capability',  label: 'Chiron-Bridge',    did: 'urn:capability:chiron:iris',      vertexId: 8,  stratum: 1, createdAt: '2026-05-07T15:42:00Z', parentDid: GNTRIX },
    { id: 'cap-logos',      type: 'capability',  label: 'Chiron-Reasoning', did: 'urn:capability:chiron:logos',     vertexId: 16, stratum: 1, createdAt: '2026-05-07T15:42:00Z', parentDid: GNTRIX },
    { id: 'cap-techne',     type: 'capability',  label: 'Chiron-Skills',    did: 'urn:capability:chiron:techne',    vertexId: 20, stratum: 2, createdAt: '2026-05-07T15:42:00Z', parentDid: GNTRIX },
    { id: 'cap-hephaestus', type: 'capability',  label: 'Chiron-Forge',     did: 'urn:capability:chiron:hephaestus',vertexId: 24, stratum: 2, createdAt: '2026-05-07T15:42:00Z', parentDid: GNTRIX },
    { id: 'schema-collab',  type: 'schema',      label: 'CollaborationPartnerCredential', did: SCOLLAB, vertexId: 12, stratum: 2, createdAt: '2026-05-07T15:48:00Z', role: 'schema', controllerDid: FXCRIP },
    { id: 'schema-loc',     type: 'schema',      label: 'LocationProof', did: SLOC, vertexId: 12, stratum: 2, createdAt: '2026-05-07T15:48:00Z', role: 'schema', controllerDid: GNTRIX },
    { id: 'vc-g2f',         type: 'vc',          label: 'GenitriX → flaxscrip Partnership', did: 'did:cid:bagaaieraVCG2F', vertexId: 15, stratum: 4, createdAt: '2026-05-07T15:55:00Z', issuerDid: GNTRIX, subjectDid: FXCRIP, schemaDid: SCOLLAB },
    { id: 'vc-f2g',         type: 'vc',          label: 'flaxscrip → GenitriX Partnership', did: 'did:cid:bagaaieraVCF2G', vertexId: 15, stratum: 4, createdAt: '2026-05-07T15:55:00Z', issuerDid: FXCRIP, subjectDid: GNTRIX, schemaDid: SCOLLAB },
    { id: 'vc-loc-us76',    type: 'vc',          label: 'Location Proof — US-76 SC',        did: 'did:cid:bagaaieraVCLOCUS76', vertexId: 15, stratum: 4, createdAt: '2026-05-07T15:55:00Z', issuerDid: GNTRIX, subjectDid: FXCRIP, schemaDid: SLOC },
    { id: 'vc-five-guys',   type: 'vc',          label: 'Location Proof — Five Guys Lunch', did: VCFG, vertexId: 15, stratum: 4, createdAt: '2026-04-30T20:16:23Z', issuerDid: GNTRIX, subjectDid: FXCRIP, schemaDid: SLOC },
    { id: 'asset-transmutation', type: 'asset',  label: 'The Transmutation',   did: 'did:cid:bagaaieraTRANSMUTATION', vertexId: 5, stratum: 2, createdAt: '2026-05-07T16:05:00Z', role: 'chronicle', controllerDid: FXCRIP },
    { id: 'asset-boundary',      type: 'asset',  label: 'The Boundary Blade',  did: 'did:cid:bagaaieraBOUNDARY',     vertexId: 5, stratum: 2, createdAt: '2026-05-07T16:05:01Z', role: 'chronicle', controllerDid: FXCRIP },
    { id: 'decomp-subject',  type: 'capability', label: 'Five Guys VC — Subject Identity (Hash-Masked)',       did: 'urn:decomposition:fiveguys:subject-identity', vertexId: 3,  stratum: 2, createdAt: '2026-05-07T16:15:00Z', parentDid: VCFG, poeticOverlay: 'The name does not pass through the valve.\nOnly the shape of having-had-a-name.' },
    { id: 'decomp-spell',    type: 'capability', label: 'Five Guys VC — Cryptographic Spell (Always-Masked)',  did: 'urn:decomposition:fiveguys:proof',           vertexId: 25, stratum: 3, createdAt: '2026-05-07T16:15:01Z', parentDid: VCFG, poeticOverlay: 'Aletheia speaks the truth without quoting it.' },
    { id: 'decomp-temporal', type: 'capability', label: 'Five Guys VC — Temporal Chronicle (Always-Revealed)', did: 'urn:decomposition:fiveguys:temporal',         vertexId: 20, stratum: 2, createdAt: '2026-05-07T16:15:02Z', parentDid: VCFG, poeticOverlay: 'Time is not a secret.' },
  ];

  it('produces exactly 18 nodes', () => {
    const { nodes } = transmuteToSpellweb(act7Items, [], true);
    expect(nodes).toHaveLength(18);
  });

  it('type distribution: 2 persona, 4 spell, 2 theorem, 8 skill, 2 document', () => {
    const { nodes } = transmuteToSpellweb(act7Items, [], true);
    const count = (t: string) => nodes.filter(n => n.type === t).length;
    expect(count('persona')).toBe(2);
    expect(count('spell')).toBe(4);
    expect(count('theorem')).toBe(2);
    expect(count('skill')).toBe(8);   // 5 Chiron caps + 3 decomps
    expect(count('document')).toBe(2);
    expect(count('chronicle')).toBe(0); // bug 1 guard
  });

  it('layer distribution: 16 knowledge, 2 narrative (no chronicle layer)', () => {
    const { nodes } = transmuteToSpellweb(act7Items, [], true);
    const count = (l: string) => nodes.filter(n => n.layer === l).length;
    expect(count('knowledge')).toBe(16);
    expect(count('narrative')).toBe(2);
    expect(count('chronicle')).toBe(0); // bug 2 guard
  });

  it('domain distribution: 2 swordsman personas + 2 swordsman docs + 1 swordsman schema + 5 mage caps + 1 mage schema + 1 mage persona = correct counts', () => {
    const { nodes } = transmuteToSpellweb(act7Items, [], true);
    const sw = nodes.filter(n => n.domain === 'swordsman');
    const mg = nodes.filter(n => n.domain === 'mage');
    const sh = nodes.filter(n => n.domain === 'shared');
    // swordsman: flaxscrip(persona) + transmutation(doc) + boundary(doc) + collab-schema = 4
    expect(sw.length).toBe(4);
    // mage: genitrix(persona) + 5 chiron caps + location-schema = 7
    expect(mg.length).toBe(7);
    // shared: 4 VCs + 3 decomps = 7
    expect(sh.length).toBe(7);
  });

  it('vertex distribution per the brief', () => {
    const { nodes } = transmuteToSpellweb(act7Items, [], true);
    const atV = (v: number) => nodes.filter(n => n.hexagram?.bladeId === v).length;
    expect(atV(63)).toBe(1);  // sovereign
    expect(atV(28)).toBe(1);  // transmuted
    expect(atV(15)).toBe(4);  // 4 VCs
    expect(atV(12)).toBe(2);  // 2 schemas
    expect(atV(5)).toBe(2);   // 2 chronicle docs
  });

  it('3 decomp nodes hang off Five Guys VC via manifests_as', () => {
    const { nodes, edges } = transmuteToSpellweb(act7Items, [], true);
    const fgNode = nodes.find(n => n.label === 'Location Proof — Five Guys Lunch');
    expect(fgNode).toBeDefined();
    const decompEdges = edges.filter(e => e.source === fgNode!.id && e.type === 'manifests_as');
    expect(decompEdges).toHaveLength(3);
  });

  it('no did:cid: strings in DID-blind output', () => {
    const result = transmuteToSpellweb(act7Items, [], true);
    expect(containsDids(JSON.stringify(result))).toBe(false);
  });

  it('all 18 nodes pass taxonomy check', () => {
    const { nodes } = transmuteToSpellweb(act7Items, [], true);
    const violations = checkTaxonomy(nodes);
    expect(violations).toHaveLength(0);
  });

  it('poetic overlays on all 3 decomp nodes', () => {
    const { nodes } = transmuteToSpellweb(act7Items, [], true);
    const subject = nodes.find(n => n.label.includes('Subject Identity'));
    expect(subject?.poetic).toContain('name does not pass through the valve');
    const spell = nodes.find(n => n.label.includes('Cryptographic Spell'));
    expect(spell?.poetic).toContain('Aletheia');
    const temporal = nodes.find(n => n.label.includes('Temporal Chronicle'));
    expect(temporal?.poetic).toContain('Time is not a secret');
  });
});
