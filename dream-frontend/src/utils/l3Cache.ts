/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

const DB_NAME = 'dream_pwa_l3_db';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;

interface CacheEnvelope<T> {
  data: T;
  cachedAt: number;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * 写入 L3 IndexedDB 快照
 */
export async function setL3Snapshot<T>(key: string, data: T): Promise<void> {
  const envelope: CacheEnvelope<T> = {
    data,
    cachedAt: Date.now(),
  };

  const db = await openDatabase();
  if (!db) {
    // 降级使用 localStorage
    try {
      localStorage.setItem(`dream_l3_${key}`, JSON.stringify(envelope));
    } catch {
      // ignore
    }
    return;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(envelope, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * 读取 L3 IndexedDB 快照
 */
export async function getL3Snapshot<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db) {
    try {
      const raw = localStorage.getItem(`dream_l3_${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CacheEnvelope<T>;
      return parsed.data ?? null;
    } catch {
      return null;
    }
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        const res = req.result as CacheEnvelope<T> | undefined;
        resolve(res ? res.data : null);
      };

      req.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}
