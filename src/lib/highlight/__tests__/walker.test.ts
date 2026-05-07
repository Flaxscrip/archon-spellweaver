import { describe, it, expect } from 'vitest';
import type { RegistryItem } from '../../../types/registry';
import { buildGraph } from '../graph';
import { walkFrom } from '../walker';

// ── Fixture helpers ──────────────────────────────────────────────────────────

function item(
  id: string,
  did: string,
  vertexId: number,
  overrides: Partial<RegistryItem> = {},
): RegistryItem {
  return {
    type: 'did',
    label: id,
    stratum: 0,
    createdAt: '2026-01-01T00:00:00Z',
    id,
    did,
    vertexId,
    ...overrides,
  } as RegistryItem;
}

// Core fixture: sovereign → agent → child capability
//              vc links to sovereign (subject), agent (issuer), schema
const sovereign  = item('i-sovereign', 'did:cid:sovereign', 63);
const agent      = item('i-agent',     'did:cid:agent',     28, { parentDid: 'did:cid:sovereign' });
const cap        = item('i-cap',       'did:cid:cap',        4, { parentDid: 'did:cid:agent' });
const schema     = item('i-schema',    'did:cid:schema',    12, { type: 'schema' });
const vc         = item('i-vc',        'did:cid:vc',        21, {
  type: 'vc',
  issuerDid:  'did:cid:agent',
  subjectDid: 'did:cid:sovereign',
  schemaDid:  'did:cid:schema',
});
const asset      = item('i-asset',     'did:cid:asset',      5, {
  type: 'asset',
  controllerDid: 'did:cid:sovereign',
});

const ALL_ITEMS = [sovereign, agent, cap, schema, vc, asset];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('walkFrom — each relation kind in isolation', () => {
  it('parent: walks from child to its parent vertex', () => {
    const g = buildGraph([sovereign, agent]);
    const result = walkFrom(g, [agent], { relations: ['parent'] });

    expect(result.vertices).toContain(agent.vertexId);
    expect(result.vertices).toContain(sovereign.vertexId);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      from: agent.vertexId,
      to: sovereign.vertexId,
      relation: 'parent',
    });
  });

  it('child: walks from parent to child vertices', () => {
    const g = buildGraph([sovereign, agent]);
    const result = walkFrom(g, [sovereign], { relations: ['child'] });

    expect(result.vertices).toContain(agent.vertexId);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({ relation: 'child', from: sovereign.vertexId, to: agent.vertexId });
  });

  it('schema: walks from VC to its schema vertex', () => {
    const g = buildGraph([vc, schema]);
    const result = walkFrom(g, [vc], { relations: ['schema'] });

    expect(result.vertices).toContain(schema.vertexId);
    expect(result.edges[0]).toMatchObject({ relation: 'schema', to: schema.vertexId });
  });

  it('issuer: walks from VC to its issuer vertex', () => {
    const g = buildGraph([vc, agent]);
    const result = walkFrom(g, [vc], { relations: ['issuer'] });

    expect(result.vertices).toContain(agent.vertexId);
    expect(result.edges[0]).toMatchObject({ relation: 'issuer', to: agent.vertexId });
  });

  it('subject: walks from VC to its subject vertex', () => {
    const g = buildGraph([vc, sovereign]);
    const result = walkFrom(g, [vc], { relations: ['subject'] });

    expect(result.vertices).toContain(sovereign.vertexId);
    expect(result.edges[0]).toMatchObject({ relation: 'subject', to: sovereign.vertexId });
  });

  it('controller: walks from asset to its controller vertex', () => {
    const g = buildGraph([asset, sovereign]);
    const result = walkFrom(g, [asset], { relations: ['controller'] });

    expect(result.vertices).toContain(sovereign.vertexId);
    expect(result.edges[0]).toMatchObject({ relation: 'controller', to: sovereign.vertexId });
  });
});

describe('walkFrom — seed variants', () => {
  it('accepts a RegistryItem directly', () => {
    const g = buildGraph([sovereign, agent]);
    const result = walkFrom(g, [sovereign]);
    expect(result.vertices).toContain(agent.vertexId);
  });

  it('accepts an item id string', () => {
    const g = buildGraph([sovereign, agent]);
    const result = walkFrom(g, ['i-sovereign']);
    expect(result.vertices).toContain(agent.vertexId);
  });

  it('accepts a DID string', () => {
    const g = buildGraph([sovereign, agent]);
    const result = walkFrom(g, ['did:cid:sovereign']);
    expect(result.vertices).toContain(agent.vertexId);
  });

  it('accepts a { vertexId } object and expands to all items at that vertex', () => {
    const g = buildGraph([sovereign, agent]);
    const result = walkFrom(g, [{ vertexId: sovereign.vertexId }]);
    expect(result.vertices).toContain(agent.vertexId);
  });
});

describe('walkFrom — deduplication', () => {
  it('multi-seed: does not duplicate edges when two seeds share a neighbor', () => {
    // Both vc and agent point to sovereign (vc via subject, agent via parent)
    const g = buildGraph(ALL_ITEMS);
    const result = walkFrom(g, [vc, agent]);

    // sovereign appears once in vertices
    const sovereignEdges = result.edges.filter(e => e.to === sovereign.vertexId);
    // There should be exactly two edges TO sovereign: subject (from vc) and parent (from agent)
    expect(sovereignEdges.map(e => e.relation).sort()).toEqual(['parent', 'subject']);
  });

  it('does not duplicate vertices when multiple paths reach the same vertex', () => {
    const g = buildGraph(ALL_ITEMS);
    const result = walkFrom(g, [vc, agent]);
    const sovereignCount = Array.from(result.vertices).filter(v => v === sovereign.vertexId).length;
    expect(sovereignCount).toBe(1);
  });

  it('deduplicates edges with same (from, to, relation) across multi-seed calls', () => {
    // Two seeds at the same vertex → same edges should not be emitted twice
    const g = buildGraph([sovereign, agent]);
    const result = walkFrom(g, [sovereign, sovereign]);
    const childEdges = result.edges.filter(e => e.relation === 'child');
    expect(childEdges).toHaveLength(1);
  });
});

describe('walkFrom — hop depth', () => {
  it('hops=0: returns only seed vertices, no edges', () => {
    const g = buildGraph(ALL_ITEMS);
    const result = walkFrom(g, [agent], { hops: 0 });

    expect(result.vertices).toEqual(new Set([agent.vertexId]));
    expect(result.edges).toHaveLength(0);
    expect(result.items).toEqual(new Set([agent.id]));
  });

  it('hops=1 (default): reaches direct neighbors only', () => {
    const g = buildGraph([sovereign, agent, cap]);
    const result = walkFrom(g, [sovereign]);

    // sovereign → agent (child at hop 1), but cap is at hop 2
    expect(result.vertices).toContain(agent.vertexId);
    expect(result.vertices).not.toContain(cap.vertexId);
  });

  it('hops=2: reaches grandchildren', () => {
    const g = buildGraph([sovereign, agent, cap]);
    const result = walkFrom(g, [sovereign], { hops: 2 });

    // sovereign → agent (hop 1) → cap (hop 2)
    expect(result.vertices).toContain(agent.vertexId);
    expect(result.vertices).toContain(cap.vertexId);
  });

  it('hops=2 items set includes grandchildren', () => {
    const g = buildGraph([sovereign, agent, cap]);
    const result = walkFrom(g, [sovereign], { hops: 2 });
    expect(result.items).toContain(cap.id);
  });
});

describe('walkFrom — edge cases', () => {
  it('returns empty result for empty seeds', () => {
    const g = buildGraph(ALL_ITEMS);
    const result = walkFrom(g, []);
    expect(result.vertices.size).toBe(0);
    expect(result.edges).toHaveLength(0);
    expect(result.items.size).toBe(0);
  });

  it('returns only seed vertex when item has no relationships', () => {
    const isolated = item('i-lone', 'did:cid:lone', 9);
    const g = buildGraph([isolated]);
    const result = walkFrom(g, [isolated]);
    expect(result.vertices).toEqual(new Set([9]));
    expect(result.edges).toHaveLength(0);
  });

  it('unknown string seed is silently ignored', () => {
    const g = buildGraph(ALL_ITEMS);
    const result = walkFrom(g, ['did:cid:does-not-exist']);
    expect(result.vertices.size).toBe(0);
  });

  it('vertex seed with no items at that vertex returns the vertex but no edges', () => {
    const g = buildGraph([sovereign]);
    const result = walkFrom(g, [{ vertexId: 99 }]);
    expect(result.vertices).toContain(99);
    expect(result.edges).toHaveLength(0);
  });
});
