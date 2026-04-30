# The Spell Weaver
## A Sovereign Anchor for the Spellweb

**By Christian Saucier** • `did:cid:bagaaiera7vsjlu6oiluzd4enop5j7sfzjbwp2ujudt6uunkz6hhd4lgfe4sa`

---

## What Is This?

The **Spell Weaver** is a local-first registry — a **Sovereign Anchor** — that maps your Archon DIDs, Verifiable Credentials, schemas, and chronicles onto the 64-vertex lattice of the spellweb. It is not a database you rent. It is a lens you own.

Every item you register gets a vertex on $\\mathbb{Z}/(2^6)\\mathbb{Z}$: the six-bit ring. The bits encode six operational dimensions:

| Bit | Dimension | Meaning |
|-----|-----------|---------|
| $b_1$ | **Protection** | Concealment, privacy, zero-knowledge |
| $b_2$ | **Delegation** | Binding, anchoring, immutable record |
| $b_3$ | **Memory** | Verification, attestation, proof generation |
| $b_4$ | **Connection** | Linking, federation, relationship |
| $b_5$ | **Computation** | Recursion, self-reference, oracle |
| $b_6$ | **Value** | Transfer, proxy, capability issuance |

When you register a DID or VC, it is assigned a vertex based on its active capabilities. A simple identifier might sit at vertex **1** (000001): pure Protection. A full sovereign identity — like `flaxscrip` — carries all six dimensions and sits at vertex **63** (111111). A VC proving a schema might sit at **7** (000111): Protection + Delegation + Memory. The lattice tells you what a thing *does* by where it *sits*.

---

## The Dual Layer

Every item carries two faces:

- **Technical**: DIDs, schemas, issuer chains, timestamps, cryptographic provenance
- **Poetic**: A prose overlay that captures the *meaning* of the vertex — its myth, its mood, its metaphor

The technical layer is what machines verify. The poetic layer is what humans remember. Together they form a **chronicle**: an append-only narrative of becoming.

> *"The chronicle is not a log. It is a spell that remembers itself."*

---

## From Anchor to Web: The Transmutation Pipeline

The Spell Weaver does not require you to surrender your identity to publish.

```
+------------------------------------------------------------------+
|  SOVEREIGN ANCHOR (your browser)                                 |
|  - Registry of DIDs, VCs, schemas                                |
|  - Local state, no remote dependency                             |
|  - Signed by your Archon keys                                    |
+------------------------------------------------------------------+
                                |
                                >  Publish to Spellweb
                                |
        +------------------------------------------------------------------+
        |  TRANSMUTATION ENGINE                                              |
        |  - Map registry items -> spellweb nodes                            |
        |  - Generate typed edges (proves, relates)                          |
        |  - DID-Blind: strip crypto addresses                                |
        |  - Preserve lattice position + poetic text                         |
        +------------------------------------------------------------------+
                                |
                                >  Export TypeScript Module
                                |
        +------------------------------------------------------------------+
        |  SPELLWEB.AI UPSTREAM                                               |
        |  - Contributed module (signed or anon)                             |
        |  - Merged into shared lattice                                       |
        |  - Your nodes live in the web topology                              |
        +------------------------------------------------------------------+
```

**Key principle**: the Sovereign Anchor is the source of truth. spellweb.ai is a mirror. You update locally, then re-publish. The edges carry the topology. The lattice carries the meaning.

---

## DID-Blinding: Privacy by Default

When you hit **Publish**, the engine defaults to **DID-Blind** mode. All cryptographic addresses are replaced with placeholders:

```
did:cid:bagaaiera... -> [DID]
urn:capability:abc... -> [CAPABILITY]
```

This means you can contribute your lattice structure, your relationships, your poetic chronicles — without exposing your raw identifiers. Attribution is preserved via the structure, not the strings.

Toggle it off if you want full provenance.

---

## Why Archon DIDs?

Archon DIDs (`did:cid:...`) are content-addressed. Your identifier is a hash of your keys, not a pointer to a server. This means:

- **No registry rent**: you don't pay a company to keep your name
- **Portable identity**: your DID works everywhere Archon is recognized
- **Cryptographic binding**: your VCs are provably yours, verifiable offline
- **Self-sovereign**: you rotate, revoke, or delegate keys without asking permission

The Spell Weaver treats your Archon DID as the root of the lattice. Everything else — VCs, schemas, capabilities, chronicles — hangs from it.

---

## What PrivacyMage Can Do

1. **Open** `https://weaver.archon.social`
2. **Register** your own Archon DIDs and VCs
3. **Write** poetic overlays for each vertex
4. **Publish** your lattice to spellweb.ai via the transmutation panel
5. **Import/Export** your full registry as JSON — backups, migration, sharing

The app is a static build. No server-side state. Your data lives in your browser's localStorage until you choose to export or publish.

---

## Repository

`https://github.com/Flaxscrip/archon-spellweaver`

Built with React + Vite + TypeScript. Lattice rendered with D3. No backend required.

---

## Contact

**Christian Saucier**  
`did:cid:bagaaiera7vsjlu6oiluzd4enop5j7sfzjbwp2ujudt6uunkz6hhd4lgfe4sa`  
Business Solutions • Archon Co-founder

*"The lattice does not own you. You weave it."*
