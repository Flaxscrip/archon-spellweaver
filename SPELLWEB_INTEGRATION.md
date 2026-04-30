# Spellweb.ai Integration Guide

## Goal

Keep building locally while maintaining a clean contribution path to the upstream
**spellweb.ai** knowledge graph.

---

## Data Model Compatibility

### Upstream Format (spellweb.ai)

The canonical spellweb stores data in **TypeScript modules** under `src/data/`:

```typescript
// src/data/nodes.ts
export const NODES: SpellwebNode[] = [
  { id: "doc-whitepaper", type: "document", label: "Whitepaper v4.7",
    domain: "shared", layer: "knowledge", desc: "...", version: "4.7" },
  // ...
];

// src/data/edges.ts
export const EDGES: SpellwebEdge[] = [
  { source: "doc-whitepaper", target: "con-dualagent", type: "defines" },
  // ...
];
```

**Node types:** `document` | `concept` | `theorem` | `spell` | `act` | `persona` | `term` | `skill` | `chronicle`

**Edge types:** `defines` | `proves` | `implements` | `extends` | `narrates` | `follows` | `references` | `compresses_to` | `contradicts` | `persona_knows` | `parent_of` | `embodies` | `requires` | `introduces` | `teaches` | `relates_to` | `measured_by` | `names` | `generates` | `delegates_via` | `manifests_as` | `reflects_through` | `remembers`

### Local Format (spellweb-registry)

Our registry uses a **simpler model** focused on identity:

```typescript
interface RegistryItem {
  id: string;
  type: 'did' | 'vc' | 'schema';
  label: string;
  did: string;
  vertexId: number;   // 0-63 lattice position
  stratum: number;
  createdAt: string;
  role?: 'sovereign' | 'transmuted' | 'schema' | 'issuer' | 'verifier';
  schemaDid?: string;
  issuerDid?: string;
  notes?: string;
  tags?: string[];
}
```

### Mapping Local → Upstream

| Local (Registry) | Upstream (Spellweb) | Notes |
|---|---|---|
| `RegistryItem` (DID) | `SpellwebNode` with `type: 'persona'` | A DID is a persona node |
| `RegistryItem` (VC) | `SpellwebNode` with `type: 'spell'` | A VC is a spell/credential |
| `RegistryItem` (Schema) | `SpellwebNode` with `type: 'theorem'` | Schema is a formal specification |
| `vertexId` | `hexagram.bladeId` | Convert via `computeHexagramInfo()` |
| `role: 'sovereign'` | `domain: 'first_person'` | Human principal |
| `role: 'transmuted'` | `domain: 'shared'` | Derived identity |
| `role: 'schema'` | `domain: 'shared'` | Shared specification |
| `role: 'issuer'` | `domain: 'swordsman'` | Credential issuer |
| `role: 'verifier'` | `domain: 'swordsman'` | Credential verifier |
| `schemaDid` link | `Edge: {source: vc, target: schema, type: 'proves'}` | VC proves schema |
| `issuerDid` link | `Edge: {source: issuer, target: vc, type: 'generates'}` | Issuer generates VC |

---

## Contribution Workflow

### Step 1: Export from Local Registry

The registry has an **Export** button that produces a JSON file:

```json
{
  "version": "spellweb-registry-v1",
  "exportedAt": "2026-04-28T14:30:00Z",
  "items": [
    {
      "id": "did-1745847600000",
      "type": "did",
      "label": "flaxscrip Sovereign",
      "did": "did:web:archetech.com",
      "vertexId": 63,
      "stratum": 6,
      "role": "sovereign",
      "createdAt": "2026-04-28T11:46:00Z"
    }
  ]
}
```

### Step 2: Transform to Upstream Format

Use the provided transform script:

```bash
# Convert registry export to spellweb node format
node scripts/export-to-spellweb.mjs registry-export.json flaxscrip > spellweb-contribution.ts
```

### Step 3: Fork & PR

```bash
# 1. Fork github.com/mitchuski/spellweb on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/spellweb.git
cd spellweb

# 3. Create a feature branch
git checkout -b registry/YYMMDD-flaxscrip-identities

# 4. Add your nodes to src/data/nodes.ts
# 5. Add your edges to src/data/edges.ts
# 6. Update the PRISM coordinates in node dimensions if known

# 7. Commit with semantic message
git add src/data/nodes.ts src/data/edges.ts
git commit -m "registry: add flaxscrip sovereign anchor + 3 VCs

- Register flaxscrip as sovereign persona at vertex 63
- Add MaternaLink schema (vertex 39)
- Add 3 decomposed VCs with selective disclosure
- Edges: issues / proves / attests relationships

All DIDs are real Archon testnet identities.
"

# 8. Push and open PR
git push origin registry/YYMMDD-flaxscrip-identities
```

### Step 4: PR Template

Use this template for registry contributions:

```markdown
## Registry Contribution

**Contributor:** @flaxscrip (via spellweb-registry local tool)
**Date:** YYYY-MM-DD
**Blades affected:** 5, 9, 10, 25, 38, 39, 63

### New Nodes
| ID | Type | Label | Vertex | Domain |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

### New Edges
| Source | Target | Type | Reason |
|---|---|---|---|
| ... | ... | ... | ... |

### Verification
- [ ] All DIDs resolve on Archon testnet
- [ ] Schema DID is registered
- [ ] VCs follow W3C VC v2 format
- [ ] Hexagram coordinates computed correctly

### Notes
Any context about these identities (demo scenario, test data, etc.)
```

---

## Blade Name Contribution Policy

The upstream reference sheet intentionally keeps **57 of 64 blades unnamed**.

**Canonical names (7 total):**
- 0: The Null Blade ☷
- 3: The Dual Agent ⚔️
- 21: The Prover 🛡️
- 42: The Answer 🔮
- 31: The Ascetic 📜
- 62: The Unguarded 🛡️
- 63: The Creative ☰

**Sovereign Anchor names (3 additional, not canonical):**
- 17: NIZK ⚔️ (from Part 2: The Boundary Blade)
- 25: Aletheia ⚔️ (from Part 3: Soulbae Oracle)
- 38: Lethe 🧙 (from Part 3: Soulbae Oracle)

**How to propose a new canonical name:**

1. Forge the blade on spellweb.ai (walk the constellation)
2. Document the experience in a chronicle
3. Open a PR against `reference/64_blades_reference_sheet.md`
4. Include: vertex, binary, active dimensions, *why* this name

> *"The names arrived from the experience. They were not assigned upfront."*

---

## Staying in Sync

### Upstream → Local

Watch the upstream repo for changes to `src/data/nodes.ts` and `src/data/edges.ts`:

```bash
# Add upstream remote
git remote add upstream https://github.com/mitchuski/spellweb.git

# Pull latest nodes/edges
git fetch upstream
git diff upstream/main -- src/data/nodes.ts src/data/edges.ts
```

If upstream adds new personas or documents relevant to your registry items, update your local `notes` or `tags` fields to reference them.

### Local → Upstream

Export and PR on a regular cadence:
- After each demo scenario
- After each new sovereign registration
- After significant VC issuance ceremonies

---

## File Structure

```
spellweb-registry/
├── src/
│   ├── types/registry.ts      ← Our local types + blade names
│   ├── data/lattice.ts        ← 64-vertex coordinates
│   ├── components/
│   │   ├── RegistryApp.tsx    ← Main UI + export button
│   │   ├── LatticeView.tsx    ← SVG lattice (shows canonical names)
│   │   ├── DIDForm.tsx        ← Register DID
│   │   ├── VCForm.tsx         ← Register VC
│   │   └── NodeList.tsx       ← List view
│   └── main.tsx
├── SPELLWEB_INTEGRATION.md  ← This file
└── scripts/
    └── export-to-spellweb.mjs  ← Transform script (Node ES module)
```

---

## Demo Checklist

Before showing the registry in a demo:

- [ ] Register your sovereign DID at a meaningful vertex
- [ ] Register at least one schema DID
- [ ] Register 2-3 VCs showing selective disclosure
- [ ] Verify canonical blade names are visible on the lattice
- [ ] Export the registry state to JSON
- [ ] Have the upstream PR template ready
- [ ] Know which vertex each persona occupies and why

---

*"The forge doesn't care how you struck the metal. It only cares what blade you hold."*
