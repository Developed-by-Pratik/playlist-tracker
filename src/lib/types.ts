export interface Video {
  id: string; // The YouTube video ID
  title: string;
  thumbnailUrl: string;
  publishedAt: string;
  duration?: string; // ISO 8601 duration
}

export interface SubTask {
  id: string;
  label: string;
  completed: boolean;
}

export interface TaskRecord {
  videoId: string;
  subtasks: SubTask[];
  completedAt?: string; // ISO date string if all subtasks are completed
}

export interface PlaylistRecord {
  id: string;                        // local UUID
  name: string;                      // user-defined display name
  youtubePlaylistId: string;         // raw PL... ID
  addedAt: string;                   // ISO timestamp
  tasks: Record<string, TaskRecord>; // videoId → TaskRecord (isolated per playlist)
}

export interface UserSettings {
  youtubeApiKey: string; // kept for compat, unused (server key handles all fetches)
}

export interface AppData {
  settings: UserSettings;
  playlists: Record<string, PlaylistRecord>; // playlistId → PlaylistRecord
  activePlaylistId: string | null;
  tasks?: Record<string, TaskRecord>; // LEGACY — only present during migration
  updatedAt?: string; // ISO timestamp of last change
}
