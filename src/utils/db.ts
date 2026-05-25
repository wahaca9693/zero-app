import { Video, DownloadedItem } from '../types';

const DB_NAME = 'youtube_downloader_db';
const DB_VERSION = 1;
const STORE_DOWNLOADS = 'downloads';
const STORE_UPLOADS = 'uploads';
const STORE_HISTORY = 'history';
const STORE_LIKES = 'likes';
const STORE_SUBSCRIPTIONS = 'subscriptions';
const STORE_SAVED = 'saved';

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);

    request.onerror = () => {
      console.error('Database failed to open');
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) {
        db.createObjectStore(STORE_DOWNLOADS, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORE_UPLOADS)) {
        db.createObjectStore(STORE_UPLOADS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_LIKES)) {
        db.createObjectStore(STORE_LIKES, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_SUBSCRIPTIONS)) {
        db.createObjectStore(STORE_SUBSCRIPTIONS, { keyPath: 'channelName' });
      }

      if (!db.objectStoreNames.contains(STORE_SAVED)) {
        db.createObjectStore(STORE_SAVED, { keyPath: 'id' });
      }
    };
  });
}

// Downloads operations
export async function saveDownload(item: DownloadedItem): Promise<void> {
  if (item.status === 'completed' && item.blob) {
    // If it is completed, make sure the blob size matches / is set
  }
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_DOWNLOADS, 'readwrite');
    const store = transaction.objectStore(STORE_DOWNLOADS);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDownload(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_DOWNLOADS, 'readwrite');
    const store = transaction.objectStore(STORE_DOWNLOADS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getDownloads(): Promise<DownloadedItem[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_DOWNLOADS, 'readonly');
    const store = transaction.objectStore(STORE_DOWNLOADS);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = request.result || [];
      // Regenerate blob URLs for completed downloads so that they can be played back
      const itemsWithUrls = items.map(item => {
        if (item.blob) {
          try {
            item.blobUrl = URL.createObjectURL(item.blob);
          } catch (e) {
            console.error('Failed to create Object URL for video', item.id, e);
          }
        }
        return item;
      });
      resolve(itemsWithUrls);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getDownload(id: string): Promise<DownloadedItem | null> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_DOWNLOADS, 'readonly');
    const store = transaction.objectStore(STORE_DOWNLOADS);
    const request = store.get(id);

    request.onsuccess = () => {
      const item = request.result;
      if (item && item.blob) {
        item.blobUrl = URL.createObjectURL(item.blob);
      }
      resolve(item || null);
    };
    request.onerror = () => reject(request.error);
  });
}

// Uploaded videos operations
export async function saveUpload(video: Video): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_UPLOADS, 'readwrite');
    const store = transaction.objectStore(STORE_UPLOADS);
    const request = store.put(video);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getUploads(): Promise<Video[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_UPLOADS, 'readonly');
    const store = transaction.objectStore(STORE_UPLOADS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// History operations
export async function addToHistory(videoId: string, timestamp: Date = new Date()): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_HISTORY, 'readwrite');
    const store = transaction.objectStore(STORE_HISTORY);
    const request = store.put({ id: videoId, watchedAt: timestamp });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getHistory(): Promise<{ id: string; watchedAt: Date }[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_HISTORY, 'readonly');
    const store = transaction.objectStore(STORE_HISTORY);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function clearHistory(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_HISTORY, 'readwrite');
    const store = transaction.objectStore(STORE_HISTORY);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Likes operations
export async function toggleLike(videoId: string): Promise<boolean> {
  const db = await initDB();
  const liked = await isLiked(videoId);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_LIKES, 'readwrite');
    const store = transaction.objectStore(STORE_LIKES);
    
    let request;
    if (liked) {
      request = store.delete(videoId);
    } else {
      request = store.put({ id: videoId, likedAt: new Date() });
    }

    request.onsuccess = () => resolve(!liked);
    request.onerror = () => reject(request.error);
  });
}

export async function isLiked(videoId: string): Promise<boolean> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_LIKES, 'readonly');
    const store = transaction.objectStore(STORE_LIKES);
    const request = store.get(videoId);

    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getLikedVideos(): Promise<string[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_LIKES, 'readonly');
    const store = transaction.objectStore(STORE_LIKES);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.map(r => r.id));
    };
    request.onerror = () => reject(request.error);
  });
}

// Subscriptions operations
export async function toggleSubscription(channelName: string): Promise<boolean> {
  const db = await initDB();
  const subscribed = await isSubscribed(channelName);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SUBSCRIPTIONS, 'readwrite');
    const store = transaction.objectStore(STORE_SUBSCRIPTIONS);
    
    let request;
    if (subscribed) {
      request = store.delete(channelName);
    } else {
      request = store.put({ channelName, subscribedAt: new Date() });
    }

    request.onsuccess = () => resolve(!subscribed);
    request.onerror = () => reject(request.error);
  });
}

export async function isSubscribed(channelName: string): Promise<boolean> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SUBSCRIPTIONS, 'readonly');
    const store = transaction.objectStore(STORE_SUBSCRIPTIONS);
    const request = store.get(channelName);

    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getSubscriptions(): Promise<string[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SUBSCRIPTIONS, 'readonly');
    const store = transaction.objectStore(STORE_SUBSCRIPTIONS);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.map(r => r.channelName));
    };
    request.onerror = () => reject(request.error);
  });
}

// Saved operations
export async function toggleSave(videoId: string): Promise<boolean> {
  const db = await initDB();
  const saved = await isSaved(videoId);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SAVED, 'readwrite');
    const store = transaction.objectStore(STORE_SAVED);
    
    let request;
    if (saved) {
      request = store.delete(videoId);
    } else {
      request = store.put({ id: videoId, savedAt: new Date() });
    }

    request.onsuccess = () => resolve(!saved);
    request.onerror = () => reject(request.error);
  });
}

export async function isSaved(videoId: string): Promise<boolean> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SAVED, 'readonly');
    const store = transaction.objectStore(STORE_SAVED);
    const request = store.get(videoId);

    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getSavedVideos(): Promise<string[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SAVED, 'readonly');
    const store = transaction.objectStore(STORE_SAVED);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.map(r => r.id));
    };
    request.onerror = () => reject(request.error);
  });
}

