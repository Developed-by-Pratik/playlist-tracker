'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlayCircle, CheckCircle2, ChevronDown, 
  ExternalLink, Trash2, ListTodo, Zap, Play 
} from 'lucide-react';
import { Video, TaskRecord, SubTask } from '@/lib/types';

interface VideoCardProps {
  video: Video;
  index: number;
  task: TaskRecord;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSubtaskToggle: (videoId: string, subtaskId: string) => void;
  onAddSubtask: (videoId: string, label: string) => void;
  onDeleteSubtask: (videoId: string, subtaskId: string) => void;
  defaultSubtasks: SubTask[];
  icons: Record<string, any>;
  parseISODuration: (duration: string) => number;
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as any }
  }
};

export function VideoCard({ 
  video, index, task, isExpanded, onToggleExpand, 
  onSubtaskToggle, onAddSubtask, onDeleteSubtask,
  defaultSubtasks, icons, parseISODuration 
}: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  const displaySubtasks = task.subtasks.length > 0 ? task.subtasks : defaultSubtasks;
  const isCompleted = task.completedAt !== undefined;
  const subtaskCount = displaySubtasks.filter(s => s.completed).length;
  const totalSubtasks = displaySubtasks.length;

  return (
    <motion.div
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
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggleExpand}
        style={{ padding: '1.125rem 1.375rem', gap: '1rem' }}
      >
        <div className="flex items-center" style={{ gap: '0.875rem', minWidth: 0 }}>
          <div style={{ flexShrink: 0 }}>
            {isCompleted
              ? <CheckCircle2 style={{ width: 20, height: 20, color: 'var(--accent-success)' }} />
              : <PlayCircle style={{ width: 20, height: 20, color: 'var(--text-muted)' }} />
            }
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              fontSize: '0.9375rem', fontWeight: 500,
              color: isCompleted && !isExpanded ? 'var(--text-secondary)' : 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 3,
            }}>
              {video.title}
            </h3>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {displaySubtasks.map((s) => (
                <div key={s.id} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: s.completed ? 'var(--accent-primary)' : 'var(--border-color-strong)',
                }} />
              ))}
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
                {subtaskCount}/{totalSubtasks}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
          <span style={{
            fontSize: '0.6875rem', fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)', background: 'var(--bg-surface-2)',
            padding: '0.2rem 0.5rem', borderRadius: 99,
            border: '1px solid var(--border-color)',
          }}>
            #{String(index + 1).padStart(2, '0')}
          </span>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
            <ChevronDown style={{ width: 17, height: 17, color: 'var(--text-muted)' }} />
          </motion.div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              borderTop: '1px solid var(--border-color)',
              padding: '1.375rem', display: 'flex', flexDirection: 'column', gap: '1.5rem',
            }}>
              {/* Video Player - Optimized with Lazy Loading */}
              <div style={{ 
                width: '100%', aspectRatio: '16/9', borderRadius: 12, 
                overflow: 'hidden', border: '1px solid var(--border-color)', 
                background: '#000', position: 'relative' 
              }}>
                {isPlaying ? (
                  <iframe
                    width="100%" height="100%"
                    src={`https://www.youtube.com/embed/${video.id}?autoplay=1&enablejsapi=1`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                ) : (
                  <div 
                    style={{ width: '100%', height: '100%', cursor: 'pointer', position: 'relative' }}
                    onClick={() => setIsPlaying(true)}
                  >
                    <img 
                      src={video.thumbnailUrl} 
                      alt={video.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.9)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
                        transition: 'transform 0.2s ease',
                      }} className="play-button-overlay">
                        <Play style={{ width: 24, height: 24, color: 'white', marginLeft: 4 }} fill="white" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {video.duration && (
                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-color)' }}>
                  <div style={{ padding: 8, borderRadius: '50%', background: 'var(--accent-primary-light)' }}>
                    <Zap style={{ width: 14, height: 14, color: 'var(--accent-primary)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Progress Prediction</p>
                    <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', margin: 0 }}>
                      A 50m session will cover approx. <b>{Math.min(100, Math.round((50 * 60 / parseISODuration(video.duration)) * 100))}%</b> of this module.
                    </p>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <p className="section-label">Execution Checklist</p>
                  <div className="flex flex-col" style={{ gap: '0.125rem' }}>
                    {displaySubtasks.map((s) => {
                      const Icon = icons[s.id] || ListTodo;
                      return (
                        <div key={s.id} className="checklist-item">
                          <label className="checkbox-wrapper" style={{ flex: 1, background: 'transparent' }}>
                            <input
                              type="checkbox"
                              checked={s.completed}
                              onChange={() => onSubtaskToggle(video.id, s.id)}
                            />
                            <span className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                              <Icon style={{ width: 14, height: 14, opacity: 0.8, flexShrink: 0 }} />
                              {s.label}
                            </span>
                          </label>
                          <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onDeleteSubtask(video.id, s.id); }}>
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <p className="section-label">Custom Actions</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        id={`new-task-${video.id}`}
                        type="text" placeholder="Add custom task..." 
                        style={{ flex: 1, fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onAddSubtask(video.id, e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <button 
                        className="btn-primary" style={{ padding: '0 1rem' }}
                        onClick={() => {
                          const input = document.getElementById(`new-task-${video.id}`) as HTMLInputElement;
                          onAddSubtask(video.id, input.value);
                          input.value = '';
                        }}
                      >Add</button>
                    </div>
                    <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="btn-outline w-full" style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
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
      <style>{`
        .section-label {
          font-size: 0.6875rem; font-family: var(--font-mono); text-transform: uppercase;
          letter-spacing: 0.07em; color: var(--text-muted); font-weight: 600; margin-bottom: 0.75rem;
        }
        .play-button-overlay:hover {
          transform: scale(1.1);
          background: var(--accent-primary) !important;
        }
      `}</style>
    </motion.div>
  );
}
