import { CustomPart } from '../types';

const DB_NAME = 'FontEditorPartsDB';
const DB_VERSION = 1;
const STORE_NAME = 'custom_parts';
export const LOCAL_STORAGE_KEY = 'font_editor_custom_parts_v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Optimize / compact custom parts contours (round node coordinates to 2 decimal places)
 * to drastically reduce memory footprint and payload size.
 */
export function compactCustomParts(parts: CustomPart[]): CustomPart[] {
  if (!parts) return [];
  return parts.map((p) => ({
    ...p,
    contours: (p.contours || []).map((c) => ({
      ...c,
      nodes: (c.nodes || []).map((n) => ({
        ...n,
        x: Math.round(n.x * 100) / 100,
        y: Math.round(n.y * 100) / 100,
        handleIn: n.handleIn
          ? {
              x: Math.round(n.handleIn.x * 100) / 100,
              y: Math.round(n.handleIn.y * 100) / 100,
            }
          : null,
        handleOut: n.handleOut
          ? {
              x: Math.round(n.handleOut.x * 100) / 100,
              y: Math.round(n.handleOut.y * 100) / 100,
            }
          : null,
      })),
    })),
  }));
}

/**
 * Load custom parts from IndexedDB with fallback & automatic migration from localStorage
 */
export async function loadCustomParts(): Promise<CustomPart[]> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const parts = await new Promise<CustomPart[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as CustomPart[]);
      req.onerror = () => reject(req.error);
    });

    if (parts && parts.length > 0) {
      return parts.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    }
  } catch (err) {
    console.warn('Failed to load from IndexedDB, trying localStorage fallback:', err);
  }

  // Fallback & automatic migration from localStorage
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed: CustomPart[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Save to IndexedDB asynchronously
        saveCustomParts(parsed).then(() => {
          try {
            // Remove from localStorage to clear quota
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          } catch {
            // ignore
          }
        });
        return parsed;
      }
    }
  } catch (e) {
    console.error('LocalStorage load error:', e);
  }

  return [];
}

/**
 * Save custom parts asynchronously to IndexedDB (bypasses 5MB localStorage limit)
 */
export async function saveCustomParts(parts: CustomPart[]): Promise<boolean> {
  const compacted = compactCustomParts(parts);

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Clear existing records and write fresh list
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    for (const item of compacted) {
      store.put(item);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return true;
  } catch (err) {
    console.error('Failed to save to IndexedDB:', err);

    // Emergency fallback to localStorage with sliced records if IDB fails
    try {
      const json = JSON.stringify(compacted.slice(0, 10));
      localStorage.setItem(LOCAL_STORAGE_KEY, json);
    } catch {
      // ignore quota error
    }
    return false;
  }
}
