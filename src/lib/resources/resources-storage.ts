/**
 * resources-storage.ts — Storage & CRUD helper for Study Resources & Bookmarks
 */

import { AppData, StudyResource } from '@/lib/types';
import { loadData, saveData } from '@/lib/storage';
import { logger } from '@/lib/observability/logger';

export const loadResources = (existingData?: AppData): StudyResource[] => {
  const data = existingData || loadData();
  return data.resources || [];
};

export const addResource = (
  input: Omit<StudyResource, 'id' | 'createdAt'>,
  existingData?: AppData
): { updatedData: AppData; resource: StudyResource } => {
  const data = existingData ? JSON.parse(JSON.stringify(existingData)) : loadData();
  if (!data.resources) {
    data.resources = [];
  }

  // Format and validate URL
  let validUrl = input.url.trim();
  if (validUrl && !validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
    validUrl = `https://${validUrl}`;
  }

  const newResource: StudyResource = {
    id: `resource-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: input.title.trim() || 'Untitled Resource',
    url: validUrl,
    category: input.category || 'general',
    notes: input.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
    addedBy: input.addedBy,
    isShared: input.isShared ?? false,
  };

  data.resources.unshift(newResource);
  saveData(data);

  logger.info('resources', `Added resource: "${newResource.title}"`, {
    id: newResource.id,
    category: newResource.category,
    url: newResource.url,
  });

  return { updatedData: data, resource: newResource };
};

export const updateResource = (
  id: string,
  updates: Partial<Omit<StudyResource, 'id' | 'createdAt'>>,
  existingData?: AppData
): AppData => {
  const data = existingData ? JSON.parse(JSON.stringify(existingData)) : loadData();
  if (!data.resources) return data;

  data.resources = data.resources.map((item: StudyResource) => {
    if (item.id !== id) return item;
    let url = updates.url !== undefined ? updates.url.trim() : item.url;
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return {
      ...item,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : item.title,
      url,
    };
  });

  saveData(data);
  logger.info('resources', `Updated resource ${id}`, { updates });
  return data;
};

export const deleteResource = (id: string, existingData?: AppData): AppData => {
  const data = existingData ? JSON.parse(JSON.stringify(existingData)) : loadData();
  if (!data.resources) return data;

  const item = data.resources.find((r: StudyResource) => r.id === id);
  data.resources = data.resources.filter((r: StudyResource) => r.id !== id);

  saveData(data);
  logger.info('resources', `Deleted resource ${id}`, { title: item?.title });
  return data;
};
