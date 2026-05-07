import type { RegistryItem } from '../../types/registry';

// Six semantic relation kinds between registry items.
// Canonical walk order: parent → schema → issuer → subject → controller → children (child is inverse of parent).
export type Relation = 'parent' | 'child' | 'schema' | 'issuer' | 'subject' | 'controller';

export interface RelationPointer {
  targetDid: string;
  relation: Relation;
}

/**
 * Returns the forward-direction DID pointers declared on an item.
 * Child (inverse-parent) links are NOT included here — the graph builds
 * that index and getNeighbors adds them.
 */
export function extractRelations(item: RegistryItem): RelationPointer[] {
  const result: RelationPointer[] = [];
  if (item.parentDid)     result.push({ targetDid: item.parentDid,     relation: 'parent' });
  if (item.schemaDid)     result.push({ targetDid: item.schemaDid,     relation: 'schema' });
  if (item.issuerDid)     result.push({ targetDid: item.issuerDid,     relation: 'issuer' });
  if (item.subjectDid)    result.push({ targetDid: item.subjectDid,    relation: 'subject' });
  if (item.controllerDid) result.push({ targetDid: item.controllerDid, relation: 'controller' });
  return result;
}
