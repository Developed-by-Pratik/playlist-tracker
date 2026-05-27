import { type NextRequest } from 'next/server';
import { Video } from '@/lib/types';

export const revalidate = 3600; // Cache per playlist for 1 hour

async function fetchPlaylistVideosRaw(playlistId: string): Promise<Video[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  let allVideos: Video[] = [];
  let nextPageToken = '';

  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to fetch playlist');
    }

    const data = await response.json();

    const videos: Video[] = data.items.map((item: any) => ({
      id: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      thumbnailUrl:
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        '',
      publishedAt: item.snippet.publishedAt,
    }));

    allVideos = [...allVideos, ...videos];
    nextPageToken = data.nextPageToken || '';
  } while (nextPageToken);

  // Filter deleted/private
  const valid = allVideos.filter(
    v => v.title !== 'Private video' && v.title !== 'Deleted video'
  );

  // Fetch durations in batches of 50 in parallel
  const batches: string[] = [];
  for (let i = 0; i < valid.length; i += 50) {
    batches.push(valid.slice(i, i + 50).map(v => v.id).join(','));
  }

  const fetchPromises = batches.map(async (batch) => {
    try {
      const durRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch}&key=${apiKey}`,
        { next: { revalidate: 3600 } }
      );
      return durRes.ok ? durRes.json() : null;
    } catch (e) {
      console.error('Failed to fetch duration batch:', e);
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);
  results.forEach(durData => {
    if (durData?.items) {
      durData.items.forEach((item: any) => {
        const video = valid.find(v => v.id === item.id);
        if (video) video.duration = item.contentDetails.duration;
      });
    }
  });

  return valid;
}

async function fetchPlaylistTitle(playlistId: string): Promise<string> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return '';

  try {
    const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) return '';
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].snippet.title || '';
    }
  } catch (e) {
    console.error('Failed to fetch playlist title', e);
  }
  return '';
}

export async function GET(request: NextRequest) {
  const playlistId = request.nextUrl.searchParams.get('playlistId');

  if (!playlistId || !playlistId.startsWith('PL')) {
    return Response.json(
      { error: 'Missing or invalid playlistId' },
      { status: 400 }
    );
  }

  try {
    const [videos, title] = await Promise.all([
      fetchPlaylistVideosRaw(playlistId),
      fetchPlaylistTitle(playlistId),
    ]);
    return Response.json({ title, videos });
  } catch (err: any) {
    console.error('[youtube route]', err);
    return Response.json(
      { error: err.message || 'Failed to fetch playlist' },
      { status: 500 }
    );
  }
}

