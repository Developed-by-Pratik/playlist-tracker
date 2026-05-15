"use client";

import { useTheme } from "./ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      style={{
        position: "relative",
        width: 44,
        height: 44,
        borderRadius: 12,
        border: "1px solid var(--border-color-strong)",
        background: "var(--bg-surface)",
        backdropFilter: "blur(12px)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        transition: "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
        boxShadow: isDark
          ? "0 0 12px rgba(99, 102, 241, 0.1)"
          : "0 0 12px rgba(251, 191, 36, 0.15)",
        flexShrink: 0,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.svg
            key="moon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-hover)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </motion.svg>
        ) : (
          <motion.svg
            key="sun"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
