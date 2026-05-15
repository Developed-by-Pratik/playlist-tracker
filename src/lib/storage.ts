import { AppData, TaskRecord, SubTasks } from './types';

const STORAGE_KEY = 'playlist_tracker_data';

export const defaultSubTasks: SubTasks = {
  watchVideo: false,
  programPractice: false,
  postLinkedIn: false,
  updateNaukri: false,
};

const defaultData: AppData = {
  settings: {
    youtubeApiKey: '',
  },
  tasks: {},
};

export const loadData = (): AppData => {
  if (typeof window === 'undefined') return defaultData;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as AppData;
    } catch (e) {
      console.error('Failed to parse app data', e);
      return defaultData;
    }
  }
  return defaultData;
};

export const saveData = (data: AppData): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const updateTask = (
  videoId: string, 
  updates: Partial<TaskRecord>
) => {
  const data = loadData();
  const existing = data.tasks[videoId] || {
    videoId,
    subtasks: { ...defaultSubTasks },
    diaryNote: '',
  };
  
  const updatedTask = { ...existing, ...updates };
  
  // Check if all subtasks are completed to set completedAt
  const allCompleted = Object.values(updatedTask.subtasks).every(v => v === true);
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
