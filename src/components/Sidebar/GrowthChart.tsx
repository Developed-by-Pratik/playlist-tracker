'use client';

import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { useState } from 'react';

type ChartPoint = { date: string; count: number };

interface GrowthChartProps {
  data: ChartPoint[];
  isNested?: boolean;
}

export function GrowthChart({ data, isNested = false }: GrowthChartProps) {
  const W = 248;
  const H = 140;
  const PAD = { top: 20, right: 15, bottom: 30, left: 15 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map(d => d.count), 1);

  const pts = data.map((d, i) => ({
    x: data.length === 1 
      ? PAD.left + innerW / 2 
      : PAD.left + (i / Math.max(data.length - 1, 1)) * innerW,
    y: PAD.top + innerH - (d.count / maxVal) * innerH,
    count: d.count,
    date: d.date,
  }));

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
    count === 0 ? 'var(--border-color-strong)' : count >= 8 ? '#34d399' : count >= 4 ? '#fbbf24' : '#f87171';

  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; count: number } | null>(null);

  const content = (
    <>
      {!isNested && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp style={{ width: 15, height: 15, color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Daily Growth
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[['#f87171', '1-3'], ['#fbbf24', '4-7'], ['#34d399', '8+']].map(([color, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: color }} />
                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <div style={{ width: '100%', aspectRatio: '248/140' }}>
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ overflow: 'visible', display: 'block' }}
            onMouseLeave={() => setTooltip(null)}
          >
          <defs>
            {pts.slice(0, -1).map((p, i) => {
              const next = pts[i + 1];
              const avgCount = (p.count + next.count) / 2;
              const color = getColor(avgCount);
              return (
                <linearGradient key={i} id={`seg-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.85" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.15" />
                </linearGradient>
              );
            })}
          </defs>

          {[0.25, 0.5, 0.75, 1].map(f => (
            <line
              key={f}
              x1={PAD.left} x2={W - PAD.right}
              y1={PAD.top + innerH * (1 - f)} y2={PAD.top + innerH * (1 - f)}
              stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3"
            />
          ))}

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

          <path
            d={linePath}
            fill="none"
            stroke="var(--text-primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ opacity: 0.3 }}
          />

          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x} cy={p.y} r={W < 200 ? 3 : 4}
              fill="var(--bg-surface-solid)"
              stroke={getColor(p.count)}
              strokeWidth={2}
              style={{ cursor: 'pointer', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))', opacity: p.count === 0 ? 0.45 : 1 }}
              onMouseEnter={() => setTooltip({ x: p.x, y: p.y, date: p.date, count: p.count })}
            />
          ))}

          {pts.map((p, i) => {
            if (pts.length > 6 && i % 2 !== 0) return null;
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
          })}

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
        </svg>
        </div>
      </div>
    </>
  );

  if (isNested) return content;

  return (
    <div className="card sidebar-card" style={{ padding: '1.25rem' }}>
      {content}
    </div>
  );
}
