import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontProject } from '../types';
import { createDefaultProject } from '../utils/fontCompiler';
import { DEFAULT_SAMPLE_GLYPHS, isLegacyMockGlyph } from '../data/defaultSampleGlyphs';
import {
  setLastAutoSaveTimestamp,
  LOCAL_STORAGE_PROJECT_KEY,
  saveProjectToIndexedDB,
  loadProjectFromIndexedDB,
} from '../utils/storageManager';

export const LOCAL_STORAGE_KEY = LOCAL_STORAGE_PROJECT_KEY;

interface UseProjectStorageOptions {
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export function useProjectStorage({ onShowToast }: UseProjectStorageOptions) {
  // Main Project State with LocalStorage hydration
  const [project, setProject] = useState<FontProject>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.metadata && parsed.glyphs) {
          // Sanitize glyph structures to ensure arrays are valid
          for (const u of Object.keys(parsed.glyphs)) {
            const g = parsed.glyphs[u];
            if (g) {
              if (!Array.isArray(g.contours)) g.contours = [];
              if (!Array.isArray(g.strokes)) g.strokes = [];
              if (!Array.isArray(g.anchors)) g.anchors = [];
            }
          }

          // Detect legacy/deformed mock sample glyphs and seamlessly upgrade them to authentic outlines
          let upgraded = false;
          const updatedGlyphs = { ...parsed.glyphs };
          for (const u of [65, 12354, 26085]) {
            if (updatedGlyphs[u] && isLegacyMockGlyph(updatedGlyphs[u])) {
              updatedGlyphs[u] = JSON.parse(JSON.stringify(DEFAULT_SAMPLE_GLYPHS[u]));
              upgraded = true;
            }
          }
          if (upgraded) {
            parsed.glyphs = updatedGlyphs;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load project from localStorage:', e);
    }
    return createDefaultProject();
  });

  const projectRef = useRef<FontProject>(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Quota warning throttle ref & timers
  const lastQuotaWarningRef = useRef<number>(0);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const indexedDbSaveInFlightRef = useRef(false);
  const pendingIndexedDbProjectRef = useRef<FontProject | null>(null);

  const saveProjectToIndexedDbWhenIdle = useCallback(async (nextProject: FontProject) => {
    pendingIndexedDbProjectRef.current = nextProject;
    if (indexedDbSaveInFlightRef.current) return;

    indexedDbSaveInFlightRef.current = true;
    try {
      while (pendingIndexedDbProjectRef.current) {
        const projectToSave = pendingIndexedDbProjectRef.current;
        pendingIndexedDbProjectRef.current = null;
        const saved = await saveProjectToIndexedDB(projectToSave);
        if (!saved) {
          console.warn('Background IndexedDB auto-save did not complete.');
        }
      }
    } finally {
      indexedDbSaveInFlightRef.current = false;
    }
  }, []);

  // Seamlessly upgrade any cached legacy sample glyphs on mount and check IndexedDB recovery
  useEffect(() => {
    let upgraded = false;
    const updated = { ...project.glyphs };
    for (const u of [65, 12354, 26085]) {
      if (updated[u] && isLegacyMockGlyph(updated[u])) {
        updated[u] = JSON.parse(JSON.stringify(DEFAULT_SAMPLE_GLYPHS[u]));
        upgraded = true;
      }
    }
    if (upgraded) {
      setProject((prev) => ({ ...prev, glyphs: updated }));
    }

    // Check IndexedDB for a newer auto-saved version
    loadProjectFromIndexedDB()
      .then((dbData) => {
        if (dbData && dbData.project) {
          const localUpdatedAt = projectRef.current?.updatedAt || 0;
          if (dbData.updatedAt > localUpdatedAt + 3000) {
            setProject(dbData.project);
            onShowToast('IndexedDBから最新の自動保存プロジェクトをクラッシュ復元しました', 'success');
          }
        }
      })
      .catch((err) => {
        console.warn('IndexedDB initial recovery check failed:', err);
      });
  }, []);

  // LocalStorage is the synchronous recovery copy; IndexedDB is written in the background.
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      // 1. Write to LocalStorage
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projectRef.current));
        setLastAutoSaveTimestamp(Date.now());
      } catch (e: any) {
        console.warn('Auto-save to localStorage failed:', e);
        const isQuota =
          e?.name === 'QuotaExceededError' ||
          e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          e?.code === 22 ||
          e?.code === 1014;
        if (isQuota && Date.now() - lastQuotaWarningRef.current > 120000) {
          lastQuotaWarningRef.current = Date.now();
          onShowToast(
            'LocalStorage容量上限に達しました。IndexedDBへのバックグラウンド保存を試行しています。',
            'warning'
          );
        }
      }

      void saveProjectToIndexedDbWhenIdle(projectRef.current);
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [project.updatedAt, onShowToast, saveProjectToIndexedDbWhenIdle]);

  // Persist the synchronous recovery copy before leaving
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projectRef.current));
        setLastAutoSaveTimestamp(Date.now());
      } catch (error) {
        console.warn('Final localStorage project save failed:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projectRef.current));
          setLastAutoSaveTimestamp(Date.now());
          void saveProjectToIndexedDbWhenIdle(projectRef.current);
        } catch (error) {
          console.warn('Visibility-change project save failed:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveProjectToIndexedDbWhenIdle]);

  return {
    project,
    setProject,
    projectRef,
    saveProjectToIndexedDbWhenIdle,
  };
}
