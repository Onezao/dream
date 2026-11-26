/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

const DB_NAME = 'dream_pwa_l3_db';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;
const STORAGE_PREFIX = 'dream_l3_';

interface CacheEnvelope<T> {
  data: T;
  cachedAt: number;
}

export function buildL3PartitionKey(
  accountId: string | undefined | null,
  roleScope: string,
  storeKey: string
): string {
  const safeAccount = accountId?.trim() || 'anon';
  return `${safeAccount}::${roleScope}::${storeKey}`;
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
 * 写入 L3 IndexedDB 分区快照 ([accountId, roleScope, storeKey])
 */
export async function setPartitionedL3Snapshot<T>(
  accountId: string | undefined | null,
  roleScope: string,
  storeKey: string,
  data: T
): Promise<void> {
  return setL3Snapshot(buildL3PartitionKey(accountId, roleScope, storeKey), data);
}

/**
 * 读取 L3 IndexedDB 分区快照 ([accountId, roleScope, storeKey])
 */
export async function getPartitionedL3Snapshot<T>(
  accountId: string | undefined | null,
  roleScope: string,
  storeKey: string
): Promise<T | null> {
  return getL3Snapshot<T>(buildL3PartitionKey(accountId, roleScope, storeKey));
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
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(envelope));
      }
    } catch {
      // ignore storage errors
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
      if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
        return null;
      }
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
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

/**
 * 清空指定账号名下的全部 L3 分区缓存（用于退出登录或账号切换隔离）
 */
export async function clearAccountL3Snapshots(accountId?: string | null): Promise<void> {
  const targetPrefix = accountId ? `${accountId}::` : '';
  if (!targetPrefix) {
    return clearL3Snapshots();
  }

  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.key === 'function') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${STORAGE_PREFIX}${targetPrefix}`)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore storage access errors
  }

  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const allKeys = req.result || [];
        for (const rawKey of allKeys) {
          if (typeof rawKey === 'string' && rawKey.startsWith(targetPrefix)) {
            store.delete(rawKey);
          }
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * 清空 L3 非认证本地业务缓存（严禁删除登录凭据 L2 与语言设置 dream_locale）
 */
export async function clearL3Snapshots(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.key === 'function') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore storage access errors
  }

  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
