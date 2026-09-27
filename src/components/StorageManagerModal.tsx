import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FontProject } from '../types';
import { ThemeMode, isLightTheme } from '../utils/theme';
import {
  StorageUsageBreakdown,
  ProjectBackupSnapshot,
  IndexedDBAutoSaveEntry,
  getStorageUsageBreakdown,
  getBackupStatusInfo,
  listSnapshots,
  listAutosaveHistoryFromIndexedDB,
  loadAutosaveEntryFromIndexedDB,
  createLocalSnapshot,
  loadProjectFromSnapshot,
  deleteSnapshot,
  clearAllSnapshots,
  clearNonEssentialCache,
  exportProjectJsonFile,
  downloadSnapshotJsonFile,
  formatBytes,
  formatDateTime,
  formatRelativeTime,
} from '../utils/storageManager';
import {
  HardDrive,
  Download,
  Trash2,
  RotateCcw,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileJson,
  X,
  Layers,
  Sparkles,
  Info,
  ShieldCheck,
  FolderArchive,
  Database,
} from 'lucide-react';

interface StorageManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
  theme: ThemeMode;
  onShowToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({
  isOpen,
  onClose,
  project,
  setProject,
  theme,
  onShowToast,
}) => {
  const isLight = isLightTheme(theme);

  const [activeTab, setActiveTab] = useState<'snapshots' | 'autosave' | 'breakdown' | 'guide'>('snapshots');
  const [breakdown, setBreakdown] = useState<StorageUsageBreakdown>(getStorageUsageBreakdown());
  const [snapshots, setSnapshots] = useState<ProjectBackupSnapshot[]>(listSnapshots());
  const [autosaveEntries, setAutosaveEntries] = useState<IndexedDBAutoSaveEntry[]>([]);
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(null);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<number | null>(null);

  // New snapshot creation input state
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');

  // Confirmation modals state
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Refresh storage data
  const refreshStorageData = useCallback(() => {
    setBreakdown(getStorageUsageBreakdown());
    setSnapshots(listSnapshots());
    const status = getBackupStatusInfo();
    setLastBackupTime(status.lastBackupTimestamp);
    setLastAutoSaveTime(status.lastAutoSaveTimestamp);

    listAutosaveHistoryFromIndexedDB().then((history) => {
      setAutosaveEntries(history);
    }).catch(() => {
      setAutosaveEntries([]);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshStorageData();
    }
  }, [isOpen, refreshStorageData]);

  // Keyboard shortcut listener: Escape, Tabs (1/2/3), Refresh (R)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('snapshots');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('breakdown');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('guide');
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          refreshStorageData();
          onShowToast('ストレージ状態を再読込しました', 'info');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, refreshStorageData, onShowToast]);

  // Handle manual JSON file backup export
  const handleExportJson = () => {
    const res = exportProjectJsonFile(project);
    if (res.success) {
      onShowToast(`バックアップ『${res.filename}』をダウンロードしました`, 'success');
      refreshStorageData();
    } else {
      onShowToast('バックアップファイルの書き出しに失敗しました', 'error');
    }
  };

  // Handle creating a manual snapshot
  const handleCreateSnapshot = () => {
    const label = snapshotLabel.trim() || undefined;
    const res = createLocalSnapshot(project, 'manual', label);
    if (res.success) {
      onShowToast('ローカルスナップショットを作成しました', 'success');
      setSnapshotLabel('');
      setIsCreatingSnapshot(false);
      refreshStorageData();
    } else {
      onShowToast(res.error || 'スナップショットの作成に失敗しました', 'error');
    }
  };

  // Handle restoring project from snapshot
  const handleRestoreSnapshot = (snap: ProjectBackupSnapshot) => {
    const loaded = loadProjectFromSnapshot(snap.id);
    if (loaded) {
      setProject(loaded);
      onShowToast(`スナップショット「${snap.formattedDate}」をキャンバスに復元しました`, 'success');
      setConfirmRestoreId(null);
      refreshStorageData();
    } else {
      onShowToast('スナップショットデータの復元に失敗しました', 'error');
    }
  };

  // Handle restoring project from IndexedDB autosave history entry
  const handleRestoreAutosaveEntry = (entry: IndexedDBAutoSaveEntry) => {
    if (entry.project) {
      setProject(entry.project);
      onShowToast(`IndexedDB自動バックアップ「${formatDateTime(entry.timestamp)}」を復元しました`, 'success');
      refreshStorageData();
    } else {
      onShowToast('バックアップデータの復元に失敗しました', 'error');
    }
  };

  // Handle deleting a single snapshot
  const handleDeleteSnapshot = (id: string) => {
    const res = deleteSnapshot(id);
    if (res.success) {
      onShowToast(`スナップショットを削除し、${formatBytes(res.freedBytes)} を開放しました`, 'info');
      setConfirmDeleteId(null);
      refreshStorageData();
    } else {
      onShowToast('スナップショットの削除に失敗しました', 'error');
    }
  };

  // Handle clearing all snapshots
  const handleClearAllSnapshots = () => {
    const res = clearAllSnapshots();
    if (res.success) {
      onShowToast(`全スナップショット（${res.deletedCount}件）を削除し、${formatBytes(res.freedBytes)} を開放しました`, 'success');
      setConfirmClearAll(false);
      refreshStorageData();
    } else {
      onShowToast('スナップショットの一括削除に失敗しました', 'error');
    }
  };

  // Handle cleaning non-essential cache
  const handleCleanCache = () => {
    const res = clearNonEssentialCache();
    if (res.success) {
      onShowToast(`一時キャッシュをクリーンアップし、${formatBytes(res.freedBytes)} を開放しました`, 'success');
      refreshStorageData();
    } else {
      onShowToast('キャッシュのクリアに失敗しました', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-150">
      <div
        className={`w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isLight ? 'bg-white border-stone-200 text-stone-800' : 'bg-[#141d17] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* MODAL HEADER */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-3.5 border-b shrink-0 ${
            isLight ? 'bg-[#f7faf8] border-[#d8e6df]' : 'bg-[#101712] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                <span>保存・バックアップ管理</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-mono">
                  容量制限対策 & 履歴
                </span>
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                ブラウザ保存容量（約5MB）の監視・スナップショット履歴の復元・安全なJSON外部書き出し
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#1f2b23] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOP STORAGE CAPACITY METRIC HERO CARD */}
        <div
          className={`px-4 sm:px-6 py-3 border-b shrink-0 ${
            isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-[#111913] border-[#223025]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-stone-700 dark:text-emerald-300">
                localStorage 使用量:
              </span>
              <span className="text-sm font-extrabold font-mono text-stone-900 dark:text-emerald-100">
                {formatBytes(breakdown.totalUsedBytes)}
              </span>
              <span className="text-xs text-stone-400 dark:text-stone-500 font-mono">
                / 約 {formatBytes(breakdown.estimatedLimitBytes)} ({breakdown.usedPercentage.toFixed(1)}%)
              </span>
            </div>

            {/* Health status badge */}
            <div className="flex items-center space-x-1.5">
              {breakdown.status === 'safe' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  保存容量: 良好
                </span>
              )}
              {breakdown.status === 'warning' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  保存容量: 要注意 (65%超過)
                </span>
              )}
              {breakdown.status === 'critical' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                  容量上限リスク (85%超過)
                </span>
              )}
            </div>
          </div>

          {/* Meter progress bar */}
          <div className="w-full h-2.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                breakdown.status === 'safe'
                  ? 'bg-emerald-500'
                  : breakdown.status === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(1, breakdown.usedPercentage))}%` }}
            />
          </div>

          {/* Breakdown Pills */}
          <div className="flex flex-wrap gap-2 pt-2 text-[10px] text-stone-600 dark:text-stone-300">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-[#1a251e] border border-stone-200 dark:border-[#2b3a30]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              作業中フォント: <strong>{formatBytes(breakdown.projectBytes)}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-[#1a251e] border border-stone-200 dark:border-[#2b3a30]">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              スナップショット ({snapshots.length}件): <strong>{formatBytes(breakdown.snapshotsBytes)}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-[#1a251e] border border-stone-200 dark:border-[#2b3a30]">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              カスタム部首部品: <strong>{formatBytes(breakdown.customPartsBytes)}</strong>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-[#1a251e] border border-stone-200 dark:border-[#2b3a30]">
              <span className="w-2 h-2 rounded-full bg-stone-400" />
              設定・その他: <strong>{formatBytes(breakdown.presetsBytes + breakdown.settingsBytes + breakdown.otherBytes)}</strong>
            </span>
          </div>
        </div>

        {/* PRIMARY ACTION CARD: LAST BACKUP STATUS & INSTANT EXPORT */}
        <div
          className={`px-4 sm:px-6 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 ${
            isLight ? 'bg-emerald-50/50 border-emerald-100' : 'bg-emerald-950/20 border-emerald-900/40'
          }`}
        >
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                <span>最終ファイルバックアップ (.json):</span>
                {lastBackupTime ? (
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                    {formatDateTime(lastBackupTime)} ({formatRelativeTime(lastBackupTime)})
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-950/70 px-1.5 py-0.5 rounded">
                    未実行（ファイルバックアップを推奨）
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-tight mt-0.5">
                ブラウザのキャッシュ消去や容量制限による消失を防ぐため、PC/スマホのローカル保存ファイルとして手動ダウンロードできます。
              </p>
            </div>
          </div>

          <button
            onClick={handleExportJson}
            className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md flex items-center justify-center space-x-1.5 transition-all shrink-0 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>今すぐJSON保存 (.fontproj.json)</span>
          </button>
        </div>

        {/* TABS NAVIGATION */}
        <div
          className={`flex items-center space-x-2 px-3 sm:px-6 pt-2.5 pb-0 border-b shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap ${
            isLight ? 'bg-stone-50/50 border-stone-200' : 'bg-[#111913] border-[#223025]'
          }`}
        >
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-t border-x -mb-px flex items-center space-x-1.5 transition-colors ${
              activeTab === 'snapshots'
                ? isLight
                  ? 'bg-white border-stone-200 text-emerald-800 border-b-transparent'
                  : 'bg-[#141d17] border-[#25362b] text-emerald-300 border-b-transparent'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>手動スナップショット ({snapshots.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('autosave')}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-t border-x -mb-px flex items-center space-x-1.5 transition-colors ${
              activeTab === 'autosave'
                ? isLight
                  ? 'bg-white border-stone-200 text-emerald-800 border-b-transparent'
                  : 'bg-[#141d17] border-[#25362b] text-emerald-300 border-b-transparent'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>IndexedDB クラッシュ復元 ({autosaveEntries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('breakdown')}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-t border-x -mb-px flex items-center space-x-1.5 transition-colors ${
              activeTab === 'breakdown'
                ? isLight
                  ? 'bg-white border-stone-200 text-emerald-800 border-b-transparent'
                  : 'bg-[#141d17] border-[#25362b] text-emerald-300 border-b-transparent'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>ストレージ詳細内訳</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-t border-x -mb-px flex items-center space-x-1.5 transition-colors ${
              activeTab === 'guide'
                ? isLight
                  ? 'bg-white border-stone-200 text-emerald-800 border-b-transparent'
                  : 'bg-[#141d17] border-[#25362b] text-emerald-300 border-b-transparent'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>容量制限・安全保存ガイド</span>
          </button>
        </div>

        {/* TAB 1: SNAPSHOTS LIST & MANAGEMENT */}
        {activeTab === 'snapshots' && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
            {/* Snapshot Actions Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
              {isCreatingSnapshot ? (
                <div className="flex items-center space-x-2 flex-1 max-w-md">
                  <input
                    type="text"
                    value={snapshotLabel}
                    onChange={(e) => setSnapshotLabel(e.target.value)}
                    placeholder="スナップショット名 (例: ひらがな完成時点)"
                    className={`flex-1 px-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isLight
                        ? 'bg-white border-stone-300 text-stone-800'
                        : 'bg-[#0f1711] border-[#25362b] text-emerald-100'
                    }`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateSnapshot();
                      if (e.key === 'Escape') setIsCreatingSnapshot(false);
                    }}
                  />
                  <button
                    onClick={handleCreateSnapshot}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    作成
                  </button>
                  <button
                    onClick={() => setIsCreatingSnapshot(false)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-stone-300 dark:border-stone-700 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreatingSnapshot(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center space-x-1.5 transition-transform active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>現在の状態をスナップショット保存</span>
                </button>
              )}

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCleanCache}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center space-x-1 ${
                    isLight
                      ? 'border-stone-200 hover:bg-stone-100 text-stone-700'
                      : 'border-[#25362b] hover:bg-[#1f2b23] text-stone-300'
                  }`}
                  title="作業画面の一時キャッシュをクリアして空き容量を確保"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
                  <span>キャッシュ整理</span>
                </button>

                {snapshots.length > 0 && (
                  <button
                    onClick={() => setConfirmClearAll(true)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center space-x-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>全スナップショット削除</span>
                  </button>
                )}
              </div>
            </div>

            {/* Snapshots Grid / List */}
            {snapshots.length === 0 ? (
              <div
                className={`text-center py-12 px-4 rounded-2xl border border-dashed ${
                  isLight ? 'border-stone-300 bg-stone-50/50' : 'border-stone-800 bg-[#101712]/50'
                }`}
              >
                <FolderArchive className="w-10 h-10 mx-auto text-stone-400 dark:text-stone-600 mb-2 opacity-60" />
                <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300">
                  保存されたスナップショットはありません
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-500 max-w-sm mx-auto mt-1">
                  「現在の状態をスナップショット保存」を押すと、作業の節目で復元可能なバックアップをブラウザ内に保存できます。
                </p>
                <button
                  onClick={() => setIsCreatingSnapshot(true)}
                  className="mt-3.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs inline-flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>最初のスナップショットを作成</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isLight
                        ? 'bg-white hover:border-emerald-300 border-stone-200 shadow-xs'
                        : 'bg-[#16201a] hover:border-emerald-700 border-[#233328] shadow-xs'
                    }`}
                  >
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                        <FileJson className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="text-xs font-extrabold text-stone-800 dark:text-emerald-100 truncate">
                            {snap.label || snap.familyName || '手書きフォント'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 dark:bg-[#1e2a22] text-stone-600 dark:text-stone-400 font-mono">
                            {snap.glyphCount} 文字
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono">
                            {formatBytes(snap.sizeBytes)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{snap.formattedDate}</span>
                          <span>({formatRelativeTime(snap.timestamp)})</span>
                        </div>
                      </div>
                    </div>

                    {/* Snapshot Action Buttons */}
                    <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => setConfirmRestoreId(snap.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center space-x-1 transition-colors ${
                          isLight
                            ? 'border-emerald-300 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/80'
                            : 'border-emerald-800 text-emerald-200 bg-emerald-950/40 hover:bg-emerald-900/60'
                        }`}
                        title="このスナップショットを作業キャンバスに復元"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>復元</span>
                      </button>

                      <button
                        onClick={() => downloadSnapshotJsonFile(snap)}
                        className={`p-1.5 rounded-lg text-xs border transition-colors ${
                          isLight
                            ? 'border-stone-200 text-stone-600 hover:bg-stone-100'
                            : 'border-[#25362b] text-stone-300 hover:bg-[#202d24]'
                        }`}
                        title="JSONファイルとしてダウンロード"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setConfirmDeleteId(snap.id)}
                        className="p-1.5 rounded-lg text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40 transition-colors"
                        title="スナップショットを削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INDEXEDB AUTOSAVE RECOVERY HISTORY */}
        {activeTab === 'autosave' && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start space-x-3 ${
              isLight ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
            }`}>
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-0.5">IndexedDB 大容量常時オートセーブ（二重化インフラ）</div>
                <p className="text-[11px] opacity-90">
                  編集中の変更はバックグラウンドで IndexedDB（最大500MB+）へリアルタイム自動保存されています。ブラウザクラッシュや誤閉じ・タブ切り替え時も直前のデータが安全に保護され、いつでも任意の保存時点へ1クリック復元可能です。
                </p>
              </div>
            </div>

            {autosaveEntries.length === 0 ? (
              <div className="py-12 text-center text-stone-400 dark:text-stone-500 text-xs">
                IndexedDB のオートセーブ履歴はまだありません。作図変更を行うと自動保存されます。
              </div>
            ) : (
              <div className="space-y-2.5">
                {autosaveEntries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isLight
                        ? 'bg-white hover:border-emerald-300 border-stone-200 shadow-xs'
                        : 'bg-[#16201a] hover:border-emerald-700 border-[#233328] shadow-xs'
                    }`}
                  >
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                        {idx === 0 ? '最新' : `#${idx + 1}`}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="text-xs font-extrabold text-stone-800 dark:text-emerald-100 truncate">
                            {entry.projectName || '手書きフォント'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 dark:bg-[#1e2a22] text-stone-600 dark:text-stone-400 font-mono">
                            {entry.glyphCount} 文字収録
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              直近の自動保護ポイント
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                          <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{formatDateTime(entry.timestamp)}</span>
                          <span>({formatRelativeTime(entry.timestamp)})</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRestoreAutosaveEntry(entry)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center space-x-1.5 transition-all shadow-xs shrink-0 self-end sm:self-center active:scale-95 ${
                        isLight
                          ? 'border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                          : 'border-emerald-800 text-emerald-200 bg-emerald-950/60 hover:bg-emerald-900/80'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>この時点へ復元</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DETAILED STORAGE BREAKDOWN */}
        {activeTab === 'breakdown' && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
            <div className="text-xs text-stone-600 dark:text-stone-300">
              ブラウザ（localStorage）内に保管されている全データの内訳と専有サイズ一覧です。
            </div>

            <div className="space-y-2">
              {breakdown.items.map((item) => (
                <div
                  key={item.key}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    isLight ? 'bg-stone-50/60 border-stone-200' : 'bg-[#151f19] border-[#223025]'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="font-bold text-stone-800 dark:text-emerald-200 truncate">
                      {item.label}
                    </div>
                    <div className="font-mono text-[10px] text-stone-400 dark:text-stone-500 truncate">
                      キー: {item.key}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 shrink-0">
                    <span className="font-mono font-bold text-stone-700 dark:text-emerald-300">
                      {formatBytes(item.sizeBytes)}
                    </span>
                    {item.removable && (
                      <button
                        onClick={() => {
                          localStorage.removeItem(item.key);
                          onShowToast(`「${item.label}」を削除しました`, 'info');
                          refreshStorageData();
                        }}
                        className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        title="手動削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SAFETY & STORAGE GUIDE */}
        {activeTab === 'guide' && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-xs leading-relaxed text-stone-700 dark:text-emerald-200/90">
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                isLight ? 'bg-amber-50/60 border-amber-200 text-amber-950' : 'bg-amber-950/20 border-amber-800/40 text-amber-200'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>ブラウザの保存領域（localStorage）に関する注意点</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90 pl-1">
                <li>
                  ブラウザのlocalStorageは約 <strong>5MB</strong> の容量上限が定められています。
                </li>
                <li>
                  文字数が増えたり、ノード数の多い複雑なベクター輪郭が増えると容量制限に達する場合があります。
                </li>
                <li>
                  ブラウザの「閲覧履歴やキャッシュの削除」を実行すると、ブラウザ内の保存データが消失するリスクがあります。
                </li>
              </ul>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-2 ${
                isLight ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>制作データのバックアップ手順</span>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-[11px] opacity-90 pl-1">
                <li>
                  <strong>「今すぐJSON保存 (.fontproj.json)」の定期実行:</strong>{' '}
                  PCやiPadのファイルストレージ・Googleドライブ・iCloud等にセーブデータとして保管できます。
                </li>
                <li>
                  <strong>スナップショットの適宜作成:</strong>{' '}
                  大きな変更を加える前や、部首合成・一括正規化の前後にスナップショットを作成してバックアップできます。
                </li>
                <li>
                  <strong>容量が逼迫した時の対処法:</strong>{' '}
                  最新状態をJSONファイルとして書き出した後、古いスナップショットを一括削除して容量を開放してください。
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* MODAL FOOTER */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-3 border-t shrink-0 ${
            isLight ? 'bg-[#f7faf8] border-[#d8e6df]' : 'bg-[#101712] border-[#25362b]'
          }`}
        >
          <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>自動保存: 編集時に常時バックグラウンド実行中</span>
          </div>

          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              isLight
                ? 'border-stone-300 text-stone-700 hover:bg-stone-100'
                : 'border-[#2d4034] text-stone-300 hover:bg-[#1f2d24]'
            }`}
          >
            閉じる
          </button>
        </div>
      </div>

      {/* CONFIRM RESTORE DIALOG */}
      {confirmRestoreId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in">
          <div
            className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-3.5 ${
              isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#16201a] border-[#25362b] text-emerald-100'
            }`}
          >
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
              <RotateCcw className="w-5 h-5" />
              <h3 className="font-extrabold text-sm">スナップショットの復元</h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              このスナップショットのデータを現在の作業キャンバスに上書き復元します。現在の作業中の未保存変更は置き換えられますが、復元しますか？
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmRestoreId(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${
                  isLight ? 'border-stone-300 text-stone-700' : 'border-stone-700 text-stone-300'
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  const snap = snapshots.find((s) => s.id === confirmRestoreId);
                  if (snap) handleRestoreSnapshot(snap);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                復元を実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in">
          <div
            className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-3.5 ${
              isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#16201a] border-[#25362b] text-emerald-100'
            }`}
          >
            <div className="flex items-center space-x-2 text-rose-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-extrabold text-sm">スナップショットの削除</h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              このスナップショットを削除します。削除されたデータは復元できません。よろしいですか？
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${
                  isLight ? 'border-stone-300 text-stone-700' : 'border-stone-700 text-stone-300'
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDeleteSnapshot(confirmDeleteId)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CLEAR ALL DIALOG */}
      {confirmClearAll && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in">
          <div
            className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-3.5 ${
              isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#16201a] border-[#25362b] text-emerald-100'
            }`}
          >
            <div className="flex items-center space-x-2 text-rose-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="font-extrabold text-sm">全スナップショットの一括削除</h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              保存されているすべてのスナップショット（{snapshots.length}件）を削除し、ブラウザの保存容量を大幅に開放します。よろしいですか？
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmClearAll(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${
                  isLight ? 'border-stone-300 text-stone-700' : 'border-stone-700 text-stone-300'
                }`}
              >
                キャンセル
              </button>
              <button
                onClick={handleClearAllSnapshots}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
              >
                全削除して容量開放
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
