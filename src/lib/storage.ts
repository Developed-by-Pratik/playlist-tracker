import { AppData, TaskRecord, SubTask } from './types';
import { syncToCloud } from './cloud-storage';

const STORAGE_KEY = 'playlist_tracker_data';

export const defaultSubTasks: SubTask[] = [
  { id: 'watchVideo', label: 'Watch Module', completed: false },
  { id: 'programPractice', label: 'Code Practice', completed: false },
  { id: 'postLinkedIn', label: 'Community Post', completed: false },
  { id: 'updateNaukri', label: 'Profile Update', completed: false },
];

const defaultData: AppData = {
  settings: {
    youtubeApiKey: '',
  },
  tasks: {},
};

/** Apply data migrations (e.g. subtasks object → array) */
function migrateData(parsed: AppData): AppData {
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
  return parsed;
}

export const loadData = (): AppData => {
  if (typeof window === 'undefined') return defaultData;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return migrateData(JSON.parse(stored) as AppData);
    } catch (e) {
      console.error('Failed to parse app data', e);
      return defaultData;
    }
  }
  return defaultData;
};

/**
 * Save to localStorage AND push to Supabase.
 * Cloud sync is fire-and-forget — it never blocks the UI.
 */
export const saveData = (data: AppData): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // Fire-and-forget cloud sync
  syncToCloud(data).catch(err => console.warn('[cloud-sync] write failed:', err));
};

export const updateTask = (
  videoId: string,
  updates: Partial<TaskRecord>
) => {
  const data = loadData();
  const existing = data.tasks[videoId] || {
    videoId,
    subtasks: [...defaultSubTasks],
  };

  const updatedTask = { ...existing, ...updates };

  const allCompleted = updatedTask.subtasks.length > 0 && updatedTask.subtasks.every(s => s.completed);
  if (allCompleted && !updatedTask.completedAt) {
    updatedTask.completedAt = new Date().toISOString();
  } else if (!allCompleted && updatedTask.completedAt) {
    updatedTask.completedAt = undefined;
  }

  data.tasks[videoId] = updatedTask;
  saveData(data);
  return data;
};

export const updateSettings = (apiKey: string) => {
  const data = loadData();
  data.settings.youtubeApiKey = apiKey;
  saveData(data);
  return data;
};
