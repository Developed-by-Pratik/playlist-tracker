'use client';

import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { useState, useMemo } from 'react';

type ChartPoint = { date: string; count: number; fullDate?: string };

interface GrowthChartProps {
  data: ChartPoint[];
  isNested?: boolean;
  filter?: 'week' | 'month' | 'all';
}

export function GrowthChart({ data, isNested = false, filter }: GrowthChartProps) {
  const W = 248;
  const H = 140;
  const PAD = { top: 12, right: 6, bottom: 16, left: 6 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const [localFilter, setLocalFilter] = useState<'week' | 'month' | 'all'>('all');
  const activeFilter = filter !== undefined ? filter : localFilter;

  const filteredData = useMemo(() => {
    if (activeFilter === 'all') return data;

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    if (activeFilter === 'week') {
      cutoff.setDate(cutoff.getDate() - 7);
    } else if (activeFilter === 'month') {
      cutoff.setDate(cutoff.getDate() - 30);
    }

    return data.filter(d => {
      if (!d.fullDate) return true;
      const dDate = new Date(d.fullDate + 'T00:00:00');
      return dDate >= cutoff;
    });
  }, [data, activeFilter]);

  const maxVal = useMemo(() => Math.max(...filteredData.map(d => d.count), 1), [filteredData]);

  const pts = useMemo(() => {
    return filteredData.map((d, i) => ({
      x: filteredData.length === 1 
        ? PAD.left + innerW / 2 
        : PAD.left + (i / Math.max(filteredData.length - 1, 1)) * innerW,
      y: PAD.top + innerH - (d.count / maxVal) * innerH,
      count: d.count,
      date: d.date,
    }));
  }, [filteredData, innerW, innerH, maxVal, PAD.left, PAD.top]);

  const linePath = pts.length < 2
    ? ''
    : pts.reduce((acc, p, i) => {
        if (i === 0) return `M${p.x},${p.y}`;
        const prev = pts[i - 1];
        const cpx = (prev.x + p.x) / 2;
        return `${acc} C${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
      }, '');

  const baseY = PAD.top + innerH;

  const getColor = (count: number) =>
    count === 0
      ? 'var(--border-color-strong)'
      : count >= 3
      ? '#34d399'
      : count === 2
      ? '#fbbf24'
      : '#f87171';

  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; count: number } | null>(null);

  const content = (
    <>
      {!isNested && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp style={{ width: 15, height: 15, color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Daily Growth
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[['#f87171', '1'], ['#fbbf24', '2'], ['#34d399', '3+']].map(([color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: color }} />
                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        {/* Overlay Filter Switcher (Only if not nested) */}
        {!isNested && (
          <div style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            zIndex: 10,
            display: 'inline-flex',
            background: 'var(--bg-surface-2)',
            borderRadius: 'var(--border-radius-xs)',
            padding: '2px',
            border: '1px solid var(--border-color)',
            backdropFilter: 'blur(4px)',
          }}>
            {(['all', 'week', 'month'] as const).map(f => {
              const label = f === 'week' ? '7D' : f === 'month' ? '30D' : 'All';
              const isActive = activeFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setLocalFilter(f)}
                  style={{
                    background: isActive ? 'var(--bg-surface-solid)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: 'calc(var(--border-radius-xs) - 2px)',
                    padding: '2px 6px',
                    fontSize: '0.625rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: isActive ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ 
          width: '100%', 
          aspectRatio: '248/140',
        }}>
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ overflow: 'visible', display: 'block' }}
            onMouseLeave={() => setTooltip(null)}
          >
            <defs>
              <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur2" />
                  <feMergeNode in="blur1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <pattern id="grid-pattern" width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M 16 0 L 0 0 0 16" fill="none" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
              </pattern>

              <marker
                id="axis-arrow"
                viewBox="0 0 8 8"
                refX="5"
                refY="4"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 1 2 L 6 4 L 1 6 Z" fill="var(--border-color-strong)" />
              </marker>

              {pts.slice(0, -1).map((p, i) => {
                const next = pts[i + 1];
                const color = getColor(next.count);
                return (
                  <linearGradient key={i} id={`seg-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                  </linearGradient>
                );
              })}
            </defs>

            {/* Background grid of dotted squares */}
            <rect 
              x={PAD.left} 
              y={PAD.top} 
              width={innerW} 
              height={innerH} 
              fill="url(#grid-pattern)" 
            />

            {/* Y and X Axes lines boundary */}
            <line 
              x1={PAD.left} y1={baseY} 
              x2={PAD.left} y2={PAD.top - 4} 
              stroke="var(--border-color-strong)" 
              strokeWidth="1.25" 
              markerEnd="url(#axis-arrow)"
            />
            <line 
              x1={PAD.left} y1={baseY} 
              x2={W - PAD.right + 4} y2={baseY} 
              stroke="var(--border-color-strong)" 
              strokeWidth="1.25" 
              markerEnd="url(#axis-arrow)"
            />

            {/* Empty state text overlay inside the chart SVG */}
            {pts.length === 0 && (
              <text
                x={PAD.left + innerW / 2}
                y={PAD.top + innerH / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fill="var(--text-muted)"
                fontFamily="var(--font-mono)"
              >
                No activity in this period
              </text>
            )}

            {/* Only render line plot, divider lines, and node circles if there are data points */}
            {pts.length > 0 && (
              <>
                {/* Glowing bar column segments filled under the curve */}
                {pts.slice(0, -1).map((p, i) => {
                  const next = pts[i + 1];
                  const segArea = `M${p.x},${p.y} C${(p.x + next.x) / 2},${p.y} ${(p.x + next.x) / 2},${next.y} ${next.x},${next.y} L${next.x},${baseY} L${p.x},${baseY} Z`;
                  return (
                    <path
                      key={i}
                      d={segArea}
                      fill={`url(#seg-${i})`}
                    />
                  );
                })}

                {/* Vertical column divider lines matching the attachment */}
                {pts.map((p, i) => (
                  <line
                    key={`divider-${i}`}
                    x1={p.x} y1={p.y}
                    x2={p.x} y2={baseY}
                    stroke={getColor(p.count)}
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    style={{ opacity: 0.28 }}
                  />
                ))}

                {/* Thicker neon glowing line beneath */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  filter="url(#neon-glow)"
                  style={{ opacity: 0.8 }}
                />

                {/* Main sharp line on top */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Glowing halos behind nodes */}
                {pts.map((p, i) => (
                  <circle
                    key={`glow-${i}`}
                    cx={p.x} cy={p.y} r={W < 200 ? 3.5 : 4.5}
                    fill={getColor(p.count)}
                    filter="url(#neon-glow)"
                    style={{ opacity: 0.6 }}
                  />
                ))}

                {/* Point circles (Interactive but styled very small) */}
                {pts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x} cy={p.y} r={W < 200 ? 1.5 : 2.2}
                    fill="var(--bg-surface-solid)"
                    stroke={getColor(p.count)}
                    strokeWidth={1.5}
                    style={{ pointerEvents: 'none', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))' }}
                  />
                ))}

                {/* Invisible larger hover targets for excellent UX/hover-trigger */}
                {pts.map((p, i) => (
                  <circle
                    key={`target-${i}`}
                    cx={p.x} cy={p.y} r={10}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setTooltip({ x: p.x, y: p.y, date: p.date, count: p.count })}
                  />
                ))}

                {(() => {
                  const labelIndices = new Set<number>();
                  if (pts.length > 0) {
                    if (pts.length <= 5) {
                      for (let idx = 0; idx < pts.length; idx++) {
                        labelIndices.add(idx);
                      }
                    } else {
                      labelIndices.add(0);
                      labelIndices.add(pts.length - 1);
                      const step = (pts.length - 1) / 4;
                      for (let j = 1; j <= 3; j++) {
                        labelIndices.add(Math.round(j * step));
                      }
                    }
                  }

                  return pts.map((p, i) => {
                    if (!labelIndices.has(i)) return null;
                    return (
                      <text
                        key={i}
                        x={p.x} y={H - 4}
                        textAnchor="middle"
                        fontSize="8"
                        fill="var(--text-muted)"
                        fontFamily="var(--font-mono)"
                      >
                        {p.date}
                      </text>
                    );
                  });
                })()}

                {tooltip && (
                  <g transform={`translate(${Math.min(tooltip.x + 8, W - 72)}, ${Math.max(tooltip.y - 36, PAD.top)})`}>
                    <rect x="0" y="0" width="64" height="28" rx="5" ry="5"
                      fill="var(--bg-surface-solid)" stroke="var(--border-color-strong)" strokeWidth="1"
                    />
                    <text x="32" y="11" textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">
                      {tooltip.date}
                    </text>
                    <text x="32" y="23" textAnchor="middle" fontSize="10" fill={getColor(tooltip.count)} fontFamily="var(--font-mono)" fontWeight="700">
                      {tooltip.count} item{tooltip.count !== 1 ? 's' : ''}
                    </text>
                  </g>
                )}
              </>
            )}
          </svg>
        </div>
      </div>
    </>
  );

  if (isNested) return content;

  return (
    <div className="card sidebar-card" style={{ padding: '0.875rem' }}>
      {content}
    </div>
  );
}
