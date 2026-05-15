"use server";

import { Video } from './types';

const PLAYLIST_ID = 'PLQEaRBV9gAFsR15tNo2QLF9d2qc-c018p'; // 100xDevs or specified playlist

export const fetchPlaylistVideos = async (): Promise<Video[]> => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];
  
  let allVideos: Video[] = [];
  let nextPageToken = '';
  
  try {
    do {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${PLAYLIST_ID}&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch playlist');
      }
      
      const data = await response.json();
      
      const videos: Video[] = data.items.map((item: { 
        snippet: { 
          resourceId: { videoId: string }; 
          title: string; 
          thumbnails?: { medium?: { url: string }; default?: { url: string } }; 
          publishedAt: string; 
        } 
      }) => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        publishedAt: item.snippet.publishedAt,
      }));
      
      allVideos = [...allVideos, ...videos];
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);
    
    // Filter out deleted/private videos which usually have title 'Private video' or 'Deleted video'
    return allVideos.filter(v => v.title !== 'Private video' && v.title !== 'Deleted video');
  } catch (error) {
    console.error('Error fetching YouTube playlist:', error);
    throw error;
  }
};
