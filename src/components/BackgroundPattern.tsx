"use client";

export default function BackgroundPattern() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Static background gradients — no animation, no blurs */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--pattern-bg-gradient)',
        transition: 'background 0.3s ease',
      }} />

      {/* Static Grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 'var(--pattern-grid-opacity)',
        backgroundImage: 'var(--pattern-grid-image)',
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)',
        transition: 'opacity 0.3s ease, background-image 0.3s ease',
      }} />

      {/* Header fade */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '120px',
        background: 'linear-gradient(to bottom, var(--bg-base), transparent)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
