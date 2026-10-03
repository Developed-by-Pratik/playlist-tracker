"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { 
  loadData, saveData, updateTask, addPlaylist, removePlaylist, 
  setActivePlaylist, updatePlaylistVideoCount, renamePlaylist,
  toggleDailyGoal, addDailyGoal, deleteDailyGoal, resetDailyGoalsCompleted,
  reorderDailyGoals, reorderPlaylists
} from '@/lib/storage';
import { AppData, Video, DailyGoal, StudyResource } from '@/lib/types';
import { 
  PlayCircle, Users, Zap, ChevronUp,
  Calendar, Plus, Trash2, RotateCcw, GripVertical,
  PanelLeftOpen, PanelLeftClose, Bookmark
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

import { StatsSidebar } from '@/components/Sidebar/StatsSidebar';
import { VideoCard } from '@/components/VideoList/VideoCard';
import { SyncHeader } from '@/components/Layout/SyncHeader';
import { SkeletonLoader } from '@/components/Layout/SkeletonLoader';
import { EmptyState } from '@/components/Playlist/EmptyState';
import { AddPlaylistModal } from '@/components/Playlist/AddPlaylistModal';
import { ResourcesHub } from '@/components/Resources/ResourcesHub';
import { addResource, deleteResource } from '@/lib/resources/resources-storage';
import { studyTimeTracker } from '@/lib/study-time/study-time-tracker';
import { CollaborationToggleModal } from '@/components/Collaboration/CollaborationToggleModal';
import { DuoCollaborationHub } from '@/components/Collaboration/DuoCollaborationHub';
import { VoiceStudyDock } from '@/components/Voice/VoiceStudyDock';
import { collaborationService } from '@/lib/collaboration/collaboration-service';
import { duoChatService } from '@/lib/collaboration/chat-service';
import { fireMilestoneBlast } from '@/lib/celebration/confetti';
import { DuoPartnership, PartnerSnapshot } from '@/lib/types/collaboration';

import { loadFromCloud, subscribeToCloudChanges, CloudSyncStatus, mergeData } from '@/lib/cloud-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const DEFAULT_ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
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
  const [data, setData] = useState<AppData | null>(() => {
    if (typeof window !== 'undefined') {
      return loadData();
    }
    return null;
  });
  const [videos, setVideos] = useState<Video[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [collapsingVideoId, setCollapsingVideoId] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() =>
    isSupabaseConfigured() ? 'syncing' : 'unconfigured'
  );
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [studyTimeSeconds, setStudyTimeSeconds] = useState(0);
  const [activeTab, setActiveTab] = useState<'modules' | 'dailyGoals' | 'resources' | 'duoHub'>('modules');
  const [duoSubTab, setDuoSubTab] = useState<'mirror' | 'chat' | 'scratchpad' | 'recap' | 'voice'>('mirror');
  const [partnership, setPartnership] = useState<DuoPartnership | null>(null);
  const [partnerSnapshot, setPartnerSnapshot] = useState<PartnerSnapshot | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [myDisplayName, setMyDisplayName] = useState('Me');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    }
    return false;
  });

  const toggleSidebarCollapsed = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebar_collapsed', String(next));
      }
      return next;
    });
  }, []);

  const isRemoteUpdate = useRef(false);
  const lastPlaylistId = useRef<string | null>(null);

  // Keep a stable ref to data to avoid re-creating callbacks that depend on it
  const dataRef = useRef<AppData | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Initialize active study time tracker with idle detection
  useEffect(() => {
    const cleanupTracker = studyTimeTracker.init();
    const unsubscribe = studyTimeTracker.subscribe(sec => setStudyTimeSeconds(sec));
    return () => {
      unsubscribe();
      cleanupTracker();
    };
  }, []);

  // Initialize Duo Collaboration service (pairing, real-time presence & snapshot sync)
  useEffect(() => {
    collaborationService.init();
    const unsubPartnership = collaborationService.subscribeToPartnership(p => setPartnership(p));
    const unsubSnapshot = collaborationService.subscribeToPartnerSnapshot(s => setPartnerSnapshot(s));
    const unsubUnread = duoChatService.subscribeToUnreadCount(count => setChatUnreadCount(count));

    if (supabase) {
      supabase.auth.getUser().then(({ data: authData }) => {
        if (authData?.user) {
          const name = authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'Me';
          setMyDisplayName(name);
        }
      }).catch(() => {
        // Fallback default
      });
    }

    return () => {
      unsubPartnership();
      unsubSnapshot();
      unsubUnread();
    };
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured()) {
      loadFromCloud()
        .then(cloud => {
          if (cloud) {
            setData(prev => {
              const local = prev || loadData();
              const merged = mergeData(local, cloud);
              localStorage.setItem('playlist_tracker_data', JSON.stringify(merged));
              return merged;
            });
            setSyncStatus('synced');
            setTimeout(() => setSyncStatus('idle'), 2000);
          } else {
            setSyncStatus('idle');
          }
        })
        .catch(() => {
          setSyncStatus('error');
          setTimeout(() => setSyncStatus('idle'), 4000);
        });
    }

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
    if (!playlist) {
      if (lastPlaylistId.current !== null) {
        lastPlaylistId.current = null;
        setVideos([]);
        setYoutubeError(null);
      }
      return;
    }
    if (lastPlaylistId.current === activeId) return; // Already loaded
    lastPlaylistId.current = activeId;

    setVideosLoading(true);
    setExpandedVideoId(null);
    setYoutubeError(null);
    fetch(`/api/youtube?playlistId=${playlist.youtubePlaylistId}`)
      .then(async r => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to fetch playlist videos');
        }
        return r.json();
      })
      .then(resData => {
        const vids = resData && typeof resData === 'object' && 'videos' in resData ? resData.videos : resData;
        if (Array.isArray(vids)) {
          setVideos(vids);
          setYoutubeError(null);
          // If the stored videoCount does not match or is undefined, update it!
          if (playlist.videoCount !== vids.length) {
            const updated = updatePlaylistVideoCount(playlist.id, vids.length);
            setData(updated);
          }
        } else {
          setVideos([]);
          setYoutubeError('The playlist was empty or returned invalid data.');
        }
      })
      .catch((err) => {
        setVideos([]);
        setYoutubeError(err.message || 'Failed to connect to YouTube API. Please verify playlist visibility or backend API configuration.');
      })
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

  const handleToggleHideCompleted = useCallback(() => {
    setHideCompleted(prev => {
      const next = !prev;
      if (next && expandedVideoId) {
        const activeId = dataRef.current?.activePlaylistId;
        if (activeId) {
          const activeTasks = dataRef.current?.playlists[activeId]?.tasks || {};
          if (activeTasks[expandedVideoId]?.completedAt) {
            setExpandedVideoId(null);
          }
        }
      }
      return next;
    });
  }, [expandedVideoId]);

  const handleSubtaskToggle = useCallback((videoId: string, subtaskId: string) => {
    const currentData = dataRef.current;
    if (!currentData?.activePlaylistId) return;
    const activeId = currentData.activePlaylistId;
    const activeTasks = currentData.playlists[activeId]?.tasks || {};
    const currentTask = activeTasks[videoId] || { videoId, subtasks: DEFAULT_SUBTASKS };
    const subtasksToUse = currentTask.subtasks.length > 0 ? currentTask.subtasks : DEFAULT_SUBTASKS;
    const updatedSubtasks = subtasksToUse.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    const willBeCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(s => s.completed);

    if (hideCompleted && willBeCompleted && expandedVideoId === videoId) {
      setExpandedVideoId(null);
      setCollapsingVideoId(videoId);
      setTimeout(() => {
        setCollapsingVideoId(null);
      }, 350);
    }

    const nextData = updateTask(activeId, videoId, { subtasks: updatedSubtasks }, currentData);
    setData(nextData);
  }, [hideCompleted, expandedVideoId]);

  const handleAddSubtask = useCallback((videoId: string, label: string) => {
    if (!label.trim()) return;
    const currentData = dataRef.current;
    if (!currentData?.activePlaylistId) return;
    const activeId = currentData.activePlaylistId;
    const activeTasks = currentData.playlists[activeId]?.tasks || {};
    const currentTask = activeTasks[videoId] || { videoId, subtasks: DEFAULT_SUBTASKS };
    const subtasksToUse = currentTask.subtasks.length > 0 ? currentTask.subtasks : DEFAULT_SUBTASKS;
    const newSubtask = { id: `custom-${Date.now()}`, label, completed: false };
    const nextData = updateTask(activeId, videoId, { subtasks: [...subtasksToUse, newSubtask] }, currentData);
    setData(nextData);
  }, []);

  const handleDeleteSubtask = useCallback((videoId: string, subtaskId: string) => {
    const currentData = dataRef.current;
    if (!currentData?.activePlaylistId) return;
    const activeId = currentData.activePlaylistId;
    const activeTasks = currentData.playlists[activeId]?.tasks || {};
    const currentTask = activeTasks[videoId];
    if (!currentTask) return;
    const updatedSubtasks = currentTask.subtasks.filter(s => s.id !== subtaskId);
    const willBeCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(s => s.completed);

    if (hideCompleted && willBeCompleted && expandedVideoId === videoId) {
      setExpandedVideoId(null);
      setCollapsingVideoId(videoId);
      setTimeout(() => {
        setCollapsingVideoId(null);
      }, 350);
    }

    const nextData = updateTask(activeId, videoId, { subtasks: updatedSubtasks }, currentData);
    setData(nextData);
  }, [hideCompleted, expandedVideoId]);

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
    const currentData = dataRef.current;
    if (!currentData || currentData.activePlaylistId === playlistId) return;
    lastPlaylistId.current = null; // Force video re-fetch
    const updated = setActivePlaylist(playlistId);
    setData({ ...updated });
    setVideos([]);
  }, []);

  const handlePomodoroStateChange = (state: 'focus' | 'break' | 'idle') => {
    if (state === 'break') setSessionCount(prev => prev + 1);
  };

  const handleToggleDailyGoal = useCallback((goalId: string) => {
    const nextData = toggleDailyGoal(goalId, dataRef.current || undefined);
    setData(nextData);
  }, []);

  const handleAddDailyGoal = useCallback((label: string) => {
    if (!label.trim()) return;
    const nextData = addDailyGoal(label, dataRef.current || undefined);
    setData(nextData);
  }, []);

  const handleDeleteDailyGoal = useCallback((goalId: string) => {
    const nextData = deleteDailyGoal(goalId, dataRef.current || undefined);
    setData(nextData);
  }, []);

  const handleResetDailyGoals = useCallback(() => {
    const nextData = resetDailyGoalsCompleted(dataRef.current || undefined);
    setData(nextData);
  }, []);

  const handleReorderDailyGoals = useCallback((newGoals: DailyGoal[]) => {
    const nextData = reorderDailyGoals(newGoals, dataRef.current || undefined);
    setData(nextData);
  }, []);

  const handleReorderPlaylists = useCallback((orderedIds: string[]) => {
    const nextData = reorderPlaylists(orderedIds, dataRef.current || undefined);
    setData(nextData);
  }, []);

  const handleAddResource = useCallback((resourceInput: Omit<StudyResource, 'id' | 'createdAt'>) => {
    const { updatedData } = addResource(resourceInput, dataRef.current || undefined);
    setData({ ...updatedData });
  }, []);

  const handleDeleteResource = useCallback((id: string) => {
    const updatedData = deleteResource(id, dataRef.current || undefined);
    setData({ ...updatedData });
  }, []);

  const handleToggleCollaboration = useCallback((enabled: boolean) => {
    const current = dataRef.current;
    if (!current) return;
    const nextData: AppData = { ...current, collaborationEnabled: enabled };
    saveData(nextData);
    setData(nextData);
    if (!enabled) {
      setActiveTab(prev => (prev === 'duoHub' ? 'modules' : prev));
    }
  }, []);

  const handlePairPartner = useCallback(async (targetCode: string) => {
    let displayName = 'Me';
    let avatarUrl: string | null = null;
    if (supabase) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          displayName = authData.user.user_metadata?.full_name || authData.user.email || 'Me';
          avatarUrl = authData.user.user_metadata?.avatar_url || null;
        }
      } catch {
        // Fallback to defaults
      }
    }
    return collaborationService.pairWithCode(targetCode, { name: displayName, avatar: avatarUrl });
  }, []);

  const handleDisconnectPartner = useCallback(() => {
    collaborationService.disconnectPartner();
  }, []);

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
    const toKey = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
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

    // 1. Incorporate completed daily goals history
    const history = data.dailyGoalsHistory;
    if (history) {
      Object.keys(history).forEach(key => {
        const count = history[key];
        const dateObj = new Date(key + 'T00:00:00'); // enforce local date parsing
        const label = toLabel(dateObj);
        if (!countsByDateKey[key]) countsByDateKey[key] = { label, count: 0 };
        countsByDateKey[key].count += count;
      });
    }

    // 2. Incorporate today's active completed daily goals
    if (data.dailyGoals?.goals) {
      const dailyGoalsDone = data.dailyGoals.goals.filter(g => g.completed).length;
      if (dailyGoalsDone > 0) {
        if (!countsByDateKey[todayKey]) {
          countsByDateKey[todayKey] = { label: toLabel(new Date()), count: 0 };
        }
        countsByDateKey[todayKey].count += dailyGoalsDone;
      }
    }

    if (Object.keys(countsByDateKey).length === 0) return [];
    const sortedKeys = Object.keys(countsByDateKey).sort();
    const result: { date: string; count: number; fullDate: string }[] = [];
    sortedKeys.forEach(key => {
      const entry = countsByDateKey[key];
      if (entry && entry.count > 0) {
        result.push({ date: entry.label, count: entry.count, fullDate: key });
      }
    });
    return result;
  }, [data]);

  const filteredVideos = useMemo(() => {
    if (!hideCompleted) return videos;
    return videos.filter(v => !activeTasks[v.id]?.completedAt || v.id === collapsingVideoId);
  }, [videos, hideCompleted, activeTasks, collapsingVideoId]);

  // Automatically broadcast snapshot to study partner when stats or focus time change
  useEffect(() => {
    if (!data?.collaborationEnabled) return;

    const publishSnapshot = async () => {
      let displayName = myDisplayName || 'Me';
      let avatarUrl: string | null = null;
      if (supabase) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user) {
            displayName = authData.user.user_metadata?.full_name || authData.user.email || 'Me';
            avatarUrl = authData.user.user_metadata?.avatar_url || null;
          }
        } catch {
          // Fallback to default
        }
      }

      const todayTasksDone = Object.values(activeTasks).filter(t => {
        if (!t.completedAt) return false;
        return new Date(t.completedAt).toDateString() === new Date().toDateString();
      }).length;

      collaborationService.publishMySnapshot({
        displayName,
        avatarUrl,
        activePlaylistName: activePlaylist?.name,
        progressPct: stats.progress,
        todayCompleted: todayTasksDone,
        currentStreak: stats.streak,
        todayStudySeconds: studyTimeSeconds,
      });
    };

    publishSnapshot();
  }, [data?.collaborationEnabled, stats.progress, stats.streak, studyTimeSeconds, activePlaylist?.name, activeTasks, myDisplayName]);

  // Milestone Celebration: trigger particle burst on 50% or 100% course completions
  const prevProgressRef = useRef(stats.progress);
  useEffect(() => {
    const prev = prevProgressRef.current;
    const current = stats.progress;
    prevProgressRef.current = current;

    if (prev < 50 && current >= 50) {
      fireMilestoneBlast('fifty_percent');
    } else if (prev < 100 && current === 100 && stats.total > 0) {
      fireMilestoneBlast('course_completed');
    }
  }, [stats.progress, stats.total]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!data) return <SkeletonLoader />;

  const hasPlaylists = Object.keys(data.playlists).length > 0;

  return (
    <>
      <main className="container" style={{ paddingBottom: '6rem' }}>
        <SyncHeader
          loading={videosLoading}
          progress={stats.progress}
          syncStatus={syncStatus}
          hideCompleted={hideCompleted}
          onToggleHideCompleted={handleToggleHideCompleted}
          activePlaylistName={activePlaylist?.name}
          studyTimeSeconds={studyTimeSeconds}
          collaborationEnabled={data?.collaborationEnabled ?? false}
          onOpenModeModal={() => setIsModeModalOpen(true)}
          partnership={partnership}
          partnerSnapshot={partnerSnapshot}
          onOpenDuoHub={() => setActiveTab('duoHub')}
        />

        {!hasPlaylists ? (
          // ── Empty state ──
          <EmptyState onAddPlaylist={() => setIsModalOpen(true)} />
        ) : (
          // ── Main layout ──
          <div className={`main-grid ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
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
              onReorderPlaylists={handleReorderPlaylists}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={toggleSidebarCollapsed}
            />

            <motion.div
              className="flex flex-col"
              style={{ gap: '0.75rem', width: '100%', minWidth: 0 }}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* Header bar with icon-only Sidebar Toggle Button beside Tab Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', flexWrap: 'wrap', width: '100%' }}>
                <button
                  onClick={toggleSidebarCollapsed}
                  title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--border-radius-sm)',
                    background: 'var(--bg-surface-2)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid var(--border-color)',
                    color: isSidebarCollapsed ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: 'var(--shadow-sm)',
                    outline: 'none',
                    flexShrink: 0,
                  }}
                  className="sidebar-toggle-icon-btn"
                >
                  {isSidebarCollapsed ? (
                    <PanelLeftOpen style={{ width: 18, height: 18 }} />
                  ) : (
                    <PanelLeftClose style={{ width: 18, height: 18 }} />
                  )}
                </button>

                {/* Premium Tab Switcher */}
                <div style={{
                  display: 'flex',
                  background: 'var(--bg-surface-2)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: 'var(--border-radius-sm)',
                  padding: '4px',
                  border: '1px solid var(--border-color)',
                  width: 'fit-content',
                  maxWidth: '100%',
                  gap: '4px',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  flexWrap: 'wrap',
                }}>
                  {[
                    { id: 'modules' as const, label: 'Playlist Modules', icon: PlayCircle },
                    { id: 'dailyGoals' as const, label: 'Daily Habits & Goals', icon: Calendar },
                    { id: 'resources' as const, label: 'Resources & Links', icon: Bookmark },
                    ...(data?.collaborationEnabled ? [{ id: 'duoHub' as const, label: 'Duo Buddy 🤝', icon: Users }] : []),
                  ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                          padding: '0.625rem 1.25rem',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          borderRadius: 'calc(var(--border-radius-sm) - 2px)',
                          border: 'none',
                          background: isActive ? 'var(--gradient-accent)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          outline: 'none',
                        }}
                      >
                        <Icon style={{ width: 14, height: 14, opacity: isActive ? 1 : 0.8 }} />
                        <span>{tab.label}</span>
                        {tab.id === 'dailyGoals' && data?.dailyGoals && (
                          <span style={{
                            fontSize: '0.6875rem',
                            fontFamily: 'var(--font-mono)',
                            padding: '1px 6px',
                            borderRadius: '99px',
                            background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-surface-2)',
                            color: isActive ? '#fff' : 'var(--text-muted)',
                            marginLeft: '4px',
                            border: '1px solid ' + (isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-color)'),
                            transition: 'all 0.25s ease',
                          }}>
                            {data.dailyGoals.goals.filter(g => g.completed).length}/{data.dailyGoals.goals.length}
                          </span>
                        )}
                        {tab.id === 'resources' && data?.resources && data.resources.length > 0 && (
                          <span style={{
                            fontSize: '0.6875rem',
                            fontFamily: 'var(--font-mono)',
                            padding: '1px 6px',
                            borderRadius: '99px',
                            background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-surface-2)',
                            color: isActive ? '#fff' : 'var(--text-muted)',
                            marginLeft: '4px',
                            border: '1px solid ' + (isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-color)'),
                            transition: 'all 0.25s ease',
                          }}>
                            {data.resources.length}
                          </span>
                        )}
                        {tab.id === 'duoHub' && (
                          <span style={{
                            fontSize: '0.6875rem',
                            fontFamily: 'var(--font-mono)',
                            padding: '1px 6px',
                            borderRadius: '99px',
                            background: chatUnreadCount > 0 ? '#ef4444' : partnership ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                            color: chatUnreadCount > 0 ? '#fff' : partnership ? '#4ade80' : 'var(--text-muted)',
                            marginLeft: '4px',
                            border: '1px solid ' + (chatUnreadCount > 0 ? '#ef4444' : partnership ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-color)'),
                            transition: 'all 0.25s ease',
                          }}>
                            {chatUnreadCount > 0 ? `${chatUnreadCount} new` : partnership ? 'Active' : 'Pair'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab 1: Modules Container (Kept Mounted for instantaneous switches and video continuation) */}
              <motion.div
                animate={{
                  opacity: activeTab === 'modules' ? 1 : 0,
                  y: activeTab === 'modules' ? 0 : 8,
                }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{
                  display: activeTab === 'modules' ? 'flex' : 'none',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  width: '100%'
                }}
              >
                {videosLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} className="skeleton-shimmer" style={{ height: 70, borderRadius: 20 }} />
                    ))}
                  </div>
                ) : youtubeError ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      padding: '3rem 2rem',
                      background: 'var(--bg-surface-solid)',
                      border: '1px solid rgba(248, 113, 113, 0.15)',
                      borderRadius: 20,
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1rem',
                      boxShadow: 'var(--shadow-md)',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: 'rgba(248, 113, 113, 0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#f87171',
                      boxShadow: '0 0 15px rgba(248, 113, 113, 0.15)'
                    }}>
                      <Zap style={{ width: 22, height: 22 }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>YouTube Connection Issue</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: 0, lineHeight: 1.5 }}>
                        {youtubeError}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredVideos.map((video) => {
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
                  </AnimatePresence>
                )}
              </motion.div>

              {/* Tab 2: Daily Goals Container (Kept Mounted for instantaneous switches and drag tracking stability) */}
              <motion.div
                animate={{
                  opacity: activeTab === 'dailyGoals' ? 1 : 0,
                  y: activeTab === 'dailyGoals' ? 0 : 8,
                }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{
                  display: activeTab === 'dailyGoals' ? 'flex' : 'none',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  width: '100%'
                }}
              >
                {/* Daily Goals Summary Card */}
                <div className="card" style={{
                  padding: '1.5rem',
                  background: 'var(--gradient-card), var(--bg-surface-solid)',
                  border: '1px solid var(--border-color)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>Daily Progress</h2>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {data?.dailyGoals?.goals && data.dailyGoals.goals.length > 0 && data.dailyGoals.goals.every(g => g.completed)
                          ? '🎉 Spectacular! You have completed all your goals today!' 
                          : `Complete your habits and routines. Completed ${data?.dailyGoals?.goals?.filter(g => g.completed).length || 0} of ${data?.dailyGoals?.goals?.length || 0} today.`
                        }
                      </p>
                    </div>
                    {data?.dailyGoals?.goals && data.dailyGoals.goals.length > 0 && (
                      <button 
                        onClick={handleResetDailyGoals}
                        className="btn-outline"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', gap: '4px', height: 'fit-content' }}
                        title="Reset completions manually for today"
                      >
                        <RotateCcw style={{ width: 12, height: 12 }} />
                        <span>Reset</span>
                      </button>
                    )}
                  </div>

                  {data?.dailyGoals?.goals && data.dailyGoals.goals.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        <span>COMPLETION RATE</span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                          {Math.round(((data?.dailyGoals?.goals?.filter(g => g.completed).length || 0) / (data?.dailyGoals?.goals?.length || 1)) * 100)}%
                        </span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--bg-surface-2)', borderRadius: '99px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(((data?.dailyGoals?.goals?.filter(g => g.completed).length || 0) / (data?.dailyGoals?.goals?.length || 1)) * 100)}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          style={{ height: '100%', background: 'var(--gradient-accent)' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No daily goals set up. Add some custom habits below to get started!
                    </p>
                  )}
                </div>

                {/* Checklist Card */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                    <Calendar style={{ width: 16, height: 16, color: 'var(--accent-primary)' }} />
                    <span>Habits Checklist</span>
                  </h3>

                  <Reorder.Group 
                    axis="y" 
                    values={data?.dailyGoals?.goals || []} 
                    onReorder={handleReorderDailyGoals}
                    style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', listStyle: 'none', padding: 0, margin: 0 }}
                  >
                    {(data?.dailyGoals?.goals || []).map((goal) => {
                      return (
                        <Reorder.Item 
                          key={goal.id} 
                          value={goal}
                          className="checklist-item"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.25rem 0.5rem',
                            borderRadius: 'var(--border-radius-xs)',
                            background: goal.completed ? 'rgba(52, 211, 153, 0.03)' : 'var(--bg-surface-solid)',
                            border: '1px solid ' + (goal.completed ? 'rgba(52, 211, 153, 0.1)' : 'var(--border-color)'),
                            transition: 'background 0.25s, border-color 0.25s',
                            userSelect: 'none'
                          }}
                          whileDrag={{ scale: 1.02, boxShadow: 'var(--shadow-md)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '0.5rem' }}>
                            <GripVertical style={{ width: 14, height: 14, color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} />
                            <label className="checkbox-wrapper" style={{ flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={goal.completed}
                                onChange={() => handleToggleDailyGoal(goal.id)}
                              />
                              <span className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                                <span style={{
                                  fontSize: '0.875rem',
                                  textDecoration: goal.completed ? 'line-through' : 'none',
                                  color: goal.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                                  transition: 'color 0.25s, text-decoration 0.25s'
                                }}>
                                  {goal.label}
                                </span>
                              </span>
                            </label>
                          </div>
                          
                          <button 
                            className="delete-btn" 
                            onClick={(e) => { e.stopPropagation(); handleDeleteDailyGoal(goal.id); }}
                            style={{ opacity: 0.4 }}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>

                  {/* Add Daily Goal Input */}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '0.75rem',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '1.25rem'
                  }}>
                    <input 
                      id="new-daily-goal-input"
                      type="text" 
                      placeholder="Add custom daily goal (e.g. Solve 1 Leetcode problem)..." 
                      style={{ flex: 1, fontSize: '0.875rem', padding: '0.625rem 0.875rem' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddDailyGoal(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                    <button 
                      className="btn-primary" 
                      style={{ padding: '0 1.25rem', height: 'auto' }}
                      onClick={() => {
                        const input = document.getElementById('new-daily-goal-input') as HTMLInputElement;
                        if (input) {
                          handleAddDailyGoal(input.value);
                          input.value = '';
                        }
                      }}
                    >
                      <Plus style={{ width: 14, height: 14 }} />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                <div style={{
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '0.5rem'
                }}>
                  <Calendar style={{ width: 12, height: 12, color: 'var(--accent-primary)' }} />
                  <span>Daily goals refresh automatically every day based on local timezone.</span>
                </div>
              </motion.div>

              {/* Tab 3: Resources & Links Hub */}
              <motion.div
                animate={{
                  opacity: activeTab === 'resources' ? 1 : 0,
                  y: activeTab === 'resources' ? 0 : 8,
                }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{
                  display: activeTab === 'resources' ? 'flex' : 'none',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  width: '100%',
                }}
              >
                <ResourcesHub
                  resources={data?.resources || []}
                  onAddResource={handleAddResource}
                  onDeleteResource={handleDeleteResource}
                />
              </motion.div>

              {/* Tab 4: Duo Collaboration Hub */}
              {data?.collaborationEnabled && (
                <motion.div
                  animate={{
                    opacity: activeTab === 'duoHub' ? 1 : 0,
                    y: activeTab === 'duoHub' ? 0 : 8,
                  }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  style={{
                    display: activeTab === 'duoHub' ? 'flex' : 'none',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    width: '100%',
                  }}
                >
                  <DuoCollaborationHub
                    partnership={partnership}
                    partnerSnapshot={partnerSnapshot}
                    onPair={handlePairPartner}
                    onDisconnect={handleDisconnectPartner}
                    myDisplayName={myDisplayName}
                    myStudyTimeSeconds={studyTimeSeconds}
                    initialSubTab={duoSubTab}
                    onSubTabChange={setDuoSubTab}
                    myStats={{
                      progress: stats.progress,
                      completed: stats.completed,
                      streak: stats.streak,
                      activePlaylistName: activePlaylist?.name,
                    }}
                  />
                </motion.div>
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

      {/* Collaboration Mode Toggle Modal */}
      <CollaborationToggleModal
        isOpen={isModeModalOpen}
        onClose={() => setIsModeModalOpen(false)}
        collaborationEnabled={data?.collaborationEnabled ?? false}
        onToggleCollaboration={handleToggleCollaboration}
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

      {/* Persistent Floating Voice Dock */}
      <VoiceStudyDock
        onOpenLounge={() => {
          setActiveTab('duoHub');
          setDuoSubTab('voice');
        }}
      />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </>
  );
}
