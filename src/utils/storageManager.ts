import { FontProject } from '../types';
export * from './indexedDBStorage';

export const LOCAL_STORAGE_PROJECT_KEY = 'font_editor_project_data_v2';
export const LAST_BACKUP_TIMESTAMP_KEY = 'font_editor_last_backup_timestamp';
export const LAST_AUTOSAVE_TIMESTAMP_KEY = 'font_editor_last_autosave_timestamp';
export const SNAPSHOTS_INDEX_KEY = 'font_editor_snapshots_index_v1';
export const SNAPSHOT_DATA_PREFIX = 'font_editor_snapshot_data_';

// Estimated default localStorage limit across modern browsers (~5MB in UTF-16 bytes / UTF-8 chars)
export const ESTIMATED_LOCAL_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024; // 5 MB

export interface ProjectBackupSnapshot {
  id: string;
  name: string;
  familyName: string;
  timestamp: number;
  formattedDate: string;
  glyphCount: number;
  sizeBytes: number;
  type: 'manual' | 'auto';
  label?: string;
}

export interface StorageItemDetail {
  key: string;
  label: string;
  sizeBytes: number;
  category: 'project' | 'snapshots' | 'parts' | 'presets' | 'settings' | 'other';
  removable?: boolean;
}

export interface StorageUsageBreakdown {
  totalUsedBytes: number;
  estimatedLimitBytes: number;
  usedPercentage: number;
  projectBytes: number;
  snapshotsBytes: number;
  customPartsBytes: number;
  presetsBytes: number;
  settingsBytes: number;
  otherBytes: number;
  items: StorageItemDetail[];
  status: 'safe' | 'warning' | 'critical'; // < 65% safe, 65-85% warning, > 85% critical
}

export interface BackupStatusInfo {
  lastBackupTimestamp: number | null;
  lastAutoSaveTimestamp: number | null;
  lastSnapshotTimestamp: number | null;
  snapshotsCount: number;
  totalSnapshotsBytes: number;
  isBackupRecommended: boolean; // if no backup in > 3 days or storage > 70%
}

/**
 * Format bytes into human readable string (KB, MB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(dm))} ${sizes[safeI]}`;
}

/**
 * Format timestamp into standard Japanese readable date/time
 */
export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp || isNaN(timestamp)) return '未記録';
  const d = new Date(timestamp);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}/${m}/${day} ${h}:${min}:${s}`;
}

/**
 * Format timestamp into relative elapsed time
 */
export function formatRelativeTime(timestamp: number | null | undefined): string {
  if (!timestamp || isNaN(timestamp)) return '未実行';
  const now = Date.now();
  const diffMs = now - timestamp;
  if (diffMs < 0) return 'たった今';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}秒前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}日前`;
  return formatDateTime(timestamp).split(' ')[0];
}

/**
 * Calculate size in bytes of a string in localStorage
 */
function getStringSizeBytes(str: string): number {
  return new Blob([str]).size;
}

/**
 * Calculate full storage breakdown of localStorage
 */
export function getStorageUsageBreakdown(): StorageUsageBreakdown {
  let totalUsedBytes = 0;
  let projectBytes = 0;
  let snapshotsBytes = 0;
  let customPartsBytes = 0;
  let presetsBytes = 0;
  let settingsBytes = 0;
  let otherBytes = 0;
  const items: StorageItemDetail[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) || '';
      const sizeBytes = getStringSizeBytes(key) + getStringSizeBytes(value);
      totalUsedBytes += sizeBytes;

      let category: StorageItemDetail['category'] = 'other';
      let label = key;
      let removable = false;

      if (key === LOCAL_STORAGE_PROJECT_KEY) {
        category = 'project';
        label = '現在の作業中フォントデータ';
        projectBytes += sizeBytes;
      } else if (key.startsWith(SNAPSHOT_DATA_PREFIX) || key === SNAPSHOTS_INDEX_KEY) {
        category = 'snapshots';
        label = key === SNAPSHOTS_INDEX_KEY ? 'スナップショット目録' : `スナップショット (${key.replace(SNAPSHOT_DATA_PREFIX, '')})`;
        snapshotsBytes += sizeBytes;
        removable = true;
      } else if (key.includes('custom_parts') || key.includes('Radical')) {
        category = 'parts';
        label = '部首・カスタムパーツライブラリ';
        customPartsBytes += sizeBytes;
        removable = true;
      } else if (key.includes('preset') || key.includes('brush')) {
        category = 'presets';
        label = 'カスタムペン・ブラシ設定';
        presetsBytes += sizeBytes;
        removable = true;
      } else if (key.includes('theme') || key.includes('guide') || key.includes('width') || key.includes('overlay')) {
        category = 'settings';
        label = 'エディタ設定・UI環境設定';
        settingsBytes += sizeBytes;
        removable = true;
      } else {
        category = 'other';
        label = `その他キャッシュ (${key})`;
        otherBytes += sizeBytes;
        removable = true;
      }

      items.push({
        key,
        label,
        sizeBytes,
        category,
        removable,
      });
    }
  } catch (err) {
    console.warn('Error computing storage breakdown:', err);
  }

  // Sort items by size descending
  items.sort((a, b) => b.sizeBytes - a.sizeBytes);

  const usedPercentage = Math.min(100, Math.max(0, (totalUsedBytes / ESTIMATED_LOCAL_STORAGE_LIMIT_BYTES) * 100));

  let status: StorageUsageBreakdown['status'] = 'safe';
  if (usedPercentage >= 85) {
    status = 'critical';
  } else if (usedPercentage >= 65) {
    status = 'warning';
  }

  return {
    totalUsedBytes,
    estimatedLimitBytes: ESTIMATED_LOCAL_STORAGE_LIMIT_BYTES,
    usedPercentage,
    projectBytes,
    snapshotsBytes,
    customPartsBytes,
    presetsBytes,
    settingsBytes,
    otherBytes,
    items,
    status,
  };
}

/**
 * Get last successful backup export timestamp
 */
export function getLastBackupTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_TIMESTAMP_KEY);
    if (raw) {
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  } catch (error) {
    console.warn('Failed to read last backup timestamp:', error);
  }
  return null;
}

/**
 * Set last successful backup export timestamp
 */
export function setLastBackupTimestamp(timestamp: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_BACKUP_TIMESTAMP_KEY, String(timestamp));
    window.dispatchEvent(new Event('storage'));
  } catch (error) {
    console.warn('Failed to persist last backup timestamp:', error);
  }
}

/**
 * Get last autosave timestamp
 */
export function getLastAutoSaveTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(LAST_AUTOSAVE_TIMESTAMP_KEY);
    if (raw) {
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  } catch (error) {
    console.warn('Failed to read last autosave timestamp:', error);
  }
  return null;
}

/**
 * Set last autosave timestamp
 */
export function setLastAutoSaveTimestamp(timestamp: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_AUTOSAVE_TIMESTAMP_KEY, String(timestamp));
  } catch (error) {
    console.warn('Failed to persist last autosave timestamp:', error);
  }
}

/**
 * Get overall backup status and health recommendation
 */
export function getBackupStatusInfo(): BackupStatusInfo {
  const lastBackupTimestamp = getLastBackupTimestamp();
  const lastAutoSaveTimestamp = getLastAutoSaveTimestamp();
  const snapshots = listSnapshots();

  const lastSnapshotTimestamp = snapshots.length > 0 ? Math.max(...snapshots.map((s) => s.timestamp)) : null;
  const totalSnapshotsBytes = snapshots.reduce((acc, s) => acc + s.sizeBytes, 0);

  const breakdown = getStorageUsageBreakdown();

  const isOldBackup = !lastBackupTimestamp || Date.now() - lastBackupTimestamp > 3 * 24 * 60 * 60 * 1000;
  const isBackupRecommended = isOldBackup || breakdown.status !== 'safe';

  return {
    lastBackupTimestamp,
    lastAutoSaveTimestamp,
    lastSnapshotTimestamp,
    snapshotsCount: snapshots.length,
    totalSnapshotsBytes,
    isBackupRecommended,
  };
}

/**
 * List all saved local snapshots
 */
export function listSnapshots(): ProjectBackupSnapshot[] {
  try {
    const rawIndex = localStorage.getItem(SNAPSHOTS_INDEX_KEY);
    if (!rawIndex) return [];
    const index: ProjectBackupSnapshot[] = JSON.parse(rawIndex);
    if (!Array.isArray(index)) return [];

    // Filter to ensure only snapshots with existing data are listed
    return index
      .filter((s) => {
        const dataKey = `${SNAPSHOT_DATA_PREFIX}${s.id}`;
        return !!localStorage.getItem(dataKey);
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.warn('Failed to load snapshots index:', err);
    return [];
  }
}

/**
 * Save index of snapshots
 */
function saveSnapshotsIndex(snapshots: ProjectBackupSnapshot[]): void {
  try {
    localStorage.setItem(SNAPSHOTS_INDEX_KEY, JSON.stringify(snapshots));
  } catch (err) {
    console.warn('Failed to save snapshots index:', err);
  }
}

/**
 * Create a new local backup snapshot from project
 */
export function createLocalSnapshot(
  project: FontProject,
  type: 'manual' | 'auto' = 'manual',
  label?: string
): { success: boolean; error?: string; snapshot?: ProjectBackupSnapshot } {
  try {
    const now = Date.now();
    const id = `snap_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const familyName = project.metadata.familyName || project.name || '手書きフォント';
    const glyphCount = Object.keys(project.glyphs || {}).length;
    const jsonStr = JSON.stringify(project);
    const sizeBytes = getStringSizeBytes(jsonStr);

    const snapshot: ProjectBackupSnapshot = {
      id,
      name: project.name || familyName,
      familyName,
      timestamp: now,
      formattedDate: formatDateTime(now),
      glyphCount,
      sizeBytes,
      type,
      label: label || (type === 'manual' ? '手動スナップショット' : '自動定期スナップショット'),
    };

    const dataKey = `${SNAPSHOT_DATA_PREFIX}${id}`;
    localStorage.setItem(dataKey, jsonStr);

    const currentList = listSnapshots();
    const updatedList = [snapshot, ...currentList.filter((s) => s.id !== id)];
    saveSnapshotsIndex(updatedList);

    window.dispatchEvent(new Event('storage'));
    return { success: true, snapshot };
  } catch (err: any) {
    console.error('Failed to create snapshot:', err);
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014;
    return {
      success: false,
      error: isQuota
        ? 'ブラウザの容量上限に達したため保存できませんでした。古いバックアップを削除するか、JSONファイルを直接ダウンロードしてください。'
        : 'スナップショットの作成に失敗しました。',
    };
  }
}

/**
 * Load project data from snapshot
 */
export function loadProjectFromSnapshot(snapshotId: string): FontProject | null {
  try {
    const dataKey = `${SNAPSHOT_DATA_PREFIX}${snapshotId}`;
    const raw = localStorage.getItem(dataKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.metadata && parsed.glyphs) {
      return parsed as FontProject;
    }
  } catch (err) {
    console.error('Failed to parse snapshot project data:', err);
  }
  return null;
}

/**
 * Delete a specific snapshot
 */
export function deleteSnapshot(snapshotId: string): { success: boolean; freedBytes: number } {
  try {
    const dataKey = `${SNAPSHOT_DATA_PREFIX}${snapshotId}`;
    const raw = localStorage.getItem(dataKey);
    const freedBytes = raw ? getStringSizeBytes(dataKey) + getStringSizeBytes(raw) : 0;
    localStorage.removeItem(dataKey);

    const currentList = listSnapshots();
    const updatedList = currentList.filter((s) => s.id !== snapshotId);
    saveSnapshotsIndex(updatedList);

    window.dispatchEvent(new Event('storage'));
    return { success: true, freedBytes };
  } catch (err) {
    console.error('Failed to delete snapshot:', err);
    return { success: false, freedBytes: 0 };
  }
}

/**
 * Clear all snapshots at once
 */
export function clearAllSnapshots(): { success: boolean; freedBytes: number; deletedCount: number } {
  try {
    const snapshots = listSnapshots();
    let freedBytes = 0;
    let deletedCount = 0;

    for (const snap of snapshots) {
      const dataKey = `${SNAPSHOT_DATA_PREFIX}${snap.id}`;
      const raw = localStorage.getItem(dataKey);
      if (raw) {
        freedBytes += getStringSizeBytes(dataKey) + getStringSizeBytes(raw);
        localStorage.removeItem(dataKey);
        deletedCount++;
      }
    }

    const indexRaw = localStorage.getItem(SNAPSHOTS_INDEX_KEY);
    if (indexRaw) {
      freedBytes += getStringSizeBytes(SNAPSHOTS_INDEX_KEY) + getStringSizeBytes(indexRaw);
      localStorage.removeItem(SNAPSHOTS_INDEX_KEY);
    }

    window.dispatchEvent(new Event('storage'));
    return { success: true, freedBytes, deletedCount };
  } catch (err) {
    console.error('Failed to clear all snapshots:', err);
    return { success: false, freedBytes: 0, deletedCount: 0 };
  }
}

/**
 * Clear non-essential editor caches to instantly free up space
 */
export function clearNonEssentialCache(): { success: boolean; freedBytes: number; clearedKeys: string[] } {
  let freedBytes = 0;
  const clearedKeys: string[] = [];

  const nonEssentialKeyFragments = ['guide_assist', 'subtoolbar', 'palm_rejection', 'overlay', 'sidebar_width'];

  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;

      const isNonEssential = nonEssentialKeyFragments.some((frag) => key.includes(frag));
      if (isNonEssential) {
        const val = localStorage.getItem(key) || '';
        freedBytes += getStringSizeBytes(key) + getStringSizeBytes(val);
        localStorage.removeItem(key);
        clearedKeys.push(key);
      }
    }

    window.dispatchEvent(new Event('storage'));
    return { success: true, freedBytes, clearedKeys };
  } catch (err) {
    console.error('Failed to clear cache:', err);
    return { success: false, freedBytes: 0, clearedKeys: [] };
  }
}

/**
 * Generate standard save data / backup filename according to format:
 * 年日付(バージョンとか)-プロジェクト名
 * e.g. 20260920(v1.0)-MyFont.fontproj.json
 */
export function generateSaveFileName(
  projectName?: string,
  version?: string,
  extraSuffix?: string,
  extension: string = 'fontproj.json',
  dateInput: Date | number = new Date()
): string {
  const d = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Version normalization: ensure it is clean and formatted like "(v1.0)" or given version
  let rawVer = (version || '1.0').trim();
  // Remove outer parentheses if already present
  if (rawVer.startsWith('(') && rawVer.endsWith(')')) {
    rawVer = rawVer.slice(1, -1).trim();
  }
  let cleanVer = rawVer.replace(/[/\\?%*:|"<>]/g, '');
  if (!cleanVer) {
    cleanVer = '1.0';
  }
  if (!cleanVer.startsWith('v') && !cleanVer.startsWith('V') && /^[0-9]/.test(cleanVer)) {
    cleanVer = `v${cleanVer}`;
  }

  // Safe project name
  const rawProjectName = (projectName || '手書きフォント').trim();
  const safeProject = rawProjectName.replace(/[/\\?%*:|"<>]/g, '_') || '手書きフォント';

  // Suffix handling
  const safeSuffix = extraSuffix ? `_${extraSuffix.trim().replace(/[/\\?%*:|"<>]/g, '_')}` : '';

  return `${dateStr}(${cleanVer})-${safeProject}${safeSuffix}.${extension}`;
}

/**
 * Trigger download of project as a .fontproj.json file and record backup timestamp
 * Formatted as: 年日付(バージョンとか)-プロジェクト名.fontproj.json
 */
export function exportProjectJsonFile(
  project: FontProject,
  customFilename?: string,
  extraSuffix?: string
): { success: boolean; filename: string; sizeBytes: number } {
  try {
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const sizeBytes = blob.size;
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');

    const projectName = customFilename || project.metadata?.familyName || project.name || '手書きフォント';
    const version = project.metadata?.version || (project as any).version || '1.0';
    const finalFilename = generateSaveFileName(projectName, version, extraSuffix, 'fontproj.json');

    downloadAnchor.href = url;
    downloadAnchor.download = finalFilename;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();

    setTimeout(() => {
      try {
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 1000);

    // Update backup timestamp
    const now = Date.now();
    setLastBackupTimestamp(now);

    return { success: true, filename: finalFilename, sizeBytes };
  } catch (err) {
    console.error('Failed to export project JSON file:', err);
    return { success: false, filename: '', sizeBytes: 0 };
  }
}

/**
 * Download a snapshot directly as a JSON file
 * Formatted as: 年日付(バージョンとか)-プロジェクト名_snapshot.fontproj.json
 */
export function downloadSnapshotJsonFile(snapshot: ProjectBackupSnapshot): boolean {
  try {
    const project = loadProjectFromSnapshot(snapshot.id);
    if (!project) {
      alert('スナップショットデータの取得に失敗しました。');
      return false;
    }
    const projectName = snapshot.familyName || project.metadata?.familyName || project.name || '手書きフォント';
    const version = project.metadata?.version || '1.0';
    const finalFilename = generateSaveFileName(
      projectName,
      version,
      'snapshot',
      'fontproj.json',
      snapshot.timestamp || Date.now()
    );

    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');

    downloadAnchor.href = url;
    downloadAnchor.download = finalFilename;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();

    setTimeout(() => {
      try {
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 1000);

    setLastBackupTimestamp(Date.now());
    return true;
  } catch (err) {
    console.error('Failed to download snapshot:', err);
    return false;
  }
}

/**
 * Export a single glyph as an individual JSON backup file
 * Formatted as: 年日付(バージョンとか)-プロジェクト名_文字_U+XXXX.glyph.json
 */
export function exportGlyphJsonFile(
  glyph: any,
  unicode: number,
  char: string,
  projectName: string = '手書きフォント',
  version: string = '1.0'
): { success: boolean; filename: string; sizeBytes: number } {
  try {
    const data = {
      format: 'single-glyph-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      projectName,
      unicode,
      char,
      glyph: glyph || {
        unicode,
        char,
        advanceWidth: 1000,
        contours: [],
        strokes: [],
        anchors: [],
      },
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const sizeBytes = blob.size;
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');

    const hexCode = unicode.toString(16).toUpperCase().padStart(4, '0');
    const safeChar = (char || 'glyph').replace(/[/\\?%*:|"<>]/g, '_');
    const finalFilename = generateSaveFileName(
      projectName,
      version,
      `${safeChar}_U+${hexCode}`,
      'glyph.json'
    );

    downloadAnchor.href = url;
    downloadAnchor.download = finalFilename;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();

    setTimeout(() => {
      try {
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 1000);

    return { success: true, filename: finalFilename, sizeBytes };
  } catch (err) {
    console.error('Failed to export single glyph JSON:', err);
    return { success: false, filename: '', sizeBytes: 0 };
  }
}
