import { FontProject } from '../types';

const DB_NAME = 'FontStudioIndexedDB_v1';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_AUTOSAVE = 'autosave_history';

export interface IndexedDBAutoSaveEntry {
  id: string;
  timestamp: number;
  projectName: string;
  glyphCount: number;
  project: FontProject;
}

/**
 * Open or upgrade the IndexedDB database
 */
export function openFontStudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Primary project store
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }

      // Autosave history rolling snapshots store
      if (!db.objectStoreNames.contains(STORE_AUTOSAVE)) {
        const autoStore = db.createObjectStore(STORE_AUTOSAVE, { keyPath: 'id' });
        autoStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };
  });
}

/**
 * Save active FontProject to IndexedDB asynchronously
 */
export async function saveProjectToIndexedDB(project: FontProject): Promise<boolean> {
  try {
    const db = await openFontStudioDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PROJECTS, STORE_AUTOSAVE], 'readwrite');
      const projectStore = tx.objectStore(STORE_PROJECTS);
      const autoStore = tx.objectStore(STORE_AUTOSAVE);

      const now = Date.now();
      const glyphCount = Object.keys(project.glyphs || {}).length;

      // 1. Put primary current project
      projectStore.put({
        id: 'active_project',
        updatedAt: now,
        project,
      });

      // 2. Put rolling autosave entry
      const autoEntry: IndexedDBAutoSaveEntry = {
        id: `auto_${now}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        projectName: project.name || project.metadata.familyName || '無題フォント',
        glyphCount,
        project,
      };

      autoStore.put(autoEntry);

      tx.oncomplete = () => {
        // Keep only last 15 rolling autosave entries to prevent infinite growth
        cleanupOldAutosaves(db, 15);
        resolve(true);
      };

      tx.onerror = () => {
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('IndexedDB auto-save failed:', err);
    return false;
  }
}

/**
 * Load active FontProject from IndexedDB
 */
export async function loadProjectFromIndexedDB(): Promise<{ project: FontProject; updatedAt: number } | null> {
  try {
    const db = await openFontStudioDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const request = store.get('active_project');

      request.onsuccess = () => {
        if (request.result && request.result.project) {
          resolve({
            project: request.result.project as FontProject,
            updatedAt: request.result.updatedAt || Date.now(),
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('Failed to read from IndexedDB:', err);
    return null;
  }
}

/**
 * List rolling autosave history entries from IndexedDB
 */
export async function listAutosaveHistoryFromIndexedDB(): Promise<IndexedDBAutoSaveEntry[]> {
  try {
    const db = await openFontStudioDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_AUTOSAVE, 'readonly');
      const store = tx.objectStore(STORE_AUTOSAVE);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onsuccess = () => {
        const results: IndexedDBAutoSaveEntry[] = request.result || [];
        // Sort descending by timestamp
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('Failed to list IndexedDB autosave history:', err);
    return [];
  }
}

/**
 * Load specific autosave snapshot from IndexedDB
 */
export async function loadAutosaveEntryFromIndexedDB(id: string): Promise<FontProject | null> {
  try {
    const db = await openFontStudioDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_AUTOSAVE, 'readonly');
      const store = tx.objectStore(STORE_AUTOSAVE);
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result && request.result.project) {
          resolve(request.result.project as FontProject);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('Failed to load entry from IndexedDB:', err);
    return null;
  }
}

/**
 * Cleanup old rolling autosaves exceeding maxCount
 */
async function cleanupOldAutosaves(db: IDBDatabase, maxCount: number = 15): Promise<void> {
  try {
    const tx = db.transaction(STORE_AUTOSAVE, 'readwrite');
    const store = tx.objectStore(STORE_AUTOSAVE);
    const index = store.index('timestamp');
    const request = index.getAll();

    request.onsuccess = () => {
      const entries: IndexedDBAutoSaveEntry[] = request.result || [];
      if (entries.length > maxCount) {
        entries.sort((a, b) => b.timestamp - a.timestamp);
        const toDelete = entries.slice(maxCount);
        for (const entry of toDelete) {
          store.delete(entry.id);
        }
      }
    };
  } catch (err) {
    console.warn('Error during IndexedDB autosave cleanup:', err);
  }
}

/**
 * Clear all IndexedDB project and autosave data
 */
export async function clearIndexedDBStorage(): Promise<boolean> {
  try {
    const db = await openFontStudioDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_PROJECTS, STORE_AUTOSAVE], 'readwrite');
      tx.objectStore(STORE_PROJECTS).clear();
      tx.objectStore(STORE_AUTOSAVE).clear();

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn('Failed to clear IndexedDB:', err);
    return false;
  }
}
