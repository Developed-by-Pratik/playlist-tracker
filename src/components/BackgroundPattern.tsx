"use client";

import { useTheme } from "./ThemeProvider";

export default function BackgroundPattern() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Static background gradients — no animation, no blurs */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: isDark
          ? 'radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.05) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(52, 211, 153, 0.03) 0%, transparent 50%)'
          : 'radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.03) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(52, 211, 153, 0.01) 0%, transparent 50%)',
      }} />

      {/* Static Grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: isDark ? 0.03 : 0.05,
        backgroundImage: isDark 
          ? 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)'
          : 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 80%)',
      }} />

      {/* Header fade */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '120px',
        background: isDark
          ? 'linear-gradient(to bottom, var(--bg-base), transparent)'
          : 'linear-gradient(to bottom, var(--bg-base), transparent)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}
