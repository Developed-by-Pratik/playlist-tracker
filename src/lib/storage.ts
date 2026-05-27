import { AppData, TaskRecord, SubTask, PlaylistRecord, DailyGoal } from './types';
import { syncToCloud } from './cloud-storage';

const STORAGE_KEY = 'playlist_tracker_data';

// Legacy hardcoded playlist ID — only used during one-time migration
const LEGACY_PLAYLIST_ID = 'PLQEaRBV9gAFsR15tNo2QLF9d2qc-c018p';

export const defaultSubTasks: SubTask[] = [
  { id: 'watchVideo', label: 'Watch Video', completed: false },
];

const defaultData: AppData = {
  settings: { youtubeApiKey: '' },
  playlists: {},
  activePlaylistId: null,
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

/** Apply data migrations */
function migrateData(parsed: any): AppData {
  // Step 1: Migrate old subtasks object → array format (pre-playlist era)
  if (parsed.tasks && typeof parsed.tasks === 'object') {
    Object.keys(parsed.tasks).forEach(id => {
      const t = parsed.tasks[id];
      if (t.subtasks && !Array.isArray(t.subtasks)) {
        const old = t.subtasks as any;
        t.subtasks = [
          { id: 'watchVideo', label: 'Watch Module', completed: !!old.watchVideo },
          { id: 'programPractice', label: 'Code Practice', completed: !!old.programPractice },
          { id: 'postLinkedIn', label: 'Community Post', completed: !!old.postLinkedIn },
          { id: 'updateNaukri', label: 'Profile Update', completed: !!old.updateNaukri },
        ];
      }
    });
  }

  // Step 2: Migrate legacy flat `tasks` → wrap into a PlaylistRecord
  if (parsed.tasks && !parsed.playlists) {
    const legacyId = 'legacy';
    const legacyPlaylist: PlaylistRecord = {
      id: legacyId,
      name: 'My Playlist',
      youtubePlaylistId: LEGACY_PLAYLIST_ID,
      addedAt: new Date().toISOString(),
      tasks: parsed.tasks,
    };
    parsed.playlists = { [legacyId]: legacyPlaylist };
    parsed.activePlaylistId = legacyId;
    delete parsed.tasks;
  }

  // Ensure required fields exist
  if (!parsed.playlists) parsed.playlists = {};
  if (!('activePlaylistId' in parsed)) parsed.activePlaylistId = null;

  // Step 3: Filter out legacy daily subtasks from video cards so they only have watchVideo or custom ones!
  if (parsed.playlists && typeof parsed.playlists === 'object') {
    Object.keys(parsed.playlists).forEach(pid => {
      const playlist = parsed.playlists[pid];
      if (playlist && playlist.tasks && typeof playlist.tasks === 'object') {
        Object.keys(playlist.tasks).forEach(vid => {
          const t = playlist.tasks[vid];
          if (t && Array.isArray(t.subtasks)) {
            t.subtasks = t.subtasks.filter((s: any) =>
              s.id !== 'programPractice' &&
              s.id !== 'postLinkedIn' &&
              s.id !== 'updateNaukri'
            );
            // Re-calculate completion
            const allCompleted = t.subtasks.length > 0 && t.subtasks.every((s: any) => s.completed);
            if (allCompleted && !t.completedAt) {
              t.completedAt = new Date().toISOString();
            } else if (!allCompleted && t.completedAt) {
              t.completedAt = undefined;
            }
          }
        });
      }
    });
  }

  // Step 4: Initialize and check/refresh daily goals
  if (!parsed.dailyGoals) {
    parsed.dailyGoals = {
      lastRefreshedDate: getLocalDateString(),
      goals: [
        { id: 'code-practice', label: 'Code Practice', completed: false },
        { id: 'community-post', label: 'Community Post Update', completed: false },
        { id: 'naukri-update', label: 'Update Naukri Profile', completed: false },
      ],
    };
  } else {
    parsed = checkAndRefreshDailyGoals(parsed);
  }

  return parsed as AppData;
}

export const loadData = (): AppData => {
  if (typeof window === 'undefined') return defaultData;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return migrateData(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to parse app data', e);
      return defaultData;
    }
  }
  return defaultData;
};

export const saveData = (data: AppData): void => {
  if (typeof window === 'undefined') return;
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  syncToCloud(data).catch(err => console.warn('[cloud-sync] write failed:', err));
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

  data.dailyGoals.goals = data.dailyGoals.goals.map((g: any) =>
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
    data.dailyGoals.goals = data.dailyGoals.goals.filter((g: any) => g.id !== goalId);
    saveData(data);
  }
  return data;
};

export const resetDailyGoalsCompleted = (existingData?: AppData): AppData => {
  const data = existingData ? JSON.parse(JSON.stringify(existingData)) : loadData();
  if (data.dailyGoals) {
    data.dailyGoals.goals = data.dailyGoals.goals.map((g: any) => ({ ...g, completed: false }));
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
