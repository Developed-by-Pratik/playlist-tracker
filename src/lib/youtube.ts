"use server";

import { Video } from './types';
import { unstable_cache } from 'next/cache';

const PLAYLIST_ID = 'PLQEaRBV9gAFsR15tNo2QLF9d2qc-c018p';

const fetchVideosRaw = async (): Promise<Video[]> => {
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
    
    // Filter out deleted/private videos
    const validVideos = allVideos.filter(v => v.title !== 'Private video' && v.title !== 'Deleted video');

    // Fetch durations in batches of 50
    const videoIds = validVideos.map(v => v.id);
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50).join(',');
      const durResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch}&key=${apiKey}`
      );
      if (durResponse.ok) {
        const durData = await durResponse.json();
        durData.items.forEach((item: any) => {
          const video = validVideos.find(v => v.id === item.id);
          if (video) video.duration = item.contentDetails.duration;
        });
      }
    }

    return validVideos;
  } catch (error) {
    console.error('Error fetching YouTube playlist:', error);
    throw error;
  }
};

export const fetchPlaylistVideos = unstable_cache(
  async () => fetchVideosRaw(),
  ['youtube-playlist-videos'],
  { revalidate: 3600, tags: ['youtube'] }
);
