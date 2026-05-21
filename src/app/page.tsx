"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { loadData, updateTask, addPlaylist, removePlaylist, setActivePlaylist, updatePlaylistVideoCount, renamePlaylist } from '@/lib/storage';
import { AppData, Video } from '@/lib/types';
import { PlayCircle, Code2, Users, Briefcase, Zap, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { StatsSidebar } from '@/components/Sidebar/StatsSidebar';
import { VideoCard } from '@/components/VideoList/VideoCard';
import { SyncHeader } from '@/components/Layout/SyncHeader';
import { SkeletonLoader } from '@/components/Layout/SkeletonLoader';
import { EmptyState } from '@/components/Playlist/EmptyState';
import { AddPlaylistModal } from '@/components/Playlist/AddPlaylistModal';
import { PlaylistSwitcher } from '@/components/Playlist/PlaylistSwitcher';

import { loadFromCloud, subscribeToCloudChanges, CloudSyncStatus, mergeData } from '@/lib/cloud-storage';
import { isSupabaseConfigured } from '@/lib/supabase';

const DEFAULT_ICONS: Record<string, any> = {
  watchVideo: PlayCircle,
};

const DEFAULT_SUBTASKS = [
  { id: 'watchVideo', label: 'Watch Video', completed: false },
];

const parseISODuration = (duration: string) => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || '0') * 3600) + (parseInt(match[2] || '0') * 60) + parseInt(match[3] || '0');
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } }
};

export default function Home() {
  const [data, setData] = useState<AppData | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(false);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(
    isSupabaseConfigured() ? 'idle' : 'unconfigured'
  );
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isRemoteUpdate = useRef(false);
  const lastPlaylistId = useRef<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load data from localStorage + cloud on mount
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
      } catch {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 4000);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadInitialData();
    const unsubscribe = subscribeToCloudChanges(remoteData => {
      isRemoteUpdate.current = true;
      setData(prev => prev ? mergeData(prev, remoteData) : remoteData);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
      isRemoteUpdate.current = false;
    });
    return unsubscribe;
  }, []);

  // Fetch videos when active playlist changes
  useEffect(() => {
    if (!data) return;
    const activeId = data.activePlaylistId;
    const playlist = activeId ? data.playlists[activeId] : null;
    if (!playlist) { setVideos([]); return; }
    if (lastPlaylistId.current === activeId) return; // Already loaded
    lastPlaylistId.current = activeId;

    setVideosLoading(true);
    setExpandedVideoId(null);
    fetch(`/api/youtube?playlistId=${playlist.youtubePlaylistId}`)
      .then(r => r.json())
      .then(resData => {
        const vids = resData && typeof resData === 'object' && 'videos' in resData ? resData.videos : resData;
        if (Array.isArray(vids)) {
          setVideos(vids);
          // If the stored videoCount does not match or is undefined, update it!
          if (playlist.videoCount !== vids.length) {
            const updated = updatePlaylistVideoCount(playlist.id, vids.length);
            setData(updated);
          }
        } else {
          setVideos([]);
        }
      })
      .catch(() => setVideos([]))
      .finally(() => setVideosLoading(false));
  }, [data?.activePlaylistId]);

  // Active playlist derived state
  const activePlaylist = useMemo(() => {
    if (!data || !data.activePlaylistId) return null;
    return data.playlists[data.activePlaylistId] || null;
  }, [data]);

  const activeTasks = useMemo(() => activePlaylist?.tasks || {}, [activePlaylist]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleToggleExpand = useCallback((videoId: string) => {
    setExpandedVideoId(prev => prev === videoId ? null : videoId);
  }, []);

  const handleSubtaskToggle = useCallback((videoId: string, subtaskId: string) => {
    setData(prev => {
      if (!prev?.activePlaylistId) return prev;
      const activeId = prev.activePlaylistId;
      const activeTasks = prev.playlists[activeId]?.tasks || {};
      const currentTask = activeTasks[videoId] || { videoId, subtasks: DEFAULT_SUBTASKS };
      const subtasksToUse = currentTask.subtasks.length > 0 ? currentTask.subtasks : DEFAULT_SUBTASKS;
      const updatedSubtasks = subtasksToUse.map(s =>
        s.id === subtaskId ? { ...s, completed: !s.completed } : s
      );
      return updateTask(activeId, videoId, { subtasks: updatedSubtasks }, prev);
    });
  }, []);

  const handleAddSubtask = useCallback((videoId: string, label: string) => {
    if (!label.trim()) return;
    setData(prev => {
      if (!prev?.activePlaylistId) return prev;
      const activeId = prev.activePlaylistId;
      const activeTasks = prev.playlists[activeId]?.tasks || {};
      const currentTask = activeTasks[videoId] || { videoId, subtasks: DEFAULT_SUBTASKS };
      const subtasksToUse = currentTask.subtasks.length > 0 ? currentTask.subtasks : DEFAULT_SUBTASKS;
      const newSubtask = { id: `custom-${Date.now()}`, label, completed: false };
      return updateTask(activeId, videoId, { subtasks: [...subtasksToUse, newSubtask] }, prev);
    });
  }, []);

  const handleDeleteSubtask = useCallback((videoId: string, subtaskId: string) => {
    setData(prev => {
      if (!prev?.activePlaylistId) return prev;
      const activeId = prev.activePlaylistId;
      const activeTasks = prev.playlists[activeId]?.tasks || {};
      const currentTask = activeTasks[videoId];
      if (!currentTask) return prev;
      const updatedSubtasks = currentTask.subtasks.filter(s => s.id !== subtaskId);
      return updateTask(activeId, videoId, { subtasks: updatedSubtasks }, prev);
    });
  }, []);

  const handleAddPlaylist = useCallback((name: string, youtubePlaylistId: string) => {
    const updated = addPlaylist(name, youtubePlaylistId);
    lastPlaylistId.current = null; // Force video re-fetch
    setData({ ...updated });
  }, []);

  const handleRenamePlaylist = useCallback((playlistId: string, name: string) => {
    const updated = renamePlaylist(playlistId, name);
    setData({ ...updated });
  }, []);

  const handleDeletePlaylist = useCallback((playlistId: string) => {
    const updated = removePlaylist(playlistId);
    lastPlaylistId.current = null;
    setData({ ...updated });
    setVideos([]);
  }, []);

  const handleSwitchPlaylist = useCallback((playlistId: string) => {
    if (!data || data.activePlaylistId === playlistId) return;
    lastPlaylistId.current = null; // Force video re-fetch
    const updated = setActivePlaylist(playlistId);
    setData({ ...updated });
    setVideos([]);
  }, [data]);

  const handlePomodoroStateChange = (state: 'focus' | 'break' | 'idle') => {
    if (state === 'break') setSessionCount(prev => prev + 1);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!activePlaylist || videos.length === 0) return { completed: 0, total: 0, progress: 0, streak: 0 };
    let completed = 0;
    const completionDates = new Set<string>();

    videos.forEach(v => {
      const t = activeTasks[v.id];
      if (t?.completedAt) {
        completed++;
        completionDates.add(new Date(t.completedAt).toDateString());
      }
    });

    let streak = 0;
    const today = new Date();
    const checkDate = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const doneToday = completionDates.has(today.toDateString());
    const doneYesterday = completionDates.has(yesterday.toDateString());

    if (doneToday || doneYesterday) {
      if (!doneToday) checkDate.setDate(checkDate.getDate() - 1);
      while (completionDates.has(checkDate.toDateString())) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    return { completed, total: videos.length, progress: Math.round((completed / videos.length) * 100) || 0, streak };
  }, [activePlaylist, activeTasks, videos]);

  const chartData = useMemo(() => {
    if (!data || !data.playlists) return [];
    const countsByDateKey: Record<string, { label: string; count: number }> = {};
    const toKey = (d: Date) => d.toISOString().slice(0, 10);
    const toLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const todayKey = toKey(new Date());

    Object.values(data.playlists).forEach(playlist => {
      Object.values(playlist.tasks || {}).forEach(task => {
        if (task.completedAt) {
          const completedDate = new Date(task.completedAt);
          const key = toKey(completedDate);
          const label = toLabel(completedDate);
          const subtasksDone = task.subtasks.filter(s => s.completed).length;
          if (!countsByDateKey[key]) countsByDateKey[key] = { label, count: 0 };
          countsByDateKey[key].count += subtasksDone;
        } else {
          const partialDone = task.subtasks.filter(s => s.completed).length;
          if (partialDone > 0) {
            if (!countsByDateKey[todayKey]) countsByDateKey[todayKey] = { label: toLabel(new Date()), count: 0 };
            countsByDateKey[todayKey].count += partialDone;
          }
        }
      });
    });

    if (Object.keys(countsByDateKey).length === 0) return [];
    const sortedKeys = Object.keys(countsByDateKey).sort();
    const minDate = new Date(sortedKeys[0]);
    const maxDate = new Date(sortedKeys[sortedKeys.length - 1]);
    const result: { date: string; count: number }[] = [];
    const cursor = new Date(minDate);
    while (cursor <= maxDate) {
      const key = toKey(cursor);
      const entry = countsByDateKey[key];
      result.push({ date: entry ? entry.label : toLabel(new Date(cursor)), count: entry ? entry.count : 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [data]);

  const filteredVideos = useMemo(() => {
    if (!hideCompleted) return videos;
    return videos.filter(v => !activeTasks[v.id]?.completedAt);
  }, [videos, hideCompleted, activeTasks]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!data || loading) return <SkeletonLoader />;

  const hasPlaylists = Object.keys(data.playlists).length > 0;

  return (
    <>
      <main className="container" style={{ paddingBottom: '6rem' }}>
        <SyncHeader
          loading={videosLoading}
          progress={stats.progress}
          syncStatus={syncStatus}
          hideCompleted={hideCompleted}
          onToggleHideCompleted={() => setHideCompleted(!hideCompleted)}
          activePlaylistName={activePlaylist?.name}
        />

        {!hasPlaylists ? (
          // ── Empty state ──
          <EmptyState onAddPlaylist={() => setIsModalOpen(true)} />
        ) : (
          // ── Main layout ──
          <div className="main-grid">
            <StatsSidebar
              data={data}
              videos={videos}
              stats={stats}
              chartData={chartData}
              sessionCount={sessionCount}
              onPomodoroStateChange={handlePomodoroStateChange}
              playlists={data.playlists}
              activePlaylistId={data.activePlaylistId}
              onSwitchPlaylist={handleSwitchPlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onAddPlaylist={() => setIsModalOpen(true)}
              onRenamePlaylist={handleRenamePlaylist}
            />

            <motion.div
              className="flex flex-col"
              style={{ gap: '0.75rem', width: '100%', minWidth: 0 }}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {videosLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ height: 70, borderRadius: 20, background: 'var(--bg-surface-2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : (
                <>
                  {filteredVideos.map((video, index) => {
                    const originalIndex = videos.findIndex(v => v.id === video.id);
                    return (
                      <VideoCard
                        key={video.id}
                        video={video}
                        index={originalIndex}
                        task={activeTasks[video.id]}
                        isExpanded={expandedVideoId === video.id}
                        onToggleExpand={handleToggleExpand}
                        onSubtaskToggle={handleSubtaskToggle}
                        onAddSubtask={handleAddSubtask}
                        onDeleteSubtask={handleDeleteSubtask}
                        defaultSubtasks={DEFAULT_SUBTASKS}
                        icons={DEFAULT_ICONS}
                        parseISODuration={parseISODuration}
                      />
                    );
                  })}
                  {filteredVideos.length === 0 && !videosLoading && videos.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-surface-2)', borderRadius: 20, border: '1px dashed var(--border-color)' }}
                    >
                      <Zap style={{ width: 40, height: 40, color: 'var(--accent-primary)', margin: '0 auto 1rem', opacity: 0.5 }} />
                      <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.125rem' }}>All Modules Completed!</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Disable &ldquo;Hide Done&rdquo; to see all modules.</p>
                    </motion.div>
                  )}
                  {videos.length === 0 && !videosLoading && activePlaylist && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ textAlign: 'center', padding: '4rem 2rem', background: 'var(--bg-surface-2)', borderRadius: 20, border: '1px dashed var(--border-color)' }}
                    >
                      <Zap style={{ width: 40, height: 40, color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.4 }} />
                      <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.125rem' }}>No videos found</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>The playlist may be private or empty.</p>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          </div>
        )}
      </main>

      {/* Add Playlist Modal */}
      <AddPlaylistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddPlaylist}
      />

      {/* Scroll to top */}
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

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </>
  );
}
