export interface Video {
  id: string; // The YouTube video ID
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
}

export interface SubTasks {
  watchVideo: boolean;
  programPractice: boolean;
  postLinkedIn: boolean;
  updateNaukri: boolean;
}

export interface TaskRecord {
  videoId: string;
  subtasks: SubTasks;
  diaryNote: string;
  completedAt?: string; // ISO date string if all subtasks are completed
}

export interface UserSettings {
  youtubeApiKey: string;
}

export interface AppData {
  settings: UserSettings;
  tasks: Record<string, TaskRecord>; // Keyed by videoId
}
