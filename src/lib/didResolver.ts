// ═══════════════════════════════════════════════════════════════
// DID DOCUMENT RESOLVER — extracts controller from Archon DIDs
// ═══════════════════════════════════════════════════════════════

const ARCHON_RESOLVER = 'https://archon.technology/api/v1/did';

export interface DIDDocument {
  id: string;
  controller?: string | string[];
  verificationMethod?: Array<{
    id: string;
    type: string;
    controller: string;
  }>;
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
}

const cache = new Map<string, DIDDocument>();

export async function resolveDID(did: string): Promise<DIDDocument | null> {
  if (cache.has(did)) return cache.get(did)!;

  try {
    // Only resolve did:cid DIDs via Archon
    if (!did.startsWith('did:cid:')) return null;

    const res = await fetch(`${ARCHON_RESOLVER}/${encodeURIComponent(did)}`);
    if (!res.ok) return null;

    const doc = await res.json() as DIDDocument;
    cache.set(did, doc);
    return doc;
  } catch {
    return null;
  }
}

export function getController(doc: DIDDocument): string | null {
  if (!doc.controller) return null;
  if (Array.isArray(doc.controller)) return doc.controller[0] || null;
  return doc.controller;
}
