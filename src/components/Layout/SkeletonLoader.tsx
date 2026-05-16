'use client';

import { motion } from 'framer-motion';

export function SkeletonLoader() {
  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.75rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
          <div>
            <div className="skeleton" style={{ width: 180, height: 24, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 120, height: 16 }} />
          </div>
        </div>
        <div className="skeleton" style={{ width: 100, height: 32, borderRadius: 99 }} />
      </div>

      <div className="main-grid">
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
        </aside>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 16 }} />
          ))}
        </div>
      </div>

      <style>{`
        .skeleton {
          background: var(--bg-surface-2);
          position: relative;
          overflow: hidden;
        }
        .skeleton::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
          animation: loading 1.5s infinite;
        }
        @keyframes loading {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
