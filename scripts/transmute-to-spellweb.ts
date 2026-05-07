#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// transmute-to-spellweb.ts
//
// Reads an act-N JSON file from replay-acts/, runs the DID-blind
// transmutation, and writes nodes.ts + edges.ts to the target
// spellweb data directory.
//
// Usage:
//   npx tsx scripts/transmute-to-spellweb.ts [act-file.json]
//     --target <path>   Directory to write nodes.ts and edges.ts
//                       (default: ../../spellweb/src/data relative to this script)
//     --dry-run         Print generated content without writing files
//
// Safety checks (exits non-zero):
//   - Any did:cid: string in output
//   - Any node with type="chronicle" (taxonomy bug 1)
//   - Any node with layer="chronicle" (taxonomy bug 2)
//   - Any node with an invalid type, layer, or domain
//
// Requires: tsx (run via `npx tsx ...`)
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// We import from src/lib/transmute which uses RegistryItem/ChronicleEntry types.
// tsx handles TypeScript imports at runtime.
import {
  transmuteToSpellweb,
  generateNodesTs,
  generateEdgesTs,
  containsDids,
  checkTaxonomy,
} from '../src/lib/transmute.js';

// ── Arg parsing ──

const args = process.argv.slice(2);

function getFlag(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return defaultVal;
}

const dryRun = args.includes('--dry-run');

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultTarget = resolve(__dirname, '../../spellweb/src/data');
const targetDir = resolve(getFlag('--target', defaultTarget));

// Act file: first non-flag argument, or default to act-7
const actFile = args.find(a => !a.startsWith('--') && a !== args[args.indexOf('--target') + 1]) ??
  resolve(__dirname, '../replay-acts/act-7-boundary-blade-decomposition.json');

const actPath = existsSync(actFile) ? actFile
  : resolve(__dirname, '../replay-acts', actFile);

// ── Load act JSON ──

if (!existsSync(actPath)) {
  console.error(`[transmute] ERROR: Act file not found: ${actPath}`);
  process.exit(1);
}

let actData: { items: any[]; chronicle?: any[] };
try {
  actData = JSON.parse(readFileSync(actPath, 'utf-8'));
} catch (e) {
  console.error(`[transmute] ERROR: Failed to parse ${actPath}:`, e);
  process.exit(1);
}

const items = actData.items ?? [];
const chronicle = actData.chronicle ?? [];

if (items.length === 0) {
  console.error('[transmute] ERROR: No items found in act file.');
  process.exit(1);
}

const actName = actPath.split('/').pop() ?? 'unknown';
console.log(`[transmute] Source : ${actPath}`);
console.log(`[transmute] Items  : ${items.length}`);
console.log(`[transmute] Target : ${dryRun ? '(dry-run — no writes)' : targetDir}`);

// ── Transmute ──

const { nodes, edges } = transmuteToSpellweb(items, chronicle, true /* DID-blind: always */);
const timestamp = new Date().toISOString();

const nodesContent = generateNodesTs(nodes, actName, true, timestamp);
const edgesContent = generateEdgesTs(edges, actName, true, timestamp);

// ── Safety check 1: no DID strings ──

const combinedOutput = nodesContent + edgesContent;
if (containsDids(combinedOutput)) {
  console.error('\n[transmute] SAFETY VIOLATION: did:cid: strings found in output!');
  const lines = combinedOutput.split('\n').filter(l => /did:[a-z]+:[a-zA-Z0-9]+/.test(l));
  lines.forEach(l => console.error('  >', l.trim()));
  process.exit(1);
}

// ── Safety check 2: taxonomy ──

const taxonomyViolations = checkTaxonomy(nodes);

// Also explicitly catch the two known bug patterns
const chronicleTypeNodes = nodes.filter(n => (n as any).type === 'chronicle');
const chronicleLayerNodes = nodes.filter(n => (n as any).layer === 'chronicle');

let failed = false;

if (chronicleTypeNodes.length > 0) {
  console.error(`\n[transmute] TAXONOMY VIOLATION: ${chronicleTypeNodes.length} node(s) have type="chronicle" (must be "document")`);
  chronicleTypeNodes.forEach(n => console.error(`  - ${n.id}`));
  failed = true;
}

if (chronicleLayerNodes.length > 0) {
  console.error(`\n[transmute] TAXONOMY VIOLATION: ${chronicleLayerNodes.length} node(s) have layer="chronicle" (must be "narrative")`);
  chronicleLayerNodes.forEach(n => console.error(`  - ${n.id}`));
  failed = true;
}

if (taxonomyViolations.length > 0) {
  console.error(`\n[transmute] TAXONOMY VIOLATIONS (${taxonomyViolations.length}):`);
  taxonomyViolations.forEach(v => console.error(`  [${v.nodeId}] ${v.message}`));
  failed = true;
}

if (failed) process.exit(1);

// ── Stats ──

console.log(`\n[transmute] Nodes  : ${nodes.length}`);
console.log(`[transmute] Edges  : ${edges.length}`);
const typeCount = (t: string) => nodes.filter(n => n.type === t).length;
console.log(`[transmute] Types  : persona=${typeCount('persona')} spell=${typeCount('spell')} theorem=${typeCount('theorem')} skill=${typeCount('skill')} document=${typeCount('document')}`);
const layerCount = (l: string) => nodes.filter(n => n.layer === l).length;
console.log(`[transmute] Layers : knowledge=${layerCount('knowledge')} narrative=${layerCount('narrative')}`);
const domainCount = (d: string) => nodes.filter(n => n.domain === d).length;
console.log(`[transmute] Domains: swordsman=${domainCount('swordsman')} mage=${domainCount('mage')} shared=${domainCount('shared')}`);

// ── Dry-run output ──

if (dryRun) {
  console.log('\n─── nodes.ts ───────────────────────────────────────────────────\n');
  console.log(nodesContent);
  console.log('\n─── edges.ts ───────────────────────────────────────────────────\n');
  console.log(edgesContent);
  console.log('\n[transmute] Dry-run complete. No files written.');
  process.exit(0);
}

// ── Write files ──

if (!existsSync(targetDir)) {
  console.error(`[transmute] ERROR: Target directory does not exist: ${targetDir}`);
  console.error('  Run with --dry-run or create the directory first.');
  process.exit(1);
}

const nodesPath = join(targetDir, 'nodes.ts');
const edgesPath = join(targetDir, 'edges.ts');

writeFileSync(nodesPath, nodesContent, 'utf-8');
writeFileSync(edgesPath, edgesContent, 'utf-8');

console.log(`\n[transmute] Written: ${nodesPath}`);
console.log(`[transmute] Written: ${edgesPath}`);
console.log('\n[transmute] Safety checks passed. Cloak is holding.');
