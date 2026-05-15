"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type TimerMode = 'focus' | 'break';

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

interface PomodoroProps {
  onStateChange?: (state: 'focus' | 'break' | 'idle') => void;
  currentVideoDuration?: string; // e.g. "10:05"
}

const HEALTH_PROMPTS = [
  "Look 20 feet away for 20 seconds 🌿",
  "Stretch your wrists and fingers 🖐️",
  "Drink a glass of water 💧",
  "Do 5 deep breaths 🫁",
  "Roll your shoulders back 3 times 🔄",
  "Stand up and walk for 1 minute 🚶"
];

export function PomodoroTimer({ onStateChange, currentVideoDuration }: PomodoroProps) {
  const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<TimerMode>('focus');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [presets, setPresets] = useState({ focus: 25, break: 5 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState("");

  const totalTime = mode === 'focus' ? presets.focus * 60 : presets.break * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  const playNotification = useCallback(() => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      playNotification();
      setIsRunning(false);
      if (mode === 'focus') {
        setMode('break');
        setTimeLeft(BREAK_TIME);
      } else {
        setMode('focus');
        setTimeLeft(FOCUS_TIME);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeLeft, mode, playNotification]);

  const toggleTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newRunning = !isRunning;
    setIsRunning(newRunning);
    if (onStateChange) {
      onStateChange(newRunning ? mode : 'idle');
    }
  };

  const resetTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRunning(false);
    setTimeLeft(mode === 'focus' ? FOCUS_TIME : BREAK_TIME);
  };

  const toggleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRunning(false);
    const newMode = mode === 'focus' ? 'break' : 'focus';
    setMode(newMode);
    setTimeLeft(newMode === 'focus' ? presets.focus * 60 : presets.break * 60);
    if (onStateChange) onStateChange('idle');
    if (newMode === 'break') {
      setCurrentPrompt(HEALTH_PROMPTS[Math.floor(Math.random() * HEALTH_PROMPTS.length)]);
    }
  };

  const applyPreset = (focus: number, brk: number) => {
    setIsRunning(false);
    setPresets({ focus, break: brk });
    setTimeLeft(focus * 60);
    setMode('focus');
    setShowCustom(false);
    if (onStateChange) onStateChange('idle');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      layout
      className="card sidebar-card" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: isExpanded ? '1rem' : '0',
        cursor: isExpanded ? 'default' : 'pointer',
        overflow: 'hidden',
        border: isRunning ? `1px solid ${mode === 'focus' ? 'var(--accent-primary)' : 'var(--accent-success)'}` : '1px solid var(--border-color)',
        transition: 'border 0.3s ease'
      }}
      onClick={() => !isExpanded && setIsExpanded(true)}
    >
      {/* Header / Minimized View */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: 28, height: 28,
            borderRadius: '50%',
            background: mode === 'focus' ? 'var(--accent-light)' : 'var(--accent-success-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            {mode === 'focus' ? (
              <Brain style={{ width: 14, height: 14, color: 'var(--accent-primary)' }} />
            ) : (
              <Coffee style={{ width: 14, height: 14, color: 'var(--accent-success)' }} />
            )}
          </div>
          
          {!isExpanded && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <span style={{ 
                fontSize: '1rem', 
                fontWeight: 700, 
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)'
              }}>
                {formatTime(timeLeft)}
              </span>
              <div style={{ 
                width: 4, height: 4, borderRadius: '50%', 
                background: isRunning ? (mode === 'focus' ? 'var(--accent-primary)' : 'var(--accent-success)') : 'var(--text-muted)',
                animation: isRunning ? 'pulse 1.5s infinite' : 'none'
              }} />
            </motion.div>
          )}

          {isExpanded && (
            <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {mode === 'focus' ? 'Focus Session' : 'Active Break'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!isExpanded && isRunning && (
            <button 
              onClick={toggleTimer}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)' }}
            >
              <Pause style={{ width: 14, height: 14 }} />
            </button>
          )}
          {!isExpanded && !isRunning && (
            <button 
              onClick={toggleTimer}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--accent-primary)' }}
            >
              <Play style={{ width: 14, height: 14 }} />
            </button>
          )}
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}
          >
            {isExpanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '160px', margin: '0 auto', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg 
                  viewBox="0 0 100 100" 
                  style={{ width: '100%', height: '100%', display: 'block' }}
                >
                  <circle 
                    cx="50" cy="50" r="45" 
                    fill="none" stroke="var(--border-color)" strokeWidth="4" 
                  />
                  <motion.circle 
                    cx="50" cy="50" r="45" 
                    fill="none" 
                    stroke={mode === 'focus' ? 'var(--accent-primary)' : 'var(--accent-success)'} 
                    strokeWidth="4" 
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 45}
                    initial={{ strokeDashoffset: 2 * Math.PI * 45 }}
                    animate={{ strokeDashoffset: (2 * Math.PI * 45) * (1 - progress / 100) }}
                    transition={{ duration: 1, ease: "linear" }}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                  />
                </svg>
                <div style={{ 
                  position: 'absolute',
                  fontSize: 'clamp(1.125rem, 12cqi, 1.75rem)', 
                  fontWeight: 700, 
                  fontFamily: 'var(--font-mono)', 
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {formatTime(timeLeft)}
                </div>
              </div>

              {/* Health Prompt during break */}
              {mode === 'break' && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ 
                    textAlign: 'center', padding: '0 0.5rem',
                    fontSize: '0.8125rem', color: 'var(--accent-success)',
                    fontWeight: 500, fontStyle: 'italic'
                  }}
                >
                  {currentPrompt}
                </motion.div>
              )}

              {/* Presets & Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[
                    { label: '25/5', f: 25, b: 5 },
                    { label: '50/10', f: 50, b: 10 },
                  ].map(p => (
                    <button
                      key={p.label}
                      onClick={(e) => { e.stopPropagation(); applyPreset(p.f, p.b); }}
                      style={{
                        flex: '1 1 60px',
                        padding: '6px 4px', borderRadius: 6, fontSize: '0.75rem',
                        background: presets.focus === p.f ? 'var(--accent-primary)' : 'var(--bg-surface-2)',
                        color: presets.focus === p.f ? 'white' : 'var(--text-secondary)',
                        border: '1px solid var(--border-color)', cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowCustom(!showCustom); }}
                    style={{
                      flex: '1 1 60px',
                      padding: '6px 4px', borderRadius: 6, fontSize: '0.75rem',
                      background: showCustom ? 'var(--accent-primary)' : 'var(--bg-surface-2)',
                      color: showCustom ? 'white' : 'var(--text-secondary)',
                      border: '1px solid var(--border-color)', cursor: 'pointer'
                    }}
                  >
                    Custom
                  </button>
                </div>

                {showCustom && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <input 
                      type="number" 
                      placeholder="Focus" 
                      className="timer-input"
                      style={{ width: 50, fontSize: '0.75rem', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-surface-2)', border: '1px solid var(--border-color)' }}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 25;
                        setPresets(p => ({ ...p, focus: val }));
                        if (mode === 'focus') setTimeLeft(val * 60);
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/</span>
                    <input 
                      type="number" 
                      placeholder="Break" 
                      className="timer-input"
                      style={{ width: 50, fontSize: '0.75rem', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-surface-2)', border: '1px solid var(--border-color)' }}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 5;
                        setPresets(p => ({ ...p, break: val }));
                        if (mode === 'break') setTimeLeft(val * 60);
                      }}
                    />
                  </motion.div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', alignItems: 'center' }}>
                  <button 
                    onClick={toggleMode}
                    style={{
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {mode === 'focus' ? 'to Break' : 'to Focus'}
                  </button>
                  
                  <button 
                    onClick={toggleTimer}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 40, height: 40, borderRadius: '50%',
                      background: mode === 'focus' ? 'var(--accent-primary)' : 'var(--accent-success)',
                      color: 'white', border: 'none', cursor: 'pointer',
                      boxShadow: mode === 'focus' ? '0 4px 20px rgba(99, 102, 241, 0.4)' : '0 4px 20px rgba(52, 211, 153, 0.4)'
                    }}
                  >
                    {isRunning ? <Pause style={{ width: 18, height: 18, fill: 'currentColor' }} /> : <Play style={{ width: 18, height: 18, fill: 'currentColor', marginLeft: 2 }} />}
                  </button>

                  <button 
                    onClick={resetTimer}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--bg-surface-2)',
                      color: 'var(--text-secondary)', border: '1px solid var(--border-color)', cursor: 'pointer'
                    }}
                  >
                    <RotateCcw style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </motion.div>
  );
}
