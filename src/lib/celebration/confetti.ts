/**
 * confetti.ts — Lightweight, 60fps Canvas Particle Celebration Engine
 *
 * Zero external dependencies. Dynamically manages canvas creation,
 * high-DPI scaling, gravity physics, and automatic cleanup.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  decay: number;
}

const CELEBRATION_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#f97316', // Orange
];

/**
 * Triggers a burst of confetti particles from a coordinate
 */
export function fireConfetti(options?: {
  count?: number;
  origin?: { x: number; y: number };
  spread?: number;
  colors?: string[];
}): void {
  if (typeof window === 'undefined') return;

  const count = options?.count ?? 65;
  const originX = options?.origin?.x ?? window.innerWidth / 2;
  const originY = options?.origin?.y ?? window.innerHeight * 0.35;
  const colors = options?.colors ?? CELEBRATION_COLORS;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '99999';

  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 4;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
      decay: Math.random() * 0.015 + 0.01,
    });
  }

  let animationFrameId: number;

  const render = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    let activeParticles = 0;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.opacity <= 0) continue;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // Gravity
      p.vx *= 0.98; // Friction
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;

      if (p.opacity > 0) {
        activeParticles++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
        ctx.restore();
      }
    }

    if (activeParticles > 0) {
      animationFrameId = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(animationFrameId);
      canvas.remove();
    }
  };

  animationFrameId = requestAnimationFrame(render);
}

/**
 * Fires an intense celebratory milestone blast (double burst)
 */
export function fireMilestoneBlast(type: 'fifty_percent' | 'course_completed'): void {
  if (typeof window === 'undefined') return;

  const count = type === 'course_completed' ? 120 : 70;

  // Left burst
  fireConfetti({
    count: Math.floor(count / 2),
    origin: { x: window.innerWidth * 0.35, y: window.innerHeight * 0.4 },
  });

  // Right burst
  setTimeout(() => {
    fireConfetti({
      count: Math.floor(count / 2),
      origin: { x: window.innerWidth * 0.65, y: window.innerHeight * 0.4 },
    });
  }, 180);
}
