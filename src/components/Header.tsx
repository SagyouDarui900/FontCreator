import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  FolderOpen,
  Save,
  FilePlus,
  Play,
  Settings,
  Undo2,
  Redo2,
  Grid,
  Layers,
  Sparkles,
  Sun,
  Moon,
  MoreVertical,
  Upload,
  FileCode,
  Sliders,
  SlidersHorizontal,
  Shapes,
  Scale,
  Maximize,
  Minimize,
  Wand2,
  ArrowLeftRight,
  RotateCcw,
  X,
  ShieldCheck,
  Paintbrush,
  PenTool,
  Keyboard,
  BookOpen,
  HelpCircle,
  Lock,
  Unlock,
  Eye,
  HardDrive,
  Palette,
  Check,
  ChevronDown,
  Type,
} from 'lucide-react';
import { FontProject } from '../types';
import { ThemeMode, THEME_PRESETS, getThemePreset, isLightTheme, getThemeClasses } from '../utils/theme';
import { downloadFont, loadFontFromFile, createDefaultProject } from '../utils/fontCompiler';
import { exportProjectJsonFile } from '../utils/storageManager';
import { ExportModal } from './ExportModal';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  project: FontProject;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenTestModal: () => void;
  onOpenFontInfoModal: () => void;
  onOpenTraceModal: () => void;
  onOpenSvgModal: () => void;
  onOpenBatchNormalizeModal: () => void;
  onOpenQualityModal?: () => void;
  onOpenGlyphSynthesisModal?: () => void;
  onOpenKerningModal?: () => void;
  onOpenWeightInterpolationModal?: () => void;
  onOpenGlyphCompareModal?: () => void;
  onOpenRadicalStudio: () => void;
  onOpenPixelStudio?: () => void;
  onOpenOpenTypeFeaturesModal?: () => void;
  onOpenGridFittingModal?: () => void;
  onOpenStorageManagerModal?: () => void;
  onToggleRadicals: () => void;
  showRadicals: boolean;
  onToggleGridDrawer: () => void;
  showGridDrawer: boolean;
  onToggleMetricsDrawer?: () => void;
  showMetricsDrawer?: boolean;
  onToggleZenMode?: () => void;
  isZenMode?: boolean;
  onApplyHandwritingPreset?: () => void;
  onOpenShortcutsModal?: () => void;
  onOpenPenPresetsModal?: () => void;
  selectedChar: string;
  selectedUnicode: number;
  isGlyphLocked?: boolean;
  onToggleLockGlyph?: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onChangeTheme?: (mode: ThemeMode) => void;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  project,
  setProject,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenTestModal,
  onOpenFontInfoModal,
  onOpenTraceModal,
  onOpenSvgModal,
  onOpenBatchNormalizeModal,
  onOpenQualityModal,
  onOpenGlyphSynthesisModal,
  onOpenKerningModal,
  onOpenWeightInterpolationModal,
  onOpenGlyphCompareModal,
  onOpenRadicalStudio,
  onOpenPixelStudio,
  onOpenOpenTypeFeaturesModal,
  onOpenGridFittingModal,
  onOpenStorageManagerModal,
  onToggleRadicals,
  showRadicals,
  onToggleGridDrawer,
  showGridDrawer,
  onToggleMetricsDrawer,
  showMetricsDrawer,
  onToggleZenMode,
  isZenMode = false,
  onApplyHandwritingPreset,
  onOpenShortcutsModal,
  onOpenPenPresetsModal,
  selectedChar,
  selectedUnicode,
  isGlyphLocked = false,
  onToggleLockGlyph,
  theme,
  onToggleTheme,
  onChangeTheme,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isConfirmingNew, setIsConfirmingNew] = useState(false);
  const [newProjectName, setNewProjectName] = useState<string>('新規手書きフォント');
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Fullscreen Mode State & Listener with vendor prefix & Zen Mode fallback
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const isCurrentlyFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (!isCurrentlyFs) {
      const docEl = document.documentElement as any;
      const requestFs =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;

      if (requestFs) {
        requestFs.call(docEl).catch(() => {
          // If browser/iframe policy blocks native fullscreen, fallback gracefully to Zen Mode
          if (onToggleZenMode) {
            onToggleZenMode();
          }
        });
      } else if (onToggleZenMode) {
        onToggleZenMode();
      }
    } else {
      const doc = document as any;
      const exitFs =
        doc.exitFullscreen ||
        doc.webkitExitFullscreen ||
        doc.mozCancelFullScreen ||
        doc.msExitFullscreen;

      if (exitFs) {
        exitFs.call(doc).catch(() => {
          if (onToggleZenMode && isZenMode) {
            onToggleZenMode();
          }
        });
      } else if (onToggleZenMode && isZenMode) {
        onToggleZenMode();
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(target)) {
        setShowToolsMenu(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(target)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const notify = (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    if (onShowToast) {
      onShowToast(text, type);
    }
  };

  const handleNewProjectWithCustomName = (customName?: string) => {
    const newProj = createDefaultProject();
    const finalName = customName && customName.trim() ? customName.trim() : '新規手書きフォント';
    newProj.name = finalName;
    newProj.metadata.familyName = finalName;
    setProject(newProj);
    setIsConfirmingNew(false);
    setShowToolsMenu(false);
    notify(`新しいフォント『${finalName}』を作成・キャンバスをリセットしました`, 'success');
  };

  // セーブデータ (.json) のエクスポート (PC/iPad/スマホ間で移行可能・大容量対応)
  const handleSaveProjectJson = () => {
    try {
      const res = exportProjectJsonFile(project);
      if (res.success) {
        setShowToolsMenu(false);
        notify(`プロジェクトセーブデータ『${res.filename}』を保存しました`, 'success');
      } else {
        notify('プロジェクトの保存に失敗しました', 'error');
      }
    } catch (err) {
      console.error('Failed to export project JSON:', err);
      notify('プロジェクトの保存に失敗しました', 'error');
    }
  };

  // セーブデータ (.json) のインポート
  const handleLoadProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.metadata && json.glyphs) {
          setProject(json);
          notify('プロジェクトセーブデータを読み込みました', 'success');
        } else {
          notify('無効なセーブデータファイルです', 'error');
        }
      } catch (err) {
        notify('セーブデータファイルの読み込みに失敗しました', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setShowToolsMenu(false);
  };

  const handleImportTtf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { metadata, glyphs } = await loadFontFromFile(file);
      setProject((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          ...metadata,
        },
        glyphs: {
          ...prev.glyphs,
          ...glyphs,
        },
        updatedAt: Date.now(),
      }));
      notify(`フォント「${metadata.familyName || file.name}」から ${Object.keys(glyphs).length} 文字をインポートしました`, 'success');
    } catch (err) {
      console.error(err);
      notify('フォントファイルの読み込みに失敗しました。TTFまたはOTF形式であることを確認してください。', 'error');
    }
    e.target.value = '';
    setShowToolsMenu(false);
  };

  const handleExportTtf = () => {
    setShowExportModal(true);
  };

  const glyphCount = Object.keys(project.glyphs).length;
  const isLight = isLightTheme(theme);
  const themeClasses = getThemeClasses(theme);

  return (
    <header
      className={`h-11 sm:h-12 border-b flex items-center justify-between px-1.5 sm:px-2.5 shrink-0 z-40 select-none relative transition-colors overflow-x-auto sm:overflow-x-visible scrollbar-none gap-1 sm:gap-2 ${themeClasses.headerBg}`}
    >
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".ttf,.otf,.woff"
        className="hidden"
        onChange={handleImportTtf}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleLoadProjectJson}
      />

      {/* Left: Sidebar Toggle & Brand & Project Info */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0 min-w-0">
        <button
          onClick={onToggleGridDrawer}
          className={`h-8 sm:h-8 px-2 rounded-lg sm:rounded-xl transition-colors inline-flex items-center gap-1 text-xs font-bold shrink-0 border ${
            showGridDrawer
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                : 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
              : isLight
              ? 'text-stone-600 hover:bg-stone-100 border-stone-200/80'
              : 'text-stone-300 hover:bg-[#1d2720] border-[#222e25]'
          }`}
          title="文字一覧（コード表）の表示/非表示"
        >
          <Grid className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline leading-none">文字一覧</span>
        </button>

        <div className={`h-4 w-[1px] hidden sm:block ${isLight ? 'bg-stone-200' : 'bg-[#222e25]'}`} />

        {/* Brand & Project Info (FC icon removed for clean spacing) */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <div className="flex flex-col min-w-0 justify-center">
            <span className="text-xs font-bold tracking-tight flex items-center gap-1.5 min-w-0 leading-tight">
              <span className="truncate max-w-[70px] xs:max-w-[110px] sm:max-w-[150px] md:max-w-[200px]">
                {project.metadata.familyName && project.metadata.familyName !== 'OTEdit-Style Font' && project.metadata.familyName !== '新規フォント'
                  ? project.metadata.familyName
                  : 'FontCreator'}
              </span>
              {project.metadata.styleName && project.metadata.styleName !== 'Regular' && (
                <span
                  className={`text-[8.5px] px-1 py-0.2 rounded font-mono hidden md:inline-block leading-none ${
                    isLight ? 'bg-stone-100 text-stone-700 border border-stone-200' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {project.metadata.styleName}
                </span>
              )}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-[9.5px] font-mono hidden md:inline truncate leading-tight ${
                  isLight ? 'text-stone-500' : 'text-emerald-400'
                }`}
              >
                編集中: <strong className={isLight ? 'text-emerald-700 font-sans' : 'text-amber-300 font-sans'}>{selectedChar || 'なし'}</strong>{' '}
                (U+{selectedUnicode.toString(16).toUpperCase().padStart(4, '0')}) · {glyphCount}字
              </span>
              {onToggleLockGlyph && (
                <button
                  id="btn-header-lock-glyph"
                  onClick={onToggleLockGlyph}
                  className={`h-6 px-1.5 rounded-lg transition-all inline-flex items-center gap-1 border text-[10px] font-bold shrink-0 ${
                    isGlyphLocked
                      ? isLight
                        ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400/30'
                        : 'bg-amber-950/80 text-amber-300 border-amber-700 ring-1 ring-amber-500/30'
                      : isLight
                      ? 'bg-stone-50 hover:bg-stone-100 text-stone-500 hover:text-stone-800 border-stone-200'
                      : 'bg-[#18241d] hover:bg-[#202f26] text-stone-400 hover:text-emerald-300 border-[#25362b]'
                  }`}
                  title={
                    isGlyphLocked
                      ? `「${selectedChar}」は編集ロック（保護）されています。クリックでロック解除`
                      : `「${selectedChar}」を編集ロック（誤操作や意図しない変更を防止）`
                  }
                >
                  {isGlyphLocked ? (
                    <>
                      <Lock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="hidden sm:inline text-amber-800 dark:text-amber-300 leading-none">ロック中</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                      <span className="hidden sm:inline leading-none">ロック</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Center: Undo/Redo & Essential Preview / Guide */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Undo / Redo Group */}
        <div
          className={`flex items-center h-8 rounded-lg border p-0.5 gap-0.5 ${
            isLight ? 'bg-stone-100/80 border-stone-200' : 'bg-[#18241d] border-[#223025]'
          }`}
        >
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`w-7 h-7 rounded-md transition-colors inline-flex items-center justify-center ${
              canUndo
                ? isLight
                  ? 'text-stone-700 hover:bg-white active:scale-95'
                  : 'text-emerald-200 hover:bg-[#202f26] active:scale-95'
                : isLight
                ? 'text-stone-300 cursor-not-allowed'
                : 'text-stone-600 cursor-not-allowed'
            }`}
            title="元に戻す (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5 shrink-0" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`w-7 h-7 rounded-md transition-colors inline-flex items-center justify-center ${
              canRedo
                ? isLight
                  ? 'text-stone-700 hover:bg-white active:scale-95'
                  : 'text-emerald-200 hover:bg-[#202f26] active:scale-95'
                : isLight
                ? 'text-stone-300 cursor-not-allowed'
                : 'text-stone-600 cursor-not-allowed'
            }`}
            title="やり直す (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>

        <div className={`h-4 w-[1px] hidden sm:block ${isLight ? 'bg-stone-200' : 'bg-[#222e25]'}`} />

        {/* Test Waterfall Modal */}
        <button
          onClick={onOpenTestModal}
          className={`h-8 px-2 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all active:scale-95 border ${
            isLight
              ? 'bg-stone-100/90 text-stone-800 hover:bg-stone-200/90 border-stone-200'
              : 'bg-[#18241d] text-emerald-200 hover:bg-[#202f26] border-[#25362b]'
          }`}
          title="フォント試し打ち・文章リアルタイムプレビュー"
        >
          <Play className="w-3.5 h-3.5 fill-current text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="hidden sm:inline leading-none">試し打ち</span>
        </button>

        {/* Manual & Tutorial & Shortcuts Guide Button */}
        {onOpenShortcutsModal && (
          <button
            onClick={onOpenShortcutsModal}
            className={`h-8 px-2 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all border active:scale-95 ${
              isLight
                ? 'bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-900 border-emerald-200 hover:border-emerald-300'
                : 'bg-[#1a2d21] hover:bg-[#223b2c] text-emerald-200 border-emerald-800/60 hover:border-emerald-700'
            }`}
            title="説明書・チュートリアル・ショートカット集 [?]"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="hidden md:inline leading-none">説明書・ガイド</span>
            <span className="hidden xs:inline md:hidden leading-none">ガイド</span>
            <kbd className="hidden lg:inline-block px-1 py-0.2 rounded text-[10px] font-mono font-bold bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 leading-none">
              ?
            </kbd>
          </button>
        )}

        {/* Kanji Radicals palette toggle */}
        <button
          id="btn-header-radicals"
          onClick={onToggleRadicals}
          className={`h-8 hidden xl:inline-flex px-2 rounded-lg text-xs font-semibold items-center gap-1 transition-all active:scale-95 border ${
            showRadicals
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 font-bold border-emerald-300'
                : 'bg-emerald-700 text-white font-bold border-emerald-600'
              : isLight
              ? 'text-stone-600 hover:bg-stone-100 border-stone-200/80'
              : 'text-stone-300 hover:bg-[#1d2720] border-[#222e25]'
          }`}
          title="部首パレット (康熙214部首・高品質パーツ)"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="leading-none">部首</span>
        </button>
      </div>

      {/* Right: Clean Tools Dropdown & Theme & Settings & TTF Export */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Metrics Panel toggle (Universal across desktop & mobile) */}
        {onToggleMetricsDrawer && (
          <button
            id="btn-header-metrics"
            onClick={onToggleMetricsDrawer}
            className={`px-2 py-1 h-8 rounded-lg text-xs font-bold flex items-center gap-1 transition-all border active:scale-95 cursor-pointer shrink-0 ${
              showMetricsDrawer
                ? isLight
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-emerald-950 text-emerald-200 border-emerald-700/60 ring-2 ring-emerald-400/20'
                : isLight
                ? 'bg-white hover:bg-emerald-50/70 text-stone-700 hover:text-emerald-900 border-stone-200 hover:border-emerald-300'
                : 'bg-[#151f19] hover:bg-[#1d2b22] text-emerald-200 border-[#25362b] hover:border-emerald-700/60'
            }`}
            title="メトリクス・文字ツール（送り幅・字面枠・変形など）"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold leading-none hidden md:inline">メトリクス</span>
          </button>
        )}

        {/* Unified Tools Dropdown */}
        <div className="relative" ref={toolsMenuRef}>
          <button
            onClick={() => setShowToolsMenu(!showToolsMenu)}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 h-8 sm:h-9 rounded-lg sm:rounded-xl text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all border active:scale-95 ${
              showToolsMenu
                ? isLight
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-emerald-950 text-emerald-200 border-emerald-700/60 ring-2 ring-emerald-400/20'
                : isLight
                ? 'bg-white hover:bg-emerald-50/70 text-stone-700 hover:text-emerald-900 border-stone-200 hover:border-emerald-300'
                : 'bg-[#151f19] hover:bg-[#1d2b22] text-emerald-200 border-[#25362b] hover:border-emerald-700/60'
            }`}
            title="機能メニュー（制作スタジオ・自動化・ファイル管理）"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold leading-none">機能</span>
            <span
              className={`hidden sm:inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold leading-none ${
                isLight
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-[#1a2d21] text-emerald-300 border border-emerald-800'
              }`}
            >
              12
            </span>
            <span
              className={`text-[9px] opacity-70 transition-transform duration-150 leading-none ${
                showToolsMenu ? 'rotate-180' : ''
              }`}
            >
              ▾
            </span>
          </button>

          {showToolsMenu && (
            <>
              {/* Invisible click-away backdrop */}
              <div
                className="fixed inset-0 z-50 bg-black/25 backdrop-blur-2xs"
                onClick={() => setShowToolsMenu(false)}
              />
              <div
                style={{
                  maxHeight: 'calc(100vh - 56px)',
                  paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 24px)',
                }}
                className={`fixed right-1 sm:right-4 top-[48px] sm:top-[54px] w-[calc(100vw-8px)] sm:w-[460px] md:w-[500px] overflow-y-auto overscroll-contain rounded-2xl shadow-2xl border p-2.5 sm:p-3.5 z-50 flex flex-col gap-2.5 animate-in fade-in duration-150 ${
                  isLight
                    ? 'bg-white/98 backdrop-blur-md border-stone-200 text-stone-800 shadow-xl'
                    : 'bg-[#151f19]/98 backdrop-blur-md border-[#25362b] text-emerald-100 shadow-xl'
                }`}
              >
              {/* Menu Header with Count and Close Button */}
              <div className="flex items-center justify-between px-1 pb-1.5 border-b border-stone-200/80 dark:border-[#223025]">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold ">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold tracking-tight">機能・制作スタジオ</span>
                    <span className="ml-1.5 text-[10px] text-stone-400 dark:text-emerald-400 font-normal">
                      全13ツール
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowToolsMenu(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#202d24] transition-colors"
                  title="メニューを閉じる"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Primary Action: Font Export Banner */}
              <button
                onClick={() => {
                  setShowToolsMenu(false);
                  setShowExportModal(true);
                }}
                className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all group ${
                  isLight
                    ? 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200 text-emerald-950 '
                    : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-800/60 text-emerald-200 '
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center space-x-1.5">
                      <span>フォントを出力 (TTF / OTF)</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-600 text-white font-mono font-normal">
                        推奨
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-500 dark:text-emerald-300/80">
                      iPadインストール・PCダウンロード・OTF/TTF両形式
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 pr-1 shrink-0">
                  出力 ➔
                </span>
              </button>



              {/* Handwriting Quick Preset Banner */}
              {onApplyHandwritingPreset && (
                <button
                  onClick={() => {
                    onApplyHandwritingPreset();
                    setShowToolsMenu(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all group ${
                    isLight
                      ? 'bg-amber-50/70 hover:bg-amber-100/80 border-amber-200 text-amber-950 '
                      : 'bg-amber-950/30 hover:bg-amber-900/40 border-amber-800/60 text-amber-200 '
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Paintbrush className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center space-x-1.5">
                        <span>デフォルトの筆設定を適用</span>
                      </div>
                      <div className="text-[10px] text-stone-500 dark:text-amber-300/80">
                        ブラシ幅38px・筆圧高感度・手振れ補正有効
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 pr-1 shrink-0">
                    適用 ➔
                  </span>
                </button>
              )}

              {/* Advanced Studio & Automation Features Grid */}
              <div>
                <div className="px-1 py-1 text-[10px] font-bold text-stone-400 dark:text-emerald-500 uppercase tracking-wider flex items-center justify-between">
                  <span>編集・変換ツール</span>
                  <span className="text-[9px] font-normal lowercase">8 tools</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-0.5">
                  {/* Custom Pen Creation Studio (ibisPaint Style) */}
                  {onOpenPenPresetsModal && (
                    <button
                      onClick={() => {
                        onOpenPenPresetsModal();
                        setShowToolsMenu(false);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
                        isLight
                          ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-900 '
                          : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] text-emerald-100 '
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-stone-200 dark:bg-[#23352b] text-stone-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">
                          ペン作成スタジオ
                        </div>
                        <div className="text-[10px] text-stone-500 dark:text-emerald-300/80 leading-snug line-clamp-2">
                          入り抜き・筆先形状・角度/扁平率・補正・動的変化
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Quality Check & Extrema Optimization */}
                  {onOpenQualityModal && (
                    <button
                      onClick={() => {
                        onOpenQualityModal();
                        setShowToolsMenu(false);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group ${
                        isLight
                          ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300'
                          : 'bg-[#1a251e] hover:bg-[#202f26] border-[#25362b] hover:border-emerald-700/60'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">フォント品質チェック</div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">
                          極点最適化・交差・過剰ノード検査
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Glyph Synthesis (Dakuten & Small Kana) */}
                  {onOpenGlyphSynthesisModal && (
                    <button
                      onClick={() => {
                        onOpenGlyphSynthesisModal();
                        setShowToolsMenu(false);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group ${
                        isLight
                          ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300'
                          : 'bg-[#1a251e] hover:bg-[#202f26] border-[#25362b] hover:border-emerald-700/60'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Wand2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">濁点・小書き自動合成</div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">
                          清音から「がぎぐ・っゃゅょ」一括生成
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Kerning & Side Bearings */}
                  {onOpenKerningModal && (
                    <button
                      onClick={() => {
                        onOpenKerningModal();
                        setShowToolsMenu(false);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group ${
                        isLight
                          ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300'
                          : 'bg-[#1a251e] hover:bg-[#202f26] border-[#25362b] hover:border-emerald-700/60'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <ArrowLeftRight className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">カーニング・余白調整</div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">
                          ペア字間・左右サイドベアリング設定
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Batch Normalize (Scale, Stroke, Margins) */}
                  <button
                    onClick={() => {
                      onOpenBatchNormalizeModal();
                      setShowToolsMenu(false);
                    }}
                    className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group ${
                      isLight
                        ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300'
                        : 'bg-[#1a251e] hover:bg-[#202f26] border-[#25362b] hover:border-emerald-700/60'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">サイズ・太さ・余白統一</div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">
                        字面枠・線の太さ・ベジェ曲線一括調整
                      </div>
                    </div>
                  </button>

                  {/* Weight Interpolation & Family Generation */}
                  {onOpenWeightInterpolationModal && (
                    <button
                      onClick={() => {
                        onOpenWeightInterpolationModal();
                        setShowToolsMenu(false);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group ${
                        isLight
                          ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300'
                          : 'bg-[#1a251e] hover:bg-[#202f26] border-[#25362b] hover:border-emerald-700/60'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">複数ウェイト自動補間</div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">
                          太さ一括増減・ファミリー展開・2マスター間幾何補間
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Glyph Overlay Compare */}
                  {onOpenGlyphCompareModal && (
                    <button
                      onClick={() => {
                        onOpenGlyphCompareModal();
                        setShowToolsMenu(false);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group ${
                        isLight
                          ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300'
                          : 'bg-[#1a251e] hover:bg-[#202f26] border-[#25362b] hover:border-emerald-700/60'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Eye className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">グリフ重ね合わせ比較</div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">
                          類似文字・骨格の半透明重ね合わせバランス検査
                        </div>
                      </div>
                    </button>
                  )}

                  {/* OpenType Features (Vertical & Ligatures) */}
                  {onOpenOpenTypeFeaturesModal && (
                    <button
                      onClick={() => {
                        onOpenOpenTypeFeaturesModal();
                        setShowToolsMenu(false);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group ${
                        isLight
                          ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300'
                          : 'bg-[#1a251e] hover:bg-[#202f26] border-[#25362b] hover:border-emerald-700/60'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <FileCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">縦書き・合字 (OpenType)</div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">
                          `vert` 縦書き置換・合字(GSUB)設計
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Grid Fitting & Auto Hinting */}
                  {onOpenGridFittingModal && (
                    <button
                      onClick={() => {
                        onOpenGridFittingModal();
                        setShowToolsMenu(false);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group ${
                        isLight
                          ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300'
                          : 'bg-[#1a251e] hover:bg-[#202f26] border-[#25362b] hover:border-emerald-700/60'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Grid className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">低解像度グリッド整列</div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">
                          12〜24px 自動ステムヒンティング
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Pixel / Dot Font Studio */}
                  {onOpenPixelStudio && (
                    <button
                      onClick={() => {
                        onOpenPixelStudio();
                        setShowToolsMenu(false);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group ${
                        isLight
                          ? 'bg-emerald-50/70 hover:bg-emerald-100/80 border-emerald-300 text-emerald-950 '
                          : 'bg-[#18271e] hover:bg-[#203428] border-emerald-600/70 text-emerald-100 '
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform text-xs font-bold ">
                        <Grid className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate flex items-center gap-1">
                          <span>ピクセルフォント工房</span>
                          <span className="text-[8.5px] px-1 py-0.2 bg-emerald-600 text-white rounded font-mono">
                            ゼロからドット制作
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">
                          8x8/16x16/JIS規格・全文字自動保存・スプライトシート/Cヘッダー出力
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Radical Studio */}
                  <button
                    onClick={() => {
                      onOpenRadicalStudio();
                      setShowToolsMenu(false);
                    }}
                    className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group ${
                      isLight
                        ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300'
                        : 'bg-[#1a251e] hover:bg-[#202f26] border-[#25362b] hover:border-emerald-700/60'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <Shapes className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">部首パーツ工房</div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">
                        へん・つくりパーツの作成・管理
                      </div>
                    </div>
                  </button>

                  {/* SVG Vectorizer Import */}
                  <button
                    onClick={() => {
                      onOpenSvgModal();
                      setShowToolsMenu(false);
                    }}
                    className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group ${
                      isLight
                        ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300'
                        : 'bg-[#1a251e] hover:bg-[#202f26] border-[#25362b] hover:border-emerald-700/60'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">SVGインポート</div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">
                        Illustrator等のベクターパス取込
                      </div>
                    </div>
                  </button>

                  {/* Image / Photo Trace */}
                  <button
                    onClick={() => {
                      onOpenTraceModal();
                      setShowToolsMenu(false);
                    }}
                    className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group col-span-1 sm:col-span-2 ${
                      isLight
                        ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300'
                        : 'bg-[#1a251e] hover:bg-[#202f26] border-[#25362b] hover:border-emerald-700/60'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">下絵・写真トレース</div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 leading-snug">
                        手書きノートや看板写真から輪郭をなぞり描き
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* File Operations & Backups */}
              <div className="pt-1 border-t border-stone-200/80 dark:border-[#223025]">
                <div className="px-1 py-1 text-[10px] font-bold text-stone-400 dark:text-emerald-500 uppercase tracking-wider">
                  ファイル入出力 & バックアップ
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-0.5">
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowToolsMenu(false);
                    }}
                    className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 ${
                      isLight
                        ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
                        : 'bg-[#1a251e] hover:bg-[#202d24] border-[#25362b] text-emerald-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400 shrink-0" />
                    <span className="text-xs font-medium truncate">フォント読込 (.ttf)</span>
                  </button>

                  <button
                    onClick={() => {
                      projectInputRef.current?.click();
                      setShowToolsMenu(false);
                    }}
                    className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 ${
                      isLight
                        ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
                        : 'bg-[#1a251e] hover:bg-[#202d24] border-[#25362b] text-emerald-200'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400 shrink-0" />
                    <span className="text-xs font-medium truncate">セーブ読込 (.json)</span>
                  </button>

                  <button
                    onClick={() => {
                      handleSaveProjectJson();
                      setShowToolsMenu(false);
                    }}
                    className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 ${
                      isLight
                        ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
                        : 'bg-[#1a251e] hover:bg-[#202d24] border-[#25362b] text-emerald-200'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400 shrink-0" />
                    <span className="text-xs font-medium truncate">セーブ保存 (.json)</span>
                  </button>

                  {onOpenStorageManagerModal && (
                    <button
                      onClick={() => {
                        onOpenStorageManagerModal();
                        setShowToolsMenu(false);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 col-span-2 ${
                        isLight
                          ? 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200 text-emerald-950 '
                          : 'bg-[#1a2d21] hover:bg-[#223b2c] border-emerald-800/60 text-emerald-200 '
                      }`}
                    >
                      <HardDrive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">保存管理・バックアップパネル</div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                          localStorage容量監視・スナップショット履歴復元・削除
                        </div>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      onOpenFontInfoModal();
                      setShowToolsMenu(false);
                    }}
                    className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 ${
                      isLight
                        ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
                        : 'bg-[#1a251e] hover:bg-[#202d24] border-[#25362b] text-emerald-200'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs font-medium truncate">情報・商用利用</span>
                  </button>

                  {onOpenShortcutsModal && (
                    <button
                      onClick={() => {
                        onOpenShortcutsModal();
                        setShowToolsMenu(false);
                      }}
                      className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 col-span-2 ${
                        isLight
                          ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
                          : 'bg-[#1a251e] hover:bg-[#202d24] border-[#25362b] text-emerald-200'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold truncate">説明書・チュートリアル・ショートカット集 [?]</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Reset / New Project */}
              <div className="pt-1 border-t border-stone-200/80 dark:border-[#223025]">
                <button
                  onClick={() => {
                    setShowToolsMenu(false);
                    setIsConfirmingNew(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2 font-medium transition-colors"
                >
                  <FilePlus className="w-3.5 h-3.5 shrink-0" />
                  <span>新規プロジェクト作成（白紙リセット）</span>
                </button>
              </div>
            </div>
          </>
        )}
        </div>

        {/* In-App PWA Install Button */}
        <PWAInstallButton isLight={isLight} />

        {/* Theme Preset Selector Dropdown */}
        <div className="relative shrink-0" ref={themeMenuRef}>
          <button
            onClick={() => setShowThemeMenu((prev) => !prev)}
            className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all flex items-center space-x-1 border ${
              isLight
                ? 'bg-stone-100/80 hover:bg-stone-200/80 text-stone-700 border-stone-200/90'
                : 'bg-[#18241d] hover:bg-[#203027] text-emerald-300 border-[#25362b]'
            }`}
            title="カラーテーマ・目の保護（セピア/ブルーライトカット）の切り替え"
          >
            <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 dark:text-amber-400" />
            <span className="hidden xl:inline text-[11px] font-bold">
              {getThemePreset(theme).name.split(' ')[0]}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60 hidden xl:inline" />
          </button>

          {/* Theme Selector Popover Menu */}
          {showThemeMenu && (
            <>
              <div
                className="fixed inset-0 z-50 bg-black/15 backdrop-blur-2xs"
                onClick={() => setShowThemeMenu(false)}
              />
              <div
                className={`fixed right-1 sm:absolute sm:right-0 top-[48px] sm:top-auto sm:mt-1.5 w-[calc(100vw-12px)] sm:w-80 max-w-sm rounded-xl border shadow-xl z-50 p-2 text-left backdrop-blur-md transition-all ${themeClasses.cardBg}`}
              >
              <div className="px-2 py-1.5 border-b border-stone-200/80 dark:border-stone-800/80 flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-1.5">
                  <Palette className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold">テーマ・目への優しさ設定</span>
                </div>
                <span className="text-[10px] text-stone-400 font-mono">全6プリセット</span>
              </div>

              <div className="space-y-1 max-h-[380px] overflow-y-auto p-0.5">
                {THEME_PRESETS.map((p) => {
                  const isActive = theme === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onChangeTheme ? onChangeTheme(p.id) : onToggleTheme();
                        setShowThemeMenu(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg border transition-all flex items-start space-x-2.5 ${
                        isActive
                          ? isLight
                            ? 'bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-400'
                            : 'bg-[#1c2c22] border-emerald-500 ring-1 ring-emerald-500'
                          : isLight
                          ? 'bg-stone-50/70 hover:bg-stone-100 border-stone-200/80'
                          : 'bg-[#18231c]/70 hover:bg-[#202f26] border-[#25362b]'
                      }`}
                    >
                      {/* Color Preview Swatch */}
                      <div
                        className="w-7 h-7 rounded-md border shrink-0 flex items-center justify-center relative overflow-hidden mt-0.5"
                        style={{
                          backgroundColor: p.previewBg,
                          borderColor: p.previewBorder,
                        }}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-sm border"
                          style={{
                            backgroundColor: p.previewCard,
                            borderColor: p.previewAccent,
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold truncate">{p.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${p.badgeClass}`}>
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug mt-0.5">
                          {p.description}
                        </p>
                      </div>

                      {isActive && (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        </div>

        {/* Fullscreen Mode Toggle */}
        <button
          onClick={toggleFullscreen}
          className={`hidden xs:flex p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all border shrink-0 active:scale-95 items-center justify-center ${
            isFullscreen
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 border-emerald-300 '
                : 'bg-emerald-950 text-emerald-200 border-emerald-700/60 '
              : isLight
              ? 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200/80'
              : 'bg-[#151f19] hover:bg-[#1d2720] text-emerald-300 border-[#222e25]'
          }`}
          title={isFullscreen ? '全画面モードを解除 (Esc)' : '全画面モード（画面いっぱいに広げて集中制作）'}
        >
          {isFullscreen ? (
            <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 dark:text-emerald-300" />
          ) : (
            <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          )}
        </button>

        {/* Storage & Backup Manager */}
        {onOpenStorageManagerModal && (
          <button
            onClick={onOpenStorageManagerModal}
            className={`hidden md:inline-flex p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-colors shrink-0 ${
              isLight ? 'text-stone-600 hover:bg-stone-100' : 'text-emerald-300 hover:bg-[#1d2720]'
            }`}
            title="保存管理・バックアップ（localStorage容量・スナップショット）"
          >
            <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        )}

        {/* Font Info / Settings */}
        <button
          onClick={onOpenFontInfoModal}
          className={`hidden md:inline-flex p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-colors shrink-0 ${
            isLight ? 'text-stone-600 hover:bg-stone-100' : 'text-emerald-300 hover:bg-[#1d2720]'
          }`}
          title="フォント詳細情報・メトリクス設定"
        >
          <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Export Font Modal Prominent Trigger */}
        <button
          onClick={handleExportTtf}
          className={`px-2 sm:px-2.5 py-1 sm:py-1.5 h-8 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shrink-0 ${themeClasses.accentBtn}`}
          title="OSやiPad・アプリで使えるフォントを出力"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>フォント出力</span>
        </button>
      </div>

      {/* Export Font Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        project={project}
        theme={theme}
        onShowToast={notify}
        onOpenQualityModal={onOpenQualityModal}
        onRequestNewProject={() => {
          setShowExportModal(false);
          setIsConfirmingNew(true);
        }}
      />

      {/* In-app New Project / Reset Confirmation Modal */}
      {isConfirmingNew && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md rounded-2xl p-5 border shadow-xl space-y-4 ${
              isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-[#151e18] border-[#25362b] text-emerald-100'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-stone-200 dark:border-[#25362b]">
              <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-base font-extrabold">新規プロジェクト作成・リセット</h3>
              </div>
              <button
                onClick={() => setIsConfirmingNew(false)}
                className="p-1 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-[#1d2b21] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Project Info Summary Card */}
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 ${
                isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#1a261f] border-[#233328]'
              }`}
            >
              <div className="font-bold text-stone-400 dark:text-stone-400 text-[10px] uppercase tracking-wider">
                現在のフォントデータ
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="font-extrabold text-sm text-stone-800 dark:text-emerald-200">
                  {project.metadata.familyName || '手書きフォント'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] border border-emerald-300 dark:border-emerald-800">
                  作成済み: {glyphCount} 文字
                </span>
              </div>
            </div>

            {/* New Project Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 dark:text-emerald-300 flex items-center space-x-1">
                <Type className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>新しいフォントプロジェクト名</span>
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="例: 新規手書きフォント"
                className={`w-full px-3 py-2 rounded-xl text-xs border font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isLight
                    ? 'bg-stone-50 border-stone-300 text-stone-900'
                    : 'bg-[#101712] border-[#25362b] text-emerald-100'
                }`}
              />
            </div>

            <p className="text-xs opacity-80 leading-relaxed text-stone-600 dark:text-emerald-300/80">
              作成・選択したフォントをリセットして新しいキャンバスを開きます。データ保護のため、<strong>「JSONバックアップして新規リセット」</strong>のご利用をお勧めします。
            </p>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-[#25362b]">
              {/* Primary: Backup JSON & Reset */}
              <button
                onClick={() => {
                  handleSaveProjectJson();
                  handleNewProjectWithCustomName(newProjectName);
                }}
 className="w-full py-2.5 px-3 rounded-xl text-xs font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center space-x-2 transition-all active:scale-98"
              >
                <Save className="w-4 h-4" />
                <span>JSONバックアップを保存して新規作成 (推奨)</span>
              </button>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => setIsConfirmingNew(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    isLight
                      ? 'border-stone-300 text-stone-700 hover:bg-stone-100'
                      : 'border-[#2d4034] text-stone-300 hover:bg-[#1f2d24]'
                  }`}
                >
                  キャンセル
                </button>

                <button
                  onClick={() => handleNewProjectWithCustomName(newProjectName)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all active:scale-98 flex items-center justify-center space-x-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>保存せずに新規リセット</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});
