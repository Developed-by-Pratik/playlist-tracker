import { AppData, TaskRecord, SubTask, PlaylistRecord, DailyGoal } from './types';
import { syncToCloud } from './cloud-storage';
import { logger } from '@/lib/observability/logger';

const STORAGE_KEY = 'playlist_tracker_data';

export const defaultSubTasks: SubTask[] = [
  { id: 'watchVideo', label: 'Watch Video', completed: false },
];

const defaultData: AppData = {
  settings: { youtubeApiKey: '' },
  playlists: {},
  activePlaylistId: null,
  userPreferences: {
    theme: 'dark',
    hideCompleted: false,
    sidebarCollapsed: false,
  },
};

export const getLocalDateString = (): string => {
  return new Date().toLocaleDateString('en-CA');
};

export const checkAndRefreshDailyGoals = (data: AppData): AppData => {
  if (!data.dailyGoals) return data;
  const todayStr = getLocalDateString();
  if (data.dailyGoals.lastRefreshedDate !== todayStr) {
    const completedCount = data.dailyGoals.goals.filter(g => g.completed).length;
    if (completedCount > 0) {
      if (!data.dailyGoalsHistory) data.dailyGoalsHistory = {};
      data.dailyGoalsHistory[data.dailyGoals.lastRefreshedDate] = completedCount;
    }
    data.dailyGoals.goals = data.dailyGoals.goals.map(g => ({ ...g, completed: false }));
    data.dailyGoals.lastRefreshedDate = todayStr;
  }
  return data;
};

/** Normalize loaded data structure and refresh daily goals */
function normalizeData(parsed: Partial<AppData>): AppData {
  const data: AppData = {
    settings: parsed.settings || { youtubeApiKey: '' },
    playlists: parsed.playlists || {},
    activePlaylistId: parsed.activePlaylistId ?? null,
    updatedAt: parsed.updatedAt,
    dailyGoalsHistory: parsed.dailyGoalsHistory || {},
    resources: parsed.resources || [],
    collaborationEnabled: parsed.collaborationEnabled ?? false,
    userProfile: parsed.userProfile,
    userPreferences: {
      theme: parsed.userPreferences?.theme || 'dark',
      hideCompleted: parsed.userPreferences?.hideCompleted ?? false,
      sidebarCollapsed: parsed.userPreferences?.sidebarCollapsed ?? false,
    },
    dailyGoals: parsed.dailyGoals || {
      lastRefreshedDate: getLocalDateString(),
      goals: [
        { id: 'code-practice', label: 'Code Practice', completed: false },
        { id: 'community-post', label: 'Community Post Update', completed: false },
        { id: 'naukri-update', label: 'Update Naukri Profile', completed: false },
      ],
    },
  };

  return checkAndRefreshDailyGoals(data);
}

export const loadData = (): AppData => {
  if (typeof window === 'undefined') return defaultData;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return normalizeData(JSON.parse(stored));
    } catch (e) {
      logger.error('storage', 'Failed to parse app data from localStorage', undefined, e);
      return defaultData;
    }
  }
  return defaultData;
};

export const saveData = (data: AppData): void => {
  if (typeof window === 'undefined') return;
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  syncToCloud(data).catch(err => logger.warn('cloud-sync', 'Failed to push sync data to cloud', undefined, err));
};

// ── Playlist CRUD ──────────────────────────────────────────────────────────────

export const addPlaylist = (name: string, youtubePlaylistId: string, videoCount?: number): AppData => {
  const data = loadData();
  const id = crypto.randomUUID();
  const playlist: PlaylistRecord = {
    id,
    name: name.trim(),
    youtubePlaylistId,
    addedAt: new Date().toISOString(),
    tasks: {},
    videoCount,
  };
  data.playlists[id] = playlist;
  if (!data.activePlaylistId) data.activePlaylistId = id;
  saveData(data);
  return data;
};

export const removePlaylist = (playlistId: string): AppData => {
  const data = loadData();
  delete data.playlists[playlistId];
  if (data.activePlaylistId === playlistId) {
    const remaining = Object.keys(data.playlists);
    data.activePlaylistId = remaining.length > 0 ? remaining[0] : null;
  }
  saveData(data);
  return data;
};

export const setActivePlaylist = (playlistId: string): AppData => {
  const data = loadData();
  if (data.playlists[playlistId]) {
    data.activePlaylistId = playlistId;
    saveData(data);
  }
  return data;
};

export const renamePlaylist = (playlistId: string, name: string): AppData => {
  const data = loadData();
  if (data.playlists[playlistId]) {
    data.playlists[playlistId].name = name.trim();
    saveData(data);
  }
  return data;
};

export const updatePlaylistVideoCount = (playlistId: string, count: number): AppData => {
  const data = loadData();
  if (data.playlists[playlistId] && data.playlists[playlistId].videoCount !== count) {
    data.playlists[playlistId].videoCount = count;
    saveData(data);
  }
  return data;
};

// ── Task CRUD (scoped per playlist) ───────────────────────────────────────────

export const updateTask = (
  playlistId: string,
  videoId: string,
  updates: Partial<TaskRecord>,
  existingData?: AppData
): AppData => {
  const data = existingData ? JSON.parse(JSON.stringify(existingData)) : loadData();
  const playlist = data.playlists[playlistId];
  if (!playlist) return data;

  const existing: TaskRecord = playlist.tasks[videoId] || {
    videoId,
    subtasks: [...defaultSubTasks],
  };

  const updatedTask: TaskRecord = { ...existing, ...updates };

  const allCompleted =
    updatedTask.subtasks.length > 0 && updatedTask.subtasks.every(s => s.completed);
  if (allCompleted && !updatedTask.completedAt) {
    updatedTask.completedAt = new Date().toISOString();
  } else if (!allCompleted && updatedTask.completedAt) {
    updatedTask.completedAt = undefined;
  }

  playlist.tasks[videoId] = updatedTask;
  saveData(data);
  return data;
};

export const updateSettings = (apiKey: string): AppData => {
  const data = loadData();
  data.settings.youtubeApiKey = apiKey;
  saveData(data);
  return data;
};

// ── Daily Goals CRUD ──────────────────────────────────────────────────────────

export const toggleDailyGoal = (goalId: string, existingData?: AppData): AppData => {
  let data = existingData ? JSON.parse(JSON.stringify(existingData)) : loadData();
  if (!data.dailyGoals) {
    data.dailyGoals = {
      lastRefreshedDate: getLocalDateString(),
      goals: [
        { id: 'code-practice', label: 'Code Practice', completed: false },
        { id: 'community-post', label: 'Community Post Update', completed: false },
        { id: 'naukri-update', label: 'Update Naukri Profile', completed: false },
      ],
    };
  }

  data = checkAndRefreshDailyGoals(data);

  data.dailyGoals.goals = data.dailyGoals.goals.map((g: DailyGoal) =>
    g.id === goalId ? { ...g, completed: !g.completed } : g
  );

  saveData(data);
  return data;
};

export const addDailyGoal = (label: string, existingData?: AppData): AppData => {
  let data = existingData ? JSON.parse(JSON.stringify(existingData)) : loadData();
  if (!data.dailyGoals) {
    data.dailyGoals = {
      lastRefreshedDate: getLocalDateString(),
      goals: [],
    };
  }

  data = checkAndRefreshDailyGoals(data);

  const newGoal = {
    id: `daily-${Date.now()}`,
    label: label.trim(),
    completed: false,
  };
  data.dailyGoals.goals.push(newGoal);

  saveData(data);
  return data;
};

export const deleteDailyGoal = (goalId: string, existingData?: AppData): AppData => {
  let data = existingData ? JSON.parse(JSON.stringify(existingData)) : loadData();
  if (data.dailyGoals) {
    data = checkAndRefreshDailyGoals(data);
    data.dailyGoals.goals = data.dailyGoals.goals.filter((g: DailyGoal) => g.id !== goalId);
    saveData(data);
  }
  return data;
};

export const resetDailyGoalsCompleted = (existingData?: AppData): AppData => {
  const data = existingData ? JSON.parse(JSON.stringify(existingData)) : loadData();
  if (data.dailyGoals) {
    data.dailyGoals.goals = data.dailyGoals.goals.map((g: DailyGoal) => ({ ...g, completed: false }));
    data.dailyGoals.lastRefreshedDate = getLocalDateString();
    saveData(data);
  }
  return data;
};

export const reorderDailyGoals = (newGoals: DailyGoal[], existingData?: AppData): AppData => {
  const data = existingData ? JSON.parse(JSON.stringify(existingData)) : loadData();
  if (data.dailyGoals) {
    data.dailyGoals.goals = newGoals;
    saveData(data);
  }
  return data;
};

export const reorderPlaylists = (orderedPlaylistIds: string[], existingData?: AppData): AppData => {
  const data = existingData ? JSON.parse(JSON.stringify(existingData)) : loadData();
  if (data.playlists) {
    orderedPlaylistIds.forEach((id, index) => {
      if (data.playlists[id]) {
        data.playlists[id].order = index;
      }
    });
    saveData(data);
  }
  return data;
};

