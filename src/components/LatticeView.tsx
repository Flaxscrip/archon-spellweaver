import { useMemo } from 'react';
import { LATTICE_VERTICES, STRATUM_COUNTS } from '../data/lattice';
import { getStratumColor, getVertexLabel, getDimensionEmoji, getVertexShortLabel, isCanonicalName } from '../types/registry';
import type { RegistryItem } from '../types/registry';

interface LatticeViewProps {
  vertexCounts: Map<number, number>;
  selectedVertex: number | null;
  hoveredVertices: Set<number>;
  onSelectVertex: (id: number | null) => void;
  items: RegistryItem[];
  highlightedConnections: { vertices: Set<number>; edges: { from: number; to: number }[] };
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
}

const SVG_WIDTH = 1200;
const SVG_HEIGHT = 800;

export function LatticeView({ vertexCounts, selectedVertex, hoveredVertices, onSelectVertex, items, highlightedConnections, selectedItemId, onSelectItem }: LatticeViewProps) {
  // Compute edges: connect vertices that differ by exactly one bit
  const edges = useMemo(() => {
    const result: { from: number; to: number }[] = [];
    for (let i = 0; i < 64; i++) {
      for (let bit = 0; bit < 6; bit++) {
        const j = i ^ (1 << bit);
        if (j > i) { // avoid duplicates
          result.push({ from: i, to: j });
        }
      }
    }
    return result;
  }, []);

  // Stratum baseline Y positions
  const stratumY = [80, 180, 280, 380, 480, 580, 680];

  // Compute positioned vertices with improved layout
  const positionedVertices = useMemo(() => {
    const byStratum: Map<number, typeof LATTICE_VERTICES> = new Map();
    LATTICE_VERTICES.forEach(v => {
      if (!byStratum.has(v.stratum)) byStratum.set(v.stratum, []);
      byStratum.get(v.stratum)!.push(v);
    });

    const positioned = new Map<number, { x: number; y: number }>();

    // S0 and S6: centered
    positioned.set(0, { x: SVG_WIDTH / 2, y: stratumY[0] });
    positioned.set(63, { x: SVG_WIDTH / 2, y: stratumY[6] });

    // S1 and S5: spread evenly
    [1, 5].forEach(stratum => {
      const ids = Array.from(byStratum.get(stratum) || []).sort((a, b) => a.id - b.id);
      const count = ids.length;
      const spacing = SVG_WIDTH / (count + 1);
      ids.forEach((v, i) => {
        positioned.set(v.id, { x: spacing * (i + 1), y: stratumY[stratum] });
      });
    });

    // S2, S3, S4: spread with more room
    [2, 3, 4].forEach(stratum => {
      const ids = Array.from(byStratum.get(stratum) || []).sort((a, b) => a.id - b.id);
      const count = ids.length;
      const margin = 60;
      const available = SVG_WIDTH - margin * 2;
      const spacing = available / Math.max(count - 1, 1);
      ids.forEach((v, i) => {
        const x = count === 1 ? SVG_WIDTH / 2 : margin + spacing * i;
        positioned.set(v.id, { x, y: stratumY[stratum] });
      });
    });

    return positioned;
  }, []);

  const getPos = (id: number) => positionedVertices.get(id) || { x: 0, y: 0 };

  return (
    <div className="w-full h-full bg-bg-primary relative overflow-auto">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-full min-w-[1200px]"
        style={{ background: '#06060e' }}
      >
        {/* Title */}
        <text
          x={SVG_WIDTH / 2}
          y={30}
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="monospace"
          fontSize={18}
          fontWeight="bold"
        >
          Z/(2⁶)Z — The 64-Vertex Sovereignty Lattice
        </text>

        {/* Stratum lines */}
        {stratumY.map((y, i) => (
          <g key={i}>
            <line
              x1={40}
              y1={y}
              x2={SVG_WIDTH - 40}
              y2={y}
              stroke="#1a1a3a"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <text
              x={30}
              y={y + 4}
              textAnchor="end"
              fill="#555555"
              fontFamily="monospace"
              fontSize={11}
            >
              S{i}
            </text>
            <text
              x={SVG_WIDTH - 30}
              y={y + 4}
              textAnchor="start"
              fill="#555555"
              fontFamily="monospace"
              fontSize={10}
            >
              ({STRATUM_COUNTS[i]})
            </text>
          </g>
        ))}

        {/* Edges */}
        {edges.map(({ from, to }) => {
          const p1 = getPos(from);
          const p2 = getPos(to);
          return (
            <line
              key={`${from}-${to}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#1a1a3a"
              strokeWidth={0.5}
              opacity={0.5}
            />
          );
        })}

        {/* TRACEROUTE: highlighted connection edges */}
        {highlightedConnections.edges.map(({ from, to }) => {
          const p1 = getPos(from);
          const p2 = getPos(to);
          return (
            <g key={`trace-${from}-${to}`}>
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#aa55ff"
                strokeWidth={3}
                opacity={0.8}
              />
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#ffffff"
                strokeWidth={1}
                opacity={0.6}
                strokeDasharray="8,4"
              />
            </g>
          );
        })}

        {/* TRACEROUTE: highlighted vertex halos */}
        {Array.from(highlightedConnections.vertices).map(vid => {
          const pos = getPos(vid);
          return (
            <circle
              key={`halo-${vid}`}
              cx={pos.x}
              cy={pos.y}
              r={32}
              fill="none"
              stroke="#aa55ff"
              strokeWidth={2}
              opacity={0.6}
              strokeDasharray="6,3"
            >
              <animate attributeName="r" values="28;36;28" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
          );
        })}

        {/* Vertices */}
        {LATTICE_VERTICES.map(v => {
          const pos = getPos(v.id);
          const count = vertexCounts.get(v.id) || 0;
          const isSelected = selectedVertex === v.id;
          const isHovered = hoveredVertices.has(v.id);
          const isOccupied = count > 0;
          const stratumColor = getStratumColor(v.stratum);
          const label = getVertexLabel(v.id);
          const emoji = getDimensionEmoji(v.id);
          const radius = isSelected ? 24 : isOccupied ? 20 : 14;
          const hasTrace = highlightedConnections.vertices.has(v.id);

          return (
            <g
              key={v.id}
              className="vertex-circle"
              onClick={() => onSelectVertex(isSelected ? null : v.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Glow for hovered (chronicle or selection) */}
              {isHovered && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={radius + 10}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={2}
                  opacity={0.6}
                  className="animate-pulse"
                />
              )}

              {/* Glow for occupied/selected */}
              {(isOccupied || isSelected) && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={radius + 6}
                  fill={stratumColor}
                  opacity={isSelected ? 0.2 : 0.1}
                />
              )}

              {/* Main circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={radius}
                fill={isOccupied ? stratumColor + '20' : '#151530'}
                stroke={isSelected ? stratumColor : isHovered ? '#ffffff' : isOccupied ? stratumColor + 'aa' : '#2a2a5a'}
                strokeWidth={isSelected ? 3 : isHovered ? 2.5 : isOccupied ? 2 : 1}
              />

              {/* Vertex ID */}
              <text
                x={pos.x}
                y={pos.y - 2}
                textAnchor="middle"
                fill={isOccupied ? '#ffffff' : '#888888'}
                fontFamily="monospace"
                fontSize={isOccupied ? 12 : 10}
                fontWeight={isOccupied ? 'bold' : 'normal'}
              >
                {v.id}
              </text>

              {/* Count badge */}
              {count > 0 && (
                <g>
                  <circle
                    cx={pos.x + radius - 2}
                    cy={pos.y - radius + 2}
                    r={8}
                    fill={stratumColor}
                  />
                  <text
                    x={pos.x + radius - 2}
                    y={pos.y - radius + 5}
                    textAnchor="middle"
                    fill="#000"
                    fontFamily="monospace"
                    fontSize={9}
                    fontWeight="bold"
                  >
                    {count}
                  </text>
                </g>
              )}

              {/* Label below */}
              <text
                x={pos.x}
                y={pos.y + radius + 14}
                textAnchor="middle"
                fill={isCanonicalName(v.id) ? stratumColor : '#555555'}
                fontFamily="monospace"
                fontSize={isCanonicalName(v.id) ? 10 : 8}
                fontWeight={isCanonicalName(v.id) ? 'bold' : 'normal'}
              >
                {getVertexShortLabel(v.id)}
              </text>
              {isCanonicalName(v.id) && (
                <text
                  x={pos.x}
                  y={pos.y + radius + 26}
                  textAnchor="middle"
                  fill={stratumColor + 'aa'}
                  fontFamily="monospace"
                  fontSize={7}
                >
                  canonical
                </text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${SVG_WIDTH - 190}, 60)`}>
          <rect
            x={0}
            y={0}
            width={170}
            height={200}
            fill="#111122"
            stroke="#2a2a5a"
            strokeWidth={1}
            rx={5}
          />
          <text x={85} y={20} textAnchor="middle" fill="#ffffff" fontFamily="monospace" fontSize={11} fontWeight="bold">
            Dimensions
          </text>
          {[
            { name: 'Protection', bit: 1, color: '#ff5555', emoji: '🛡️' },
            { name: 'Delegation', bit: 2, color: '#ff9955', emoji: '🤝' },
            { name: 'Memory', bit: 4, color: '#ffdd55', emoji: '📜' },
            { name: 'Connection', bit: 8, color: '#55ff55', emoji: '🔗' },
            { name: 'Computation', bit: 16, color: '#5599ff', emoji: '⚡' },
            { name: 'Value', bit: 32, color: '#aa55ff', emoji: '💎' },
          ].map((d, i) => (
            <g key={d.name} transform={`translate(10, ${35 + i * 26})`}>
              <circle cx={8} cy={0} r={6} fill={d.color + '30'} stroke={d.color} strokeWidth={1.5} />
              <text x={22} y={4} fill={d.color} fontFamily="monospace" fontSize={10}>
                {d.emoji} {d.name} = {d.bit}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
