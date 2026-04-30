import type { LatticeVertex } from '../types/registry';

// ═══════════════════════════════════════════════════════════════
// 64-VERTEX SOVEREIGNTY LATTICE (Z/(2⁶)Z)
// Layout: Stratified by Hamming weight, spread horizontally within stratum
// ═══════════════════════════════════════════════════════════════

function buildLattice(): LatticeVertex[] {
  const vertices: LatticeVertex[] = [];

  // Stratum 0: 1 vertex (center top)
  vertices.push({ id: 0, binary: '000000', stratum: 0, x: 600, y: 80,
    dimensions: { protection: false, delegation: false, memory: false, connection: false, computation: false, value: false }});

  // Stratum 1: 6 vertices
  const s1ids = [1, 2, 4, 8, 16, 32];
  const s1x = [350, 450, 550, 650, 750, 850];
  s1ids.forEach((id, i) => {
    vertices.push({ id, binary: (id >>> 0).toString(2).padStart(6, '0'), stratum: 1, x: s1x[i], y: 180,
      dimensions: {
        protection: (id & 1) !== 0,
        delegation: (id & 2) !== 0,
        memory: (id & 4) !== 0,
        connection: (id & 8) !== 0,
        computation: (id & 16) !== 0,
        value: (id & 32) !== 0,
      }});
  });

  // Stratum 2: 15 vertices
  const s2ids = [3, 5, 6, 9, 10, 12, 17, 18, 20, 24, 33, 34, 36, 40, 48];
  const s2x = [180, 260, 340, 420, 500, 580, 660, 740, 820, 900, 980, 1060, 1140, 1220, 1300];
  // Clamp x to fit in 1200 width
  const s2xClamped = s2x.map(x => Math.min(Math.max(x, 80), 1120));
  s2ids.forEach((id, i) => {
    vertices.push({ id, binary: (id >>> 0).toString(2).padStart(6, '0'), stratum: 2, x: s2xClamped[i], y: 280,
      dimensions: {
        protection: (id & 1) !== 0,
        delegation: (id & 2) !== 0,
        memory: (id & 4) !== 0,
        connection: (id & 8) !== 0,
        computation: (id & 16) !== 0,
        value: (id & 32) !== 0,
      }});
  });

  // Stratum 3: 20 vertices
  const s3ids = [7, 11, 13, 14, 19, 21, 22, 25, 26, 28, 35, 37, 38, 41, 42, 44, 49, 50, 52, 56];
  const s3xBase = Array.from({ length: 20 }, (_, i) => 120 + i * 55);
  s3ids.forEach((id, i) => {
    vertices.push({ id, binary: (id >>> 0).toString(2).padStart(6, '0'), stratum: 3, x: s3xBase[i], y: 380,
      dimensions: {
        protection: (id & 1) !== 0,
        delegation: (id & 2) !== 0,
        memory: (id & 4) !== 0,
        connection: (id & 8) !== 0,
        computation: (id & 16) !== 0,
        value: (id & 32) !== 0,
      }});
  });

  // Stratum 4: 15 vertices (complements of stratum 2)
  const s4ids = [63-48, 63-40, 63-36, 63-34, 63-33, 63-24, 63-20, 63-18, 63-17, 63-12, 63-10, 63-9, 63-6, 63-5, 63-3];
  // Actually let's just compute: 63 - s2ids reversed
  const s4x = [180, 260, 340, 420, 500, 580, 660, 740, 820, 900, 980, 1060, 1140, 1220, 1300].map(x => Math.min(Math.max(x, 80), 1120));
  s4ids.forEach((id, i) => {
    vertices.push({ id, binary: (id >>> 0).toString(2).padStart(6, '0'), stratum: 4, x: s4x[i], y: 480,
      dimensions: {
        protection: (id & 1) !== 0,
        delegation: (id & 2) !== 0,
        memory: (id & 4) !== 0,
        connection: (id & 8) !== 0,
        computation: (id & 16) !== 0,
        value: (id & 32) !== 0,
      }});
  });

  // Stratum 5: 6 vertices (complements of stratum 1)
  const s5ids = [63-32, 63-16, 63-8, 63-4, 63-2, 63-1]; // 31, 47, 55, 59, 61, 62
  const s5x = [350, 450, 550, 650, 750, 850];
  s5ids.forEach((id, i) => {
    vertices.push({ id, binary: (id >>> 0).toString(2).padStart(6, '0'), stratum: 5, x: s5x[i], y: 580,
      dimensions: {
        protection: (id & 1) !== 0,
        delegation: (id & 2) !== 0,
        memory: (id & 4) !== 0,
        connection: (id & 8) !== 0,
        computation: (id & 16) !== 0,
        value: (id & 32) !== 0,
      }});
  });

  // Stratum 6: 1 vertex (center bottom)
  vertices.push({ id: 63, binary: '111111', stratum: 6, x: 600, y: 680,
    dimensions: { protection: true, delegation: true, memory: true, connection: true, computation: true, value: true }});

  return vertices;
}

export const LATTICE_VERTICES: LatticeVertex[] = buildLattice();

// Quick lookup
export const VERTEX_MAP = new Map(LATTICE_VERTICES.map(v => [v.id, v]));

// Stratum counts
export const STRATUM_COUNTS = [1, 6, 15, 20, 15, 6, 1];
