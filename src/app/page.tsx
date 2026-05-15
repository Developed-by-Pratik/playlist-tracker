"use client";

import { useEffect, useState, useMemo } from 'react';
import { loadData, updateTask } from '@/lib/storage';
import { fetchPlaylistVideos } from '@/lib/youtube';
import { AppData, Video, TaskRecord } from '@/lib/types';
import { 
  PlayCircle, CheckCircle2, ChevronDown, 
  ListTodo, Code2, Users, Briefcase,
  TrendingUp, Award, Clock, Zap, Flame, Trophy, Target, ExternalLink, Trash2
} from 'lucide-react';

import { motion, AnimatePresence, Variants } from 'framer-motion';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { ThemeToggle } from '@/components/ThemeToggle';

const DEFAULT_ICONS: Record<string, any> = {
  watchVideo: PlayCircle,
  programPractice: Code2,
  postLinkedIn: Users,
  updateNaukri: Briefcase,
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
  }
};

const sidebarVariants: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }
  }
};

/* ── Colored Growth Chart ─────────────────────────────── */
type ChartPoint = { date: string; count: number };

function GrowthChart({ data }: { data: ChartPoint[] }) {
  const W = 248;
  const H = 130;
  const PAD = { top: 14, right: 8, bottom: 28, left: 8 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map(d => d.count), 1);

  // Map data points to SVG coords
  const pts = data.map((d, i) => ({
    x: PAD.left + (i / Math.max(data.length - 1, 1)) * innerW,
    y: PAD.top + innerH - (d.count / maxVal) * innerH,
    count: d.count,
    date: d.date,
  }));

  // Build smooth polyline path using cardinal spline (catmull-rom)
  const linePath = pts.length < 2
    ? `M${pts[0]?.x ?? 0},${pts[0]?.y ?? 0}`
    : pts.reduce((acc, p, i) => {
        if (i === 0) return `M${p.x},${p.y}`;
        const prev = pts[i - 1];
        const cpx = (prev.x + p.x) / 2;
        return `${acc} C${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
      }, '');

  // Area path baseline y
  const baseY = PAD.top + innerH;

  // Color thresholds: ≥3 = green, ≥2 = yellow, <2 = red
  const getColor = (count: number) =>
    count >= 3 ? '#34d399' : count >= 2 ? '#fbbf24' : '#f87171';

  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; count: number } | null>(null);

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp style={{ width: 15, height: 15, color: 'var(--accent-primary)' }} />
          <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Daily Growth
          </span>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[['#f87171', '1'], ['#fbbf24', '2'], ['#34d399', '3+']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: color }} />
              <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG chart */}
      <div style={{ position: 'relative' }}>
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ overflow: 'visible', display: 'block' }}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            {/* One gradient per segment between consecutive points */}
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
            {/* Single gradient for full area (fallback) */}
            <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.7" />
              <stop offset="50%" stopColor="#eab308" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75, 1].map(f => (
            <line
              key={f}
              x1={PAD.left} x2={W - PAD.right}
              y1={PAD.top + innerH * (1 - f)} y2={PAD.top + innerH * (1 - f)}
              stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3"
            />
          ))}

          {/* Colored segment areas */}
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

          {/* Data point dots */}
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x} cy={p.y} r={4}
              fill="var(--bg-surface-solid)"
              stroke={getColor(p.count)}
              strokeWidth={2}
              style={{ cursor: 'pointer', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))' }}
              onMouseEnter={() => setTooltip({ x: p.x, y: p.y, date: p.date, count: p.count })}
            />
          ))}

          {/* X-axis date labels */}
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

          {/* Tooltip */}
          {tooltip && (
            <g transform={`translate(${Math.min(tooltip.x + 8, W - 72)}, ${Math.max(tooltip.y - 36, PAD.top)})`}>
              <rect x="0" y="0" width="64" height="28" rx="5" ry="5"
                fill="var(--bg-surface-solid)" stroke="var(--border-color-strong)" strokeWidth="1"
              />
              <text x="32" y="11" textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">
                {tooltip.date}
              </text>
              <text x="32" y="23" textAnchor="middle" fontSize="10" fill={getColor(tooltip.count)} fontFamily="var(--font-mono)" fontWeight="700">
                {tooltip.count} task{tooltip.count !== 1 ? 's' : ''}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<AppData | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);

  const loadVideos = async () => {
    await Promise.resolve(); // Ensure all state updates happen after mount/render to avoid cascading render warning
    const loaded = loadData();
    setData(loaded);
    setLoading(true);
    try {
      const vids = await fetchPlaylistVideos();
      setVideos(vids);
    } catch (e) {
      console.error(e);
      alert('Failed to fetch videos from server.');
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadVideos();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSubtaskToggle = (videoId: string, subtaskId: string) => {
    if (!data) return;
    const currentTask = data.tasks[videoId] || { videoId, subtasks: [] };
    const updatedSubtasks = currentTask.subtasks.map(s => 
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    const updated = updateTask(videoId, { subtasks: updatedSubtasks });
    setData(updated);
  };

  const handleAddSubtask = (videoId: string, label: string) => {
    if (!data || !label.trim()) return;
    const currentTask = data.tasks[videoId] || { videoId, subtasks: [] };
    const newSubtask = {
      id: `custom-${Date.now()}`,
      label,
      completed: false
    };
    const updated = updateTask(videoId, { 
      subtasks: [...currentTask.subtasks, newSubtask] 
    });
    setData(updated);
  };

  const handleDeleteSubtask = (videoId: string, subtaskId: string) => {
    if (!data) return;
    const currentTask = data.tasks[videoId];
    if (!currentTask) return;
    const updatedSubtasks = currentTask.subtasks.filter(s => s.id !== subtaskId);
    const updated = updateTask(videoId, { subtasks: updatedSubtasks });
    setData(updated);
  };

  const handleDiaryChange = (videoId: string, content: string) => {
    // No-op - feature removed
  };

  const stats = useMemo(() => {
    if (!data || videos.length === 0) return { completed: 0, total: 0, progress: 0, streak: 0 };
    let completed = 0;
    const completionDates = new Set<string>();

    videos.forEach(v => {
      const t = data.tasks[v.id];
      if (t && t.completedAt) {
        completed++;
        completionDates.add(new Date(t.completedAt).toDateString());
      }
    });

    // Calculate streak
    let streak = 0;
    const today = new Date();
    const checkDate = new Date();
    
    // Check if anything done today or yesterday to continue streak
    const doneToday = completionDates.has(today.toDateString());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const doneYesterday = completionDates.has(yesterday.toDateString());

    if (doneToday || doneYesterday) {
      if (!doneToday) checkDate.setDate(checkDate.getDate() - 1);
      
      while (completionDates.has(checkDate.toDateString())) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    return {
      completed,
      total: videos.length,
      progress: Math.round((completed / videos.length) * 100) || 0,
      streak
    };
  }, [data, videos]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const countsByDate: Record<string, number> = {};
    Object.values(data.tasks).forEach(task => {
      if (task.completedAt) {
        const date = new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        countsByDate[date] = (countsByDate[date] || 0) + 1;
      }
    });
    return Object.entries(countsByDate)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, count]) => ({ date, count }));
  }, [data]);

  if (!data) {
    return (
      <div className="container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ textAlign: 'center' }}
        >
          <div style={{ 
            width: 48, height: 48, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.08)',
            borderTopColor: 'var(--accent-primary)',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
            Loading your progress...
          </p>
        </motion.div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
      </div>
    );
  }

  return (
    <main className="container" style={{ paddingBottom: '6rem' }}>
      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2.5rem',
          paddingBottom: '1.75rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div className="flex items-center gap-3">
          <div style={{
            width: 44, height: 44,
            background: 'var(--gradient-accent)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)',
          }}>
            <ListTodo style={{ width: 22, height: 22, color: '#ffffff' }} />
          </div>
          <div>
            <h1 style={{
              fontSize: '1.5rem', fontWeight: 800, marginBottom: 2,
              background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--accent-primary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              opacity: 0.9,
            }}>100xDevs Tracker</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, fontWeight: 500 }}>
              Product Engineering Progress
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!loading && videos.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: stats.progress === 100 ? 'var(--accent-success-light)' : 'var(--accent-light)',
              color: stats.progress === 100 ? 'var(--accent-success)' : 'var(--accent-hover)',
              padding: '0.375rem 0.875rem',
              borderRadius: 99,
              fontSize: '0.8125rem',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              border: `1px solid ${stats.progress === 100 ? 'rgba(52, 211, 153, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`,
              boxShadow: stats.progress === 100 ? '0 0 12px rgba(52, 211, 153, 0.15)' : '0 0 12px rgba(99, 102, 241, 0.15)',
            }}>
              <Zap style={{ width: 13, height: 13 }} />
              {stats.progress}% Complete
            </div>
          )}
          <ThemeToggle />
        </div>
      </motion.header>

      {/* ── Syncing banner ── */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.875rem',
            padding: '1rem 1.25rem',
          }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.08)',
            borderTopColor: 'var(--accent-primary)',
            animation: 'spin 0.8s linear infinite',
            flexShrink: 0,
          }} />
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Syncing video library from YouTube…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
        </motion.div>
      )}

      {!loading && videos.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          gap: '1.75rem',
          alignItems: 'start',
        }}>
          {/* ── Sticky Sidebar ── */}
          <motion.aside
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            style={{ 
              position: 'sticky', 
              top: '2rem', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1rem',
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              paddingRight: '0.5rem',
              scrollbarWidth: 'none',
            }}
          >

            {/* Progress Card */}
            <div className="card" style={{ padding: '1.5rem' }}>
              {/* Circular-style progress */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                  <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="32" cy="32" r="27" fill="none" stroke="var(--border-color)" strokeWidth="5" />
                    <motion.circle
                      cx="32" cy="32" r="27" fill="none"
                      stroke="var(--accent-primary)" strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 27}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 27 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 27 * (1 - stats.progress / 100) }}
                      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: 'var(--accent-primary)',
                  }}>
                    {stats.progress}%
                  </div>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    Completion
                  </p>
                  <div style={{ fontSize: '1.625rem', fontWeight: 700, lineHeight: 1, color: 'var(--text-primary)' }}>
                    {stats.completed}
                    <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                      /{stats.total}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stat pills */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                {[
                  { label: 'Done', value: stats.completed, icon: CheckCircle2, color: 'var(--accent-success)', bg: 'var(--accent-success-light)' },
                  { label: 'Streak', value: `${stats.streak}d`, icon: Flame, color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} style={{
                    background: bg,
                    borderRadius: 10,
                    padding: '0.75rem',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon style={{ width: 13, height: 13, color }} />
                      <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievements Section */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Trophy style={{ width: 16, height: 16, color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Milestones
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { label: 'First Step', desc: 'Complete 1 module', icon: Target, unlocked: stats.completed >= 1 },
                  { label: 'Consistent', desc: '3 day streak', icon: Flame, unlocked: stats.streak >= 3 },
                  { label: 'Halfway', desc: '50% completion', icon: Award, unlocked: stats.progress >= 50 },
                ].map((a, i) => (
                  <div key={i} style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    opacity: a.unlocked ? 1 : 0.4,
                    filter: a.unlocked ? 'none' : 'grayscale(1)',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: 8, 
                      background: a.unlocked ? 'var(--gradient-accent)' : 'var(--bg-surface-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: a.unlocked ? '0 4px 12px rgba(99, 102, 241, 0.2)' : 'none'
                    }}>
                      <a.icon style={{ width: 16, height: 16, color: a.unlocked ? 'white' : 'var(--text-muted)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</div>
                      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{a.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Growth Chart */}
            {chartData.length > 0 ? (
              <GrowthChart data={chartData} />
            ) : (
              <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                <Award style={{ width: 28, height: 28, color: 'var(--text-muted)', margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  Complete a module to see your growth chart.
                </p>
              </div>
            )}

            {/* Pomodoro Timer Widget */}
            <PomodoroTimer />
          </motion.aside>

          {/* ── Video Task List ── */}
          <motion.div
            className="flex flex-col"
            style={{ gap: '0.75rem' }}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {videos.map((video, index) => {
              const task = data.tasks[video.id] || {
                subtasks: []
              };
              const isExpanded = expandedVideoId === video.id;
              const isCompleted = task.completedAt !== undefined;
              const subtaskCount = task.subtasks.filter(s => s.completed).length;
              const totalSubtasks = task.subtasks.length;

              return (
                <motion.div
                  key={video.id}
                  variants={itemVariants}
                  className="card overflow-hidden"
                  style={{
                    padding: 0,
                    borderColor: isCompleted ? 'rgba(52, 211, 153, 0.2)' : 'var(--border-color)',
                    background: isCompleted && !isExpanded ? 'rgba(52, 211, 153, 0.04)' : 'var(--bg-surface)',
                    opacity: isCompleted && !isExpanded ? 0.88 : 1,
                    transition: 'opacity 0.25s ease, border-color 0.25s ease, background 0.25s ease',
                  }}
                >
                  {/* ── Card Header (always visible) ── */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedVideoId(isExpanded ? null : video.id)}
                    style={{ padding: '1.125rem 1.375rem', gap: '1rem' }}
                  >
                    <div className="flex items-center" style={{ gap: '0.875rem', minWidth: 0 }}>
                      {/* Status icon */}
                      <div style={{ flexShrink: 0 }}>
                        {isCompleted
                          ? <CheckCircle2 style={{ width: 20, height: 20, color: 'var(--accent-success)' }} />
                          : <PlayCircle style={{ width: 20, height: 20, color: 'var(--text-muted)' }} />
                        }
                      </div>

                      {/* Title + progress dots */}
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{
                          fontSize: '0.9375rem',
                          fontWeight: 500,
                          color: isCompleted && !isExpanded ? 'var(--text-secondary)' : 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginBottom: 3,
                        }}>
                          {video.title}
                        </h3>
                        {/* Sub-task pips */}
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {task.subtasks.map((s) => (
                            <div key={s.id} style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: s.completed ? 'var(--accent-primary)' : 'var(--border-color-strong)',
                              transition: 'background 0.2s ease',
                            }} />
                          ))}
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
                            {subtaskCount}/{totalSubtasks}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                      {/* Episode badge */}
                      <span style={{
                        fontSize: '0.6875rem', fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                        background: 'var(--bg-surface-2)',
                        padding: '0.2rem 0.5rem', borderRadius: 99,
                        border: '1px solid var(--border-color)',
                      }}>
                        #{String(index + 1).padStart(2, '0')}
                      </span>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                      >
                        <ChevronDown style={{ width: 17, height: 17, color: 'var(--text-muted)' }} />
                      </motion.div>
                    </div>
                  </div>

                  {/* ── Expanded Panel ── */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="expanded"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          borderTop: '1px solid var(--border-color)',
                          padding: '1.375rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1.5rem',
                        }}>
                          {/* Video Player */}
                          <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)', background: '#000' }}>
                            <iframe
                              width="100%"
                              height="100%"
                              src={`https://www.youtube.com/embed/${video.id}`}
                              title="YouTube video player"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            ></iframe>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            {/* Checklist */}
                            <div>
                                <p style={{
                                fontSize: '0.6875rem', fontFamily: 'var(--font-mono)',
                                textTransform: 'uppercase', letterSpacing: '0.07em',
                                color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.75rem',
                              }}>
                                Execution Checklist
                              </p>
                              <div className="flex flex-col" style={{ gap: '0.125rem' }}>
                                {task.subtasks.map((s) => {
                                  const Icon = DEFAULT_ICONS[s.id] || ListTodo;
                                  return (
                                    <div key={s.id} className="checklist-item">
                                      <label className="checkbox-wrapper" style={{ flex: 1, background: 'transparent' }}>
                                        <input
                                          type="checkbox"
                                          checked={s.completed}
                                          onChange={() => handleSubtaskToggle(video.id, s.id)}
                                        />
                                        <span className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                                          <Icon style={{ width: 14, height: 14, opacity: 0.8, flexShrink: 0 }} />
                                          {s.label}
                                        </span>
                                      </label>
                                      <button 
                                        className="delete-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteSubtask(video.id, s.id);
                                        }}
                                        title="Delete task"
                                      >
                                        <Trash2 style={{ width: 14, height: 14 }} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Add Item Actions */}
                            <div>
                              <p style={{
                                fontSize: '0.6875rem', fontFamily: 'var(--font-mono)',
                                textTransform: 'uppercase', letterSpacing: '0.07em',
                                color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.75rem',
                              }}>
                                Custom Actions
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <input 
                                    id={`new-task-${video.id}`}
                                    type="text" 
                                    placeholder="Add custom task..." 
                                    style={{ flex: 1, fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleAddSubtask(video.id, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                      }
                                    }}
                                  />
                                  <button 
                                    className="btn-primary"
                                    style={{ padding: '0 1rem' }}
                                    onClick={() => {
                                      const input = document.getElementById(`new-task-${video.id}`) as HTMLInputElement;
                                      handleAddSubtask(video.id, input.value);
                                      input.value = '';
                                    }}
                                  >
                                    Add
                                  </button>
                                </div>
                                <a 
                                  href={`https://www.youtube.com/watch?v=${video.id}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="btn-outline w-full"
                                  style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}
                                >
                                  <span>Watch on YouTube</span>
                                  <ExternalLink style={{ width: 13, height: 13 }} />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}
    </main>
  );
}
