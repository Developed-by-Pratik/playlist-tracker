"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { loadData, updateTask } from '@/lib/storage';
import { fetchPlaylistVideos } from '@/lib/youtube';
import { AppData, Video } from '@/lib/types';
import { PlayCircle, Code2, Users, Briefcase, Zap, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// New Components
import { StatsSidebar } from '@/components/Sidebar/StatsSidebar';
import { VideoCard } from '@/components/VideoList/VideoCard';
import { SyncHeader } from '@/components/Layout/SyncHeader';
import { SkeletonLoader } from '@/components/Layout/SkeletonLoader';

// Libs
import { loadFromCloud, subscribeToCloudChanges, CloudSyncStatus, mergeData } from '@/lib/cloud-storage';
import { isSupabaseConfigured } from '@/lib/supabase';

// Constants
const DEFAULT_ICONS: Record<string, any> = {
  watchVideo: PlayCircle,
  programPractice: Code2,
  postLinkedIn: Users,
  updateNaukri: Briefcase,
};

const DEFAULT_SUBTASKS = [
  { id: 'watchVideo', label: 'Watch Module', completed: false },
  { id: 'programPractice', label: 'Code Practice', completed: false },
  { id: 'postLinkedIn', label: 'Community Post', completed: false },
  { id: 'updateNaukri', label: 'Profile Update', completed: false },
];

// Helper to parse ISO 8601 duration
const parseISODuration = (duration: string) => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  return hours * 3600 + minutes * 60 + seconds;
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } }
};

export default function Home() {
  const [data, setData] = useState<AppData | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(
    isSupabaseConfigured() ? 'idle' : 'unconfigured'
  );
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadInitialData = async () => {
    const local = loadData();
    setData(local);
    setLoading(true);

    if (isSupabaseConfigured()) {
      setSyncStatus('syncing');
      try {
        const cloud = await loadFromCloud();
        if (cloud) {
          const merged = mergeData(local, cloud);
          localStorage.setItem('playlist_tracker_data', JSON.stringify(merged));
          setData(merged);
          setSyncStatus('synced');
          setTimeout(() => setSyncStatus('idle'), 2000);
        }
      } catch (e) {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 4000);
      }
    }

    try {
      const vids = await fetchPlaylistVideos();
      setVideos(vids);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInitialData();
    
    const unsubscribe = subscribeToCloudChanges((remoteData) => {
      isRemoteUpdate.current = true;
      setData(prev => prev ? mergeData(prev, remoteData) : remoteData);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
      isRemoteUpdate.current = false;
    });

    return unsubscribe;
  }, []);

  const handleSubtaskToggle = useCallback((videoId: string, subtaskId: string) => {
    if (!data) return;
    const currentTask = data.tasks[videoId] || { videoId, subtasks: DEFAULT_SUBTASKS };
    const subtasksToUse = currentTask.subtasks.length > 0 ? currentTask.subtasks : DEFAULT_SUBTASKS;

    const updatedSubtasks = subtasksToUse.map(s => 
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    const updated = updateTask(videoId, { subtasks: updatedSubtasks });
    setData(updated);
  }, [data]);

  const handleAddSubtask = useCallback((videoId: string, label: string) => {
    if (!data || !label.trim()) return;
    const currentTask = data.tasks[videoId] || { videoId, subtasks: DEFAULT_SUBTASKS };
    const subtasksToUse = currentTask.subtasks.length > 0 ? currentTask.subtasks : DEFAULT_SUBTASKS;

    const newSubtask = { id: `custom-${Date.now()}`, label, completed: false };
    const updated = updateTask(videoId, { subtasks: [...subtasksToUse, newSubtask] });
    setData(updated);
  }, [data]);

  const handleDeleteSubtask = useCallback((videoId: string, subtaskId: string) => {
    if (!data) return;
    const currentTask = data.tasks[videoId];
    if (!currentTask) return;
    const updatedSubtasks = currentTask.subtasks.filter(s => s.id !== subtaskId);
    const updated = updateTask(videoId, { subtasks: updatedSubtasks });
    setData(updated);
  }, [data]);

  const handlePomodoroStateChange = (state: 'focus' | 'break' | 'idle') => {
    if (state === 'break') setSessionCount(prev => prev + 1);
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

    let streak = 0;
    const today = new Date();
    const checkDate = new Date();
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

    return { completed, total: videos.length, progress: Math.round((completed / videos.length) * 100) || 0, streak };
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

  const filteredVideos = useMemo(() => {
    if (!hideCompleted || !data) return videos;
    return videos.filter(v => {
      const task = data.tasks[v.id];
      return !task || !task.completedAt;
    });
  }, [videos, hideCompleted, data]);

  if (!data || (loading && videos.length === 0)) return <SkeletonLoader />;

  return (
    <>
    <main className="container" style={{ paddingBottom: '6rem' }}>
      <SyncHeader 
        loading={loading} 
        progress={stats.progress} 
        syncStatus={syncStatus} 
        hideCompleted={hideCompleted}
        onToggleHideCompleted={() => setHideCompleted(!hideCompleted)}
      />

      <div className="main-grid">
        <StatsSidebar 
          data={data}
          videos={videos}
          stats={stats}
          chartData={chartData}
          sessionCount={sessionCount}
          onPomodoroStateChange={handlePomodoroStateChange}
        />

        <motion.div
          className="flex flex-col"
          style={{ gap: '0.75rem', width: '100%', minWidth: 0 }}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredVideos.map((video, index) => {
            const originalIndex = videos.findIndex(v => v.id === video.id);
            return (
              <VideoCard 
                key={video.id}
                video={video}
                index={originalIndex}
                task={data.tasks[video.id] || { videoId: video.id, subtasks: [] }}
                isExpanded={expandedVideoId === video.id}
                onToggleExpand={() => setExpandedVideoId(expandedVideoId === video.id ? null : video.id)}
                onSubtaskToggle={handleSubtaskToggle}
                onAddSubtask={handleAddSubtask}
                onDeleteSubtask={handleDeleteSubtask}
                defaultSubtasks={DEFAULT_SUBTASKS}
                icons={DEFAULT_ICONS}
                parseISODuration={parseISODuration}
              />
            );
          })}
          {filteredVideos.length === 0 && !loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-surface-2)', borderRadius: 20, border: '1px dashed var(--border-color)' }}
            >
              <Zap style={{ width: 40, height: 40, color: 'var(--accent-primary)', margin: '0 auto 1rem', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.125rem' }}>All Modules Completed!</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>You've finished everything in your current view. Disable "Hide Done" to see all modules.</p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </main>
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="btn-primary"
            style={{
              position: 'fixed', bottom: '2rem', right: '2rem',
              width: 48, height: 48, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
              zIndex: 100, padding: 0
            }}
          >
            <ChevronUp style={{ width: 20, height: 20 }} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
