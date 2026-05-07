import { describe, it, expect } from 'vitest';
import type { RegistryItem } from '../../../types/registry';
import { extractRelations } from '../relations';

function makeItem(overrides: Partial<RegistryItem> & Pick<RegistryItem, 'id' | 'did' | 'vertexId'>): RegistryItem {
  return {
    type: 'did',
    label: overrides.id,
    stratum: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as RegistryItem;
}

describe('extractRelations', () => {
  it('returns empty array when item has no relation fields', () => {
    const item = makeItem({ id: 'i1', did: 'did:cid:a', vertexId: 0 });
    expect(extractRelations(item)).toEqual([]);
  });

  it('extracts parent relation', () => {
    const item = makeItem({ id: 'i1', did: 'did:cid:child', vertexId: 4, parentDid: 'did:cid:parent' });
    const rels = extractRelations(item);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toEqual({ targetDid: 'did:cid:parent', relation: 'parent' });
  });

  it('extracts schema relation', () => {
    const item = makeItem({ id: 'i1', did: 'did:cid:vc', vertexId: 21, schemaDid: 'did:cid:schema' });
    const rels = extractRelations(item);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toEqual({ targetDid: 'did:cid:schema', relation: 'schema' });
  });

  it('extracts issuer relation', () => {
    const item = makeItem({ id: 'i1', did: 'did:cid:vc', vertexId: 21, issuerDid: 'did:cid:issuer' });
    const rels = extractRelations(item);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toEqual({ targetDid: 'did:cid:issuer', relation: 'issuer' });
  });

  it('extracts subject relation', () => {
    const item = makeItem({ id: 'i1', did: 'did:cid:vc', vertexId: 21, subjectDid: 'did:cid:subject' });
    const rels = extractRelations(item);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toEqual({ targetDid: 'did:cid:subject', relation: 'subject' });
  });

  it('extracts controller relation', () => {
    const item = makeItem({ id: 'i1', did: 'did:cid:asset', vertexId: 5, controllerDid: 'did:cid:ctrl' });
    const rels = extractRelations(item);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toEqual({ targetDid: 'did:cid:ctrl', relation: 'controller' });
  });

  it('extracts multiple relations in canonical order', () => {
    const item = makeItem({
      id: 'i1', did: 'did:cid:vc', vertexId: 21,
      parentDid: 'did:cid:p', schemaDid: 'did:cid:s', issuerDid: 'did:cid:iss',
      subjectDid: 'did:cid:sub', controllerDid: 'did:cid:ctrl',
    });
    const rels = extractRelations(item);
    expect(rels.map(r => r.relation)).toEqual(['parent', 'schema', 'issuer', 'subject', 'controller']);
  });
});
