import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { RegistryItem, RegistryState } from '../types/registry';
import { REGISTRY_STORAGE_KEY, CHRONICLE_STORAGE_KEY } from '../types/registry';
import type { ChronicleEntry } from '../types/registry';
import { LatticeView } from './LatticeView';
import { DIDForm } from './DIDForm';
import { VCForm } from './VCForm';
import { NodeList } from './NodeList';
import { ChroniclePanel } from './ChroniclePanel';
import { OraclePanel } from './OraclePanel';
import { PublishPanel } from './PublishPanel';
import { resolveDID, getController } from '../lib/didResolver';
import { buildGraph, walkFrom } from '../lib/highlight';
import { MageIdentityPanel } from './MageIdentityPanel';

import {
  getVertexDimensions,
  getStratum,
  toBinary,
  getDimensionNames,
  getDimensionEmoji,
  getStratumColor,
  getVertexLabel,
  BLADE_NAMES,
} from '../types/registry';

type Tab = 'lattice' | 'dids' | 'vcs' | 'all';

// Returns the default poetic overlay text for any item type.
// Used both when registering a new item and when enriching loaded act chronicle entries.
function generatePoetic(item: RegistryItem): string {
  if (item.poeticOverlay) return item.poeticOverlay;
  switch (item.type) {
    case 'did':
      return item.role === 'sovereign'
        ? `At the crest of the Dragon, where all six dimensions burn as one,\na sovereign stepped forward and named themselves.\nThe lattice, which had waited for this moment,\nwhispered back: Welcome home, First Person.`
        : `From the forge of forgetting came a new form.\nIt carries the moon's discipline: reflection without possession,\nservice without origin. The lattice does not ask who sent it.\nIt only asks: does it hold the boundary?`;
    case 'vc':
      return `A credential was spoken at the boundary between two names.\nWhat passes between them is not data, but proof of relationship.\nThe oracle does not say what was promised.\nIt only says: the promise was real.`;
    case 'schema':
      return `Before there was a place, there was a question.\nBefore the question could be answered,\na schema had to be born to hold the shape of meaning\nwithout holding the meaning itself.\nThe map is not the territory.\nBut without the map, the proof has no grammar.`;
    case 'asset':
      return `What was once intangible now has a blade-address.\nThe asset does not exist in a vault.\nIt exists in the lattice, where ownership is proven, not possessed.`;
    case 'capability':
      return `A fragment of power was separated from its source\nand given its own address.\nThe capability does not contain the whole.\nIt contains exactly enough.`;
    default:
      return '';
  }
}

// Story manifest type
interface StoryAct {
  act: number;
  title: string;
  file: string;
}
interface StoryManifest {
  title: string;
  acts: StoryAct[];
}

// If ?act=N is present, skip localStorage so the act loader starts clean.
const hasActParam = new URLSearchParams(window.location.search).has('act');

export default function RegistryApp() {
  const [items, setItems] = useState<RegistryItem[]>(() => {
    if (hasActParam) return [];
    try {
      const saved = localStorage.getItem(REGISTRY_STORAGE_KEY);
      if (saved) {
        const state: RegistryState = JSON.parse(saved);
        return state.items || [];
      }
    } catch { /* ignore */ }
    return [];
  });

  const [seedLoaded, setSeedLoaded] = useState(false);

  // ?act=N — clear and import the mapped act file from story.json
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const actParam = params.get('act');
    if (!actParam) return;

    fetch('/story.json')
      .then(r => r.json())
      .then((story: StoryManifest) => {
        const actDef = story.acts.find(a => String(a.act) === actParam);
        if (!actDef) return null;
        return fetch(`/${actDef.file}`)
          .then(r => r.json())
          .then((data: { items?: RegistryItem[]; chronicle?: ChronicleEntry[] }) => ({ data, actDef }));
      })
      .then(result => {
        if (!result) return;
        const { data } = result;
        if (!data.items || !Array.isArray(data.items)) return;
        localStorage.removeItem(REGISTRY_STORAGE_KEY);
        localStorage.removeItem(CHRONICLE_STORAGE_KEY);

        const loadedItems: RegistryItem[] = data.items;
        const itemById = new Map(loadedItems.map(i => [i.id, i]));

        // Enrich chronicle entries that are missing poeticOverlay — act files
        // are often created without them since they bypass the handleAddItem flow.
        const enrichedChronicle: ChronicleEntry[] = (
          data.chronicle && Array.isArray(data.chronicle) ? data.chronicle : []
        ).map(entry => {
          if (entry.poeticOverlay) return entry;
          if (!entry.itemId) return entry;
          const item = itemById.get(entry.itemId);
          if (!item) return entry;
          const poetic = generatePoetic(item);
          return poetic ? { ...entry, poeticOverlay: poetic } : entry;
        });

        setItems(loadedItems);
        setChronicle(enrichedChronicle);
      })
      .catch(() => { /* ignore */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ?seed=1 — load seed file only when registry is empty (legacy)
  useEffect(() => {
    if (seedLoaded) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get('act') && params.get('seed') === '1' && items.length === 0) {
      fetch('/registry-seed.json')
        .then(r => r.json())
        .then((data: { items: RegistryItem[]; chronicle?: ChronicleEntry[] }) => {
          if (data.items && data.items.length > 0) {
            setItems(data.items);
            if (data.chronicle && data.chronicle.length > 0) {
              setChronicle(data.chronicle);
            }
            setSeedLoaded(true);
          }
        })
        .catch(() => { /* ignore */ });
    }
    setSeedLoaded(true);
  }, [items.length, seedLoaded]);

  const [chronicle, setChronicle] = useState<ChronicleEntry[]>(() => {
    if (hasActParam) return [];
    try {
      const saved = localStorage.getItem(CHRONICLE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  });

  const [activeTab, setActiveTab] = useState<Tab>('lattice');
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const handleHoverItem = useCallback((id: string | null) => {
    setHoveredItemId(id);
    if (id) setHoveredChronicleVertices(new Set());
  }, []);

  // Clear item selection when vertex is selected (cleanup highlighted paths)
  const handleSelectVertex = (vertex: number | null) => {
    setSelectedVertex(vertex);
    setSelectedItemId(null);
    setHoveredItemId(null);
    setHoveredChronicleVertices(new Set());
  };

  // Clear vertex selection when item is selected (cleanup highlighted paths)
  const handleSelectItem = (itemId: string | null) => {
    setSelectedItemId(itemId);
    setHoveredItemId(null);
    setHoveredChronicleVertices(new Set());
    if (itemId) {
      setSelectedVertex(null);
    }
  };

  // Clear hover state when chronicle panel is closed
  const handleCloseChronicle = () => {
    setShowChronicle(false);
    setHoveredItemId(null);
    setHoveredChronicleVertices(new Set());
  };
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showChronicle, setShowChronicle] = useState(false);
  const [showOracle, setShowOracle] = useState(false);
  const [formType, setFormType] = useState<'did' | 'vc'>('did');
  const [hoveredChronicleVertices, setHoveredChronicleVertices] = useState<Set<number>>(new Set());
  const [showPublish, setShowPublish] = useState(false);

  // Import file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist to localStorage
  useEffect(() => {
    const state: RegistryState = { items, chronicle, version: 2 };
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(CHRONICLE_STORAGE_KEY, JSON.stringify(chronicle));
  }, [items, chronicle]);

  const addChronicle = useCallback((entry: ChronicleEntry) => {
    setChronicle(prev => [...prev, entry]);
  }, []);

  // Auto-populate chronicle for items without chronicle entries (for bulk-added data)
  const populateChronicleForExistingItems = useCallback(() => {
    const itemsWithChronicle = new Set(chronicle.map(c => c.itemId).filter(Boolean));
    const itemsNeedingChronicle = items.filter(item => !itemsWithChronicle.has(item.id));
    
    if (itemsNeedingChronicle.length > 0) {
      console.log(`Auto-populating chronicle for ${itemsNeedingChronicle.length} items`);
      
      itemsNeedingChronicle.forEach(item => {
        let text = '';
        let poetic = '';
        
        switch (item.type) {
          case 'did':
            const verb = item.role === 'sovereign' ? 'claimed the Sovereign Anchor' : 'transmuted';
            text = `${item.label} ${verb} at Blade ${item.vertexId} (S${item.stratum}).`;
            break;
          case 'vc':
            const issuer = items.find(i => i.did === item.issuerDid);
            const subject = items.find(i => i.did === item.subjectDid);
            if (issuer && subject) {
              text = `${issuer.label} spoke a credential to ${subject.label} at Blade ${item.vertexId}.`;
            } else {
              text = `Credential registered at Blade ${item.vertexId}.`;
            }
            break;
          case 'schema':
            text = `Schema "${item.label}" registered at Blade ${item.vertexId}.`;
            break;
          case 'asset':
            text = `Chronicle "${item.label}" registered at Blade ${item.vertexId}.`;
            break;
          case 'capability':
            const parent = items.find(i => i.did === item.parentDid);
            if (parent) {
              text = `Capability "${item.label}" decomposed from ${parent.label} at Blade ${item.vertexId}.`;
            } else {
              text = `Capability "${item.label}" registered at Blade ${item.vertexId}.`;
            }
            break;
        }
        
        addChronicle({
          id: `ch-auto-${item.id}`,
          text,
          poeticOverlay: poetic || undefined,
          verb: 'imported',
          vertexId: item.vertexId,
          itemId: item.id,
          timestamp: item.createdAt,
          tags: item.tags,
        });
      });
    }
  }, [items, chronicle, addChronicle]);

  const handleAddItem = useCallback((item: RegistryItem) => {
    const isNew = !items.find(i => i.id === item.id);
    // Guardrail: reject duplicate DIDs (except self-updates)
    if (isNew) {
      const dup = items.find(i => i.did === item.did);
      if (dup) {
        alert(`\u26a0\ufe0f Duplicate DID detected.\n\n"${item.did}" is already registered as "${dup.label}" at Blade ${dup.vertexId}.\n\nEach identity needs a unique DID. Issue a new one from your wallet.`);
        return;
      }
    }
    setItems(prev => {
      const existing = prev.findIndex(i => i.id === item.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = item;
        return next;
      }
      return [...prev, item];
    });
    // Chronicle the event with rich context-aware narrative
    const blade = item.vertexId;
    const s = item.stratum;

    // Resolve related identities from registry
    const issuer = item.issuerDid ? items.find(i => i.did === item.issuerDid) : undefined;
    const subject = item.subjectDid ? items.find(i => i.did === item.subjectDid) : undefined;
    const schema = item.schemaDid ? items.find(i => i.did === item.schemaDid) : undefined;
    const parent = item.parentDid ? items.find(i => i.did === item.parentDid) : undefined;

    let text = '';
    const poetic = generatePoetic(item);

    switch (item.type) {
      case 'did': {
        const verb = item.role === 'sovereign' ? 'claimed the Sovereign Anchor' : 'transmuted';
        text = `${item.label} ${verb} at Blade ${blade} (S${s}).`;
        if (item.notes) text += ` ${item.notes}`;
        break;
      }
      case 'vc': {
        if (issuer && subject && schema) {
          text = `${issuer.label} issued a ${schema.label} VC for ${subject.label} at Blade ${blade} (S${s}).`;
        } else if (issuer && subject) {
          text = `${issuer.label} issued ${item.label} for ${subject.label} at Blade ${blade} (S${s}).`;
        } else if (issuer) {
          text = `${issuer.label} spoke a credential at Blade ${blade} (S${s}).`;
        } else {
          text = `${item.label} spoke a credential at Blade ${blade} (S${s}).`;
        }
        if (item.notes) text += ` ${item.notes}`;
        break;
      }
      case 'schema': {
        text = `${item.label} schema inscribed at Blade ${blade} (S${s}).`;
        if (item.notes) text += ` ${item.notes}`;
        break;
      }
      case 'asset': {
        text = `${item.label} tokenized at Blade ${blade} (S${s}).`;
        if (item.notes) text += ` ${item.notes}`;
        break;
      }
      case 'capability': {
        text = `${item.label} forged at Blade ${blade} (S${s}).`;
        if (parent) text += ` Parent: ${parent.label}.`;
        if (item.notes) text += ` ${item.notes}`;
        break;
      }
    }

    addChronicle({
      id: `ch-${Date.now()}`,
      text,
      poeticOverlay: poetic || undefined,
      verb: 'registered',
      vertexId: item.vertexId,
      itemId: item.id,
      timestamp: new Date().toISOString(),
      tags: item.tags,
    });
    if (isNew) {
      setShowChronicle(true);
      setShowAddPanel(false);
    } else {
      setShowAddPanel(false);
    }
  }, [items, addChronicle]);

  const handleDeleteItem = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      addChronicle({
        id: `ch-${Date.now()}-${id.slice(-6)}`,
        text: `${item.label} was unbound from Blade ${item.vertexId}.`,
        verb: 'cleared',
        vertexId: item.vertexId,
        itemId: item.id,
        timestamp: new Date().toISOString(),
      });
    }
    setItems(prev => prev.filter(i => i.id !== id));
  }, [items, addChronicle]);

  const dids = items.filter(i => i.type === 'did');
  const vcs = items.filter(i => i.type === 'vc');
  const schemas = items.filter(i => i.type === 'schema');
  const assets = items.filter(i => i.type === 'asset');
  const capabilities = items.filter(i => i.type === 'capability');

  // Graph index rebuilt whenever items change
  const graph = useMemo(() => buildGraph(items), [items]);

  // Count per vertex (derived from graph index)
  const vertexCounts = useMemo(() => {
    const counts = new Map<number, number>();
    items.forEach(item => counts.set(item.vertexId, (counts.get(item.vertexId) || 0) + 1));
    return counts;
  }, [items]);

  // ═══════════════════════════════════════════════════════════════
  // Auto-resolve controller DIDs from DID Documents
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const unresolved = items.filter(
      i => i.type === 'did' && i.did.startsWith('did:cid:') && !i.controllerDid
    );
    if (unresolved.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const item of unresolved) {
        if (cancelled) break;
        const doc = await resolveDID(item.did);
        if (doc) {
          const ctrl = getController(doc);
          if (ctrl) {
            setItems(prev =>
              prev.map(i => (i.id === item.id ? { ...i, controllerDid: ctrl } : i))
            );
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, [items]);

  // ═══════════════════════════════════════════════════════════════
  // TRACEROUTE: highlighted connections via shared graph walker
  // ═══════════════════════════════════════════════════════════════
  const highlightedConnections = useMemo(() => {
    if (selectedItemId) {
      return walkFrom(graph, [selectedItemId]);
    }
    if (hoveredItemId) {
      return walkFrom(graph, [hoveredItemId]);
    }
    if (hoveredChronicleVertices.size > 0) {
      const seeds = Array.from(hoveredChronicleVertices).map(vertexId => ({ vertexId }));
      return walkFrom(graph, seeds);
    }
    return { vertices: new Set<number>(), edges: [], items: new Set<string>() };
  }, [graph, selectedItemId, hoveredItemId, hoveredChronicleVertices]);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-primary text-text-primary overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-panel">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✦</span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-text-bright">
              Spell Weaver
            </h1>
            <p className="text-xs text-text-dim font-mono">
              Sovereign Anchor — Z/(2⁶)Z
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <MageIdentityPanel />

          <div className="flex gap-1 bg-bg-card rounded-lg p-1">
            {([
              { key: 'lattice', label: 'Lattice', icon: '🔳' },
              { key: 'dids', label: `DIDs (${dids.length})`, icon: '🔐' },
              { key: 'vcs', label: `VCs (${vcs.length})`, icon: '📋' },
              { key: 'all', label: 'All', icon: '📊' },
            ] as { key: Tab; label: string; icon: string }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
                  activeTab === tab.key
                    ? 'bg-accent text-black font-semibold'
                    : 'text-text-dim hover:text-text-primary'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              const exportData = {
                version: 'spellweb-registry-v1',
                exportedAt: new Date().toISOString(),
                items,
                chronicle,
                bladeNames: Object.fromEntries(
                  Object.entries(BLADE_NAMES).map(([k, v]) => [k, { name: v.name, emoji: v.emoji, isCanonical: v.isCanonical }])
                ),
              };
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `spellweb-registry-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="btn btn-secondary text-xs"
            title="Export registry for spellweb.ai contribution"
          >
            ⬇️ Export
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                try {
                  const data = JSON.parse(ev.target?.result as string);
                  if (data.items && Array.isArray(data.items)) {
                    setItems(data.items);
                    addChronicle({
                      id: `ch-${Date.now()}`,
                      text: `A chronicle was recalled from the archive. ${data.items.length} items returned to the lattice.`,
                      verb: 'imported',
                      vertexId: null,
                      itemId: null,
                      timestamp: new Date().toISOString(),
                      metadata: { count: data.items.length },
                    });
                    // Also import chronicle if present
                    if (data.chronicle && Array.isArray(data.chronicle)) {
                      setChronicle(prev => [...data.chronicle, ...prev]);
                    }
                    alert(`Imported ${data.items.length} items.`);
                  } else {
                    alert('Invalid registry file: no items array found.');
                  }
                } catch {
                  alert('Failed to parse JSON file.');
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
              };
              reader.readAsText(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary text-xs"
            title="Import registry from JSON"
          >
            ⬆️ Import
          </button>

          <button
            onClick={() => {
              if (confirm('Clear all registry items? This cannot be undone.')) {
                addChronicle({
                  id: `ch-${Date.now()}`,
                  text: `The lattice was silenced. All blades returned to sleep.`,
                  verb: 'cleared',
                  vertexId: null,
                  itemId: null,
                  timestamp: new Date().toISOString(),
                  metadata: { count: items.length },
                });
                setItems([]);
                setChronicle([]);
                handleSelectVertex(null);
                localStorage.removeItem(REGISTRY_STORAGE_KEY);
                localStorage.removeItem(CHRONICLE_STORAGE_KEY);
              }
            }}
            className="btn btn-secondary text-xs text-danger hover:text-danger"
            title="Clear all items"
          >
            🗑️ Clear
          </button>

          <button
            onClick={() => { setShowChronicle(!showChronicle); setShowAddPanel(false); setShowOracle(false); if (showChronicle) setHoveredChronicleVertices(new Set()); }}
            className={`btn text-xs ${showChronicle ? 'btn-accent' : 'btn-secondary'}`}
          >
            📜 Chronicle
          </button>

          <button
            onClick={() => { setShowOracle(!showOracle); setShowAddPanel(false); handleCloseChronicle(); }}
            className={`btn text-xs ${showOracle ? 'btn-accent' : 'btn-secondary'}`}
          >
            🔮 Oracle
          </button>

          <button
            onClick={() => { setShowPublish(true); setShowAddPanel(false); handleCloseChronicle(); setShowOracle(false); }}
            className={`btn text-xs ${showPublish ? 'btn-accent' : 'btn-secondary'}`}
          >
            📤 Publish
          </button>

          <button
            onClick={() => { setShowAddPanel(true); handleCloseChronicle(); setShowOracle(false); setFormType('did'); }}
            className="btn btn-primary text-xs"
          >
            + Register
          </button>
        </div>
      </header>

      {/* Publish to Spellweb panel */}
      {showPublish && (
        <PublishPanel
          items={items}
          chronicle={chronicle}
          onClose={() => setShowPublish(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Lattice or List */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'lattice' && (
            <LatticeView
              vertexCounts={vertexCounts}
              selectedVertex={selectedVertex}
              hoveredVertices={hoveredChronicleVertices}
              onSelectVertex={handleSelectVertex}
              items={items}
              highlightedConnections={highlightedConnections}
              selectedItemId={selectedItemId}
              onSelectItem={handleSelectItem}
            />
          )}
          {activeTab === 'dids' && (
            <NodeList
              items={dids}
              title="Registered DIDs"
              onDelete={handleDeleteItem}
              onSelectVertex={handleSelectVertex}
              setTab={setActiveTab}
            />
          )}
          {activeTab === 'vcs' && (
            <NodeList
              items={vcs}
              title="Registered VCs"
              onDelete={handleDeleteItem}
              onSelectVertex={handleSelectVertex}
              setTab={setActiveTab}
            />
          )}
          {activeTab === 'all' && (
            <NodeList
              items={items}
              title="All Registry Items"
              onDelete={handleDeleteItem}
              onSelectVertex={handleSelectVertex}
              setTab={setActiveTab}
            />
          )}
        </div>

        {/* Right panel: Add/Detail */}
        {showAddPanel && (
          <div className="w-[420px] border-l border-border bg-bg-panel flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text-bright">
                Register New Item
              </h2>
              <button
                onClick={() => setShowAddPanel(false)}
                className="text-text-dim hover:text-danger text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-4 py-3 border-b border-border">
              <div className="flex gap-2">
                <button
                  onClick={() => setFormType('did')}
                  className={`flex-1 py-2 rounded-md text-xs font-mono border ${
                    formType === 'did'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text-dim hover:border-border-hover'
                  }`}
                >
                  🔐 Transmuted DID
                </button>
                <button
                  onClick={() => setFormType('vc')}
                  className={`flex-1 py-2 rounded-md text-xs font-mono border ${
                    formType === 'vc'
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text-dim hover:border-border-hover'
                  }`}
                >
                  📋 Decomposed VC
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {formType === 'did' ? (
                <DIDForm
                  onSubmit={handleAddItem}
                  selectedVertex={selectedVertex}
                  existingItems={items}
                />
              ) : (
                <VCForm
                  onSubmit={handleAddItem}
                  selectedVertex={selectedVertex}
                  availableDIDs={items}
                />
              )}
            </div>
          </div>
        )}

        {/* Right panel: Chronicle */}
        {showChronicle && !showAddPanel && (
          <ChroniclePanel
            entries={chronicle}
            items={items}
            onClose={handleCloseChronicle}
            onSelectVertex={(v) => {
              handleSelectVertex(v);
              handleCloseChronicle();
            }}
            onHoverLine={setHoveredChronicleVertices}
            onHoverItem={handleHoverItem}
            onPopulateMissing={populateChronicleForExistingItems}
          />
        )}

        {/* Right panel: Oracle */}
        {showOracle && !showAddPanel && (
          <OraclePanel
            onClose={() => setShowOracle(false)}
            onSelectVertex={(v) => {
              handleSelectVertex(v);
              setShowOracle(false);
            }}
          />
        )}

        {/* Vertex detail sidebar (when no add panel) */}
        {!showAddPanel && !showChronicle && !showOracle && selectedVertex !== null && (
          <VertexDetailSidebar
            vertexId={selectedVertex}
            items={items.filter(i => i.vertexId === selectedVertex)}
            allItems={items}
            onClose={() => handleSelectVertex(null)}
            onAdd={() => { setShowAddPanel(true); setFormType('did'); }}
            onDelete={handleDeleteItem}
            onSelectVertex={handleSelectVertex}
            onSelectItem={handleSelectItem}
            onHoverItem={handleHoverItem}
            selectedItemId={selectedItemId}
          />
        )}
      </div>

      {/* Footer stats */}
      <footer className="px-6 py-2 border-t border-border bg-bg-panel flex items-center justify-between text-xs font-mono text-text-dim">
        <div className="flex gap-4">
          <span>DIDs: <span className="text-accent">{dids.length}</span></span>
          <span>VCs: <span className="text-success">{vcs.length}</span></span>
          <span>Schemas: <span className="text-warning">{schemas.length}</span></span>
          <span>Assets: <span className="text-info">{assets.length}</span></span>
          <span>Caps: <span className="text-purple-400">{capabilities.length}</span></span>
        </div>
        <div className="flex gap-4">
          <span>Vertices occupied: <span className="text-text-bright">{vertexCounts.size}</span> / 64</span>
          <span>Total items: <span className="text-text-bright">{items.length}</span></span>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Vertex Detail Sidebar
// ═══════════════════════════════════════════════════════════════

function VertexDetailSidebar({
  vertexId,
  items,
  allItems,
  onClose,
  onAdd,
  onDelete,
  onSelectVertex,
  onSelectItem,
  onHoverItem,
  selectedItemId,
}: {
  vertexId: number;
  items: RegistryItem[];
  allItems: RegistryItem[];
  onClose: () => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onSelectVertex: (v: number) => void;
  onSelectItem: (id: string | null) => void;
  onHoverItem?: (id: string | null) => void;
  selectedItemId: string | null;
}) {
  const dims = getVertexDimensions(vertexId);
  const stratum = getStratum(vertexId);
  const binary = toBinary(vertexId);
  const dimNames = getDimensionNames(vertexId);
  const color = getStratumColor(stratum);
  const label = getVertexLabel(vertexId);

  // Find parent linkage: items at this vertex that have a parentDid
  const localDids = new Set(items.map(i => i.did));
  const parentLink = items.find(i => i.parentDid)?.parentDid;
  const parentVertex = parentLink
    ? allItems.find(i => i.did === parentLink)?.vertexId ?? null
    : null;

  // Find children: items elsewhere that point to any DID at this vertex
  const children = allItems.filter(i => i.parentDid && localDids.has(i.parentDid));

  return (
    <div className="w-[360px] border-l border-border bg-bg-panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-bright font-mono">
          Vertex {vertexId}
        </h2>
        <button onClick={onClose} className="text-text-dim hover:text-danger text-lg leading-none">
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Vertex card */}
        <div className="rounded-lg border border-border p-4" style={{ borderColor: color + '40' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{getDimensionEmoji(vertexId)}</span>
            <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: color + '20', color }}>
              S{stratum}
            </span>
          </div>
          <div className="text-lg font-bold text-text-bright mb-1">{label}</div>
          <div className="font-mono text-xs text-text-dim mb-3">{binary}</div>
          <div className="flex flex-wrap gap-1">
            {dimNames.map(d => (
              <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-card border border-border text-text-dim">
                {d}
              </span>
            ))}
          </div>
        </div>

        {/* Dimension breakdown */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wider">Dimensions</h3>
          {[
            { name: 'Protection', bit: 1, active: dims.protection, emoji: '🛡️' },
            { name: 'Delegation', bit: 2, active: dims.delegation, emoji: '🤝' },
            { name: 'Memory', bit: 4, active: dims.memory, emoji: '📜' },
            { name: 'Connection', bit: 8, active: dims.connection, emoji: '🔗' },
            { name: 'Computation', bit: 16, active: dims.computation, emoji: '⚡' },
            { name: 'Value', bit: 32, active: dims.value, emoji: '💎' },
          ].map(d => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <span className={`flex items-center gap-2 ${d.active ? 'text-text-primary' : 'text-text-dim/50'}`}>
                <span>{d.emoji}</span>
                <span className={d.active ? 'font-medium' : ''}>{d.name}</span>
              </span>
              <span className={`font-mono ${d.active ? 'text-accent' : 'text-text-dim/30'}`}>
                {d.active ? 'ON' : 'off'} ({d.bit})
              </span>
            </div>
          ))}
        </div>

        {/* Parent link (if items here have a parent) */}
        {parentVertex !== null && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            <div className="text-[10px] text-accent font-semibold uppercase tracking-wider mb-1.5">
              Parent Anchor
            </div>
            <button
              onClick={() => onSelectVertex(parentVertex)}
              className="flex items-center gap-2 text-xs text-text-bright hover:text-accent transition-colors"
            >
              <span>↑</span>
              <span className="font-mono">Vertex {parentVertex}</span>
              <span className="text-text-dim">{getVertexLabel(parentVertex)}</span>
            </button>
          </div>
        )}

        {/* Children (if other items point here as parent) */}
        {children.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
              Sub-Capabilities ({children.length})
            </h3>
            <div className="space-y-1.5">
              {children.map(child => (
                <button
                  key={child.id}
                  onClick={() => onSelectVertex(child.vertexId)}
                  className="w-full flex items-center gap-2 rounded border border-purple-500/20 bg-purple-500/5 px-2.5 py-1.5 text-left text-xs hover:border-purple-500/40 transition-colors"
                >
                  <span className="text-purple-400">↓</span>
                  <span className="font-mono text-text-bright">V{child.vertexId}</span>
                  <span className="text-text-dim truncate">{getVertexLabel(child.vertexId)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Registered items at this vertex */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wider">
              Items here ({items.length})
            </h3>
            <button onClick={onAdd} className="text-xs text-accent hover:underline">
              + Add
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-xs text-text-dim/60 italic py-2">
              No items registered at this vertex.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(item => {
                const isItemSelected = selectedItemId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(isItemSelected ? null : item.id)}
                    onMouseEnter={() => onHoverItem?.(item.id)}
                    onMouseLeave={() => onHoverItem?.(null)}
                    className={`rounded border p-2.5 cursor-pointer transition-all ${
                      isItemSelected
                        ? 'border-purple-500/60 bg-purple-500/10 shadow shadow-purple-500/20'
                        : 'border-border bg-bg-card hover:border-border-hover'
                    }`}
                  >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      item.type === 'did' ? 'bg-accent/10 text-accent' :
                      item.type === 'vc' ? 'bg-success/10 text-success' :
                      item.type === 'capability' ? 'bg-purple-500/10 text-purple-400' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {item.type.toUpperCase()}
                    </span>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="text-text-dim/40 hover:text-danger text-xs"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="text-xs font-mono text-text-bright truncate mb-0.5">
                    {item.did}
                  </div>
                  <div className="text-[10px] text-text-dim truncate">
                    {item.label}
                  </div>
                  {item.parentDid && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const parent = allItems.find(i => i.did === item.parentDid);
                        if (parent) {
                          onSelectVertex(parent.vertexId);
                          onSelectItem(null);
                        }
                      }}
                      className="text-[10px] text-purple-400 mt-1 truncate hover:text-purple-300 text-left w-full"
                    >
                      ↑ parent {allItems.find(i => i.did === item.parentDid)?.label || '...'}
                    </button>
                  )}
                  {item.controllerDid && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const ctrl = allItems.find(i => i.did === item.controllerDid);
                        if (ctrl) {
                          onSelectVertex(ctrl.vertexId);
                          onSelectItem(null);
                        }
                      }}
                      className="text-[10px] text-accent mt-1 truncate hover:text-accent-light text-left w-full"
                    >
                      🎮 {allItems.find(i => i.did === item.controllerDid)?.label || '...'}
                    </button>
                  )}
                  {item.issuerDid && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const iss = allItems.find(i => i.did === item.issuerDid);
                        if (iss) {
                          onSelectVertex(iss.vertexId);
                          onSelectItem(null);
                        }
                      }}
                      className="text-[10px] text-warning mt-1 truncate hover:text-warning-light text-left w-full"
                    >
                      ✍️ issuer {allItems.find(i => i.did === item.issuerDid)?.label || '...'}
                    </button>
                  )}
                  {item.subjectDid && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const subj = allItems.find(i => i.did === item.subjectDid);
                        if (subj) {
                          onSelectVertex(subj.vertexId);
                          onSelectItem(null);
                        }
                      }}
                      className="text-[10px] text-success mt-1 truncate hover:text-success-light text-left w-full"
                    >
                      👤 subject {allItems.find(i => i.did === item.subjectDid)?.label || '...'}
                    </button>
                  )}
                  {item.schemaDid && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const sch = allItems.find(i => i.did === item.schemaDid);
                        if (sch) {
                          onSelectVertex(sch.vertexId);
                          onSelectItem(null);
                        }
                      }}
                      className="text-[10px] text-info mt-1 truncate hover:text-info-light text-left w-full"
                    >
                      📋 schema {allItems.find(i => i.did === item.schemaDid)?.label || '...'}
                    </button>
                  )}
                  {item.notes && (
                    <div className="text-[10px] text-text-dim/60 mt-1 line-clamp-2">
                      {item.notes}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
