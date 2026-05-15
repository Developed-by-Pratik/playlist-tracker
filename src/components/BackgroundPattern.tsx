"use client";

import { motion } from "framer-motion";
import { useTheme } from "./ThemeProvider";

export default function BackgroundPattern() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* Primary Indigo Aura — top-left */}
      <motion.div
        animate={{
          scale: [1, 1.25, 1.1, 1],
          x: [0, 60, -30, 0],
          y: [0, 40, -20, 0],
          rotate: [0, 5, -3, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          position: 'absolute',
          top: '-15%',
          left: '-10%',
          width: '55%',
          height: '55%',
          background: isDark 
            ? 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.05) 40%, transparent 70%)'
            : 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0.02) 40%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Emerald Aura — bottom-right */}
      <motion.div
        animate={{
          scale: [1, 1.2, 0.95, 1],
          x: [0, -70, 30, 0],
          y: [0, -60, 40, 0],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          position: 'absolute',
          bottom: '-12%',
          right: '-8%',
          width: '50%',
          height: '50%',
          background: isDark
            ? 'radial-gradient(circle, rgba(52, 211, 153, 0.08) 0%, rgba(52, 211, 153, 0.03) 40%, transparent 70%)'
            : 'radial-gradient(circle, rgba(52, 211, 153, 0.04) 0%, rgba(52, 211, 153, 0.01) 40%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />

      {/* Violet pulse — center-right */}
      <motion.div
        animate={{
          scale: [1, 1.4, 1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          position: 'absolute',
          top: '25%',
          right: '10%',
          width: '35%',
          height: '35%',
          background: isDark
            ? 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(139, 92, 246, 0.05) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />

      {/* Warm amber accent — bottom-left */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          x: [0, 50, 0],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '5%',
          width: '30%',
          height: '30%',
          background: isDark
            ? 'radial-gradient(circle, rgba(251, 191, 36, 0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(251, 191, 36, 0.03) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: isDark ? 0.04 : 0.06,
        backgroundImage: isDark 
          ? 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)'
          : 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        transition: 'opacity 0.3s ease, background-image 0.3s ease',
      }} />

      {/* Top fade for header readability */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '120px',
        background: isDark
          ? 'linear-gradient(to bottom, rgba(10, 10, 15, 0.8), transparent)'
          : 'linear-gradient(to bottom, rgba(248, 249, 254, 0.8), transparent)',
        pointerEvents: 'none',
        transition: 'background 0.3s ease',
      }} />
    </div>
  );
}
