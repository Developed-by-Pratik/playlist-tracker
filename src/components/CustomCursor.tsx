"use client";

import { useEffect, useState } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";

export default function CustomCursor() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring configuration
  const springConfig = { damping: 25, stiffness: 150 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener("mousemove", updateMousePosition);
    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, [mouseX, mouseY]);

  return (
    <>
      {/* Background Spotlight */}
      <motion.div
        style={{
          pointerEvents: "none",
          position: "fixed",
          top: -300,
          left: -300,
          width: 600,
          height: 600,
          background: "radial-gradient(circle, rgba(37, 99, 235, 0.08), transparent 80%)",
          zIndex: -1,
          x: mouseX,
          y: mouseY,
          willChange: "transform",
        }}
      />

      {/* Floating Dot Cursor */}
      <motion.div
        style={{
          position: "fixed",
          top: -6,
          left: -6,
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: "var(--accent-primary)",
          zIndex: 9999,
          pointerEvents: "none",
          opacity: 0.5,
          x: springX,
          y: springY,
        }}
      />
      <motion.div
        style={{
          position: "fixed",
          top: -20,
          left: -20,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "1px solid var(--accent-primary)",
          zIndex: 9998,
          pointerEvents: "none",
          opacity: 0.2,
          x: springX,
          y: springY,
        }}
      />
    </>
  );
}
