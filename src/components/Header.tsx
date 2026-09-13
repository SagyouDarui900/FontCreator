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
} from 'lucide-react';
import { FontProject } from '../types';
import { ThemeMode } from '../utils/theme';
import { downloadFont, loadFontFromFile, createDefaultProject } from '../utils/fontCompiler';
import { ExportModal } from './ExportModal';

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
  onOpenRadicalStudio: () => void;
  onToggleRadicals: () => void;
  showRadicals: boolean;
  onToggleGridDrawer: () => void;
  showGridDrawer: boolean;
  onToggleMetricsDrawer?: () => void;
  showMetricsDrawer?: boolean;
  onToggleZenMode?: () => void;
  isZenMode?: boolean;
  onApplyHandwritingPreset?: () => void;
  selectedChar: string;
  selectedUnicode: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
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
  onOpenRadicalStudio,
  onToggleRadicals,
  showRadicals,
  onToggleGridDrawer,
  showGridDrawer,
  onToggleMetricsDrawer,
  showMetricsDrawer,
  onToggleZenMode,
  isZenMode = false,
  onApplyHandwritingPreset,
  selectedChar,
  selectedUnicode,
  theme,
  onToggleTheme,
  onShowToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isConfirmingNew, setIsConfirmingNew] = useState(false);
  const [newProjectName, setNewProjectName] = useState<string>('新規手書きフォント');
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  // セーブデータ (.json) のエクスポート (PC/iPad/スマホ間で移行可能)
  const handleSaveProjectJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    const safeName = (project.metadata.familyName || 'FontProject').replace(/[^a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff-]/g, '_');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${safeName}.fontproj.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setShowToolsMenu(false);
    notify('プロジェクトセーブデータを保存しました', 'success');
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
  const isLight = theme === 'light';

  return (
    <header
      className={`h-13 border-b flex items-center justify-between px-2 sm:px-4 shrink-0 z-30 select-none relative transition-colors ${
        isLight
          ? 'bg-white text-stone-800 border-stone-200 shadow-xs'
          : 'bg-[#121914] text-emerald-100 border-[#222e25] shadow-xs'
      }`}
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
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        <button
          onClick={onToggleGridDrawer}
          className={`px-2.5 py-1.5 rounded-xl transition-colors flex items-center space-x-1.5 text-xs font-bold ${
            showGridDrawer
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-xs'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-xs'
              : isLight
              ? 'text-stone-600 hover:bg-stone-100 border border-stone-200/80'
              : 'text-stone-300 hover:bg-[#1d2720] border border-[#222e25]'
          }`}
          title="文字一覧（コード表）の表示/非表示"
        >
          <Grid className="w-4 h-4" />
          <span className="hidden md:inline">文字一覧</span>
        </button>

        <div className={`h-5 w-[1px] hidden sm:block ${isLight ? 'bg-stone-200' : 'bg-[#222e25]'}`} />

        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-xs tracking-tighter ${
              isLight
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-500 text-stone-950'
            }`}
          >
            FC
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-wide flex items-center space-x-1.5">
              <span className="truncate max-w-[100px] sm:max-w-[160px] md:max-w-[200px]">
                {project.metadata.familyName && project.metadata.familyName !== 'OTEdit-Style Font' && project.metadata.familyName !== '新規フォント'
                  ? project.metadata.familyName
                  : 'FontCreator'}
              </span>
              {project.metadata.styleName && project.metadata.styleName !== 'Regular' && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                    isLight ? 'bg-stone-100 text-stone-700 border border-stone-200' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {project.metadata.styleName}
                </span>
              )}
            </span>
            <span
              className={`text-[10px] font-mono hidden sm:inline ${
                isLight ? 'text-stone-500' : 'text-emerald-400'
              }`}
            >
              編集中: <strong className={isLight ? 'text-emerald-700 font-sans' : 'text-amber-300 font-sans'}>{selectedChar || 'なし'}</strong>{' '}
              (U+{selectedUnicode.toString(16).toUpperCase().padStart(4, '0')}) · {glyphCount}字
            </span>
          </div>
        </div>
      </div>

      {/* Center: Undo/Redo & Quick Actions */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`hidden sm:flex p-1.5 sm:p-2 rounded-xl transition-colors ${
            canUndo
              ? isLight
                ? 'text-stone-700 hover:bg-stone-100 active:scale-95'
                : 'text-emerald-200 hover:bg-[#1d2720] active:scale-95'
              : isLight
              ? 'text-stone-300 cursor-not-allowed'
              : 'text-stone-600 cursor-not-allowed'
          }`}
          title="元に戻す (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`hidden sm:flex p-1.5 sm:p-2 rounded-xl transition-colors ${
            canRedo
              ? isLight
                ? 'text-stone-700 hover:bg-stone-100 active:scale-95'
                : 'text-emerald-200 hover:bg-[#1d2720] active:scale-95'
              : isLight
              ? 'text-stone-300 cursor-not-allowed'
              : 'text-stone-600 cursor-not-allowed'
          }`}
          title="やり直す (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className={`h-5 w-[1px] mx-0.5 sm:mx-1 hidden md:block ${isLight ? 'bg-stone-200' : 'bg-[#222e25]'}`} />

        {/* Test Waterfall Modal (Hidden on small tablets as it is already in Tools Menu and mobile bottom bar) */}
        <button
          onClick={onOpenTestModal}
          className={`hidden md:flex px-2.5 py-1.5 rounded-xl text-xs font-bold items-center space-x-1.5 transition-all shadow-xs active:scale-95 border ${
            isLight
              ? 'bg-stone-100 text-stone-800 hover:bg-stone-200 border-stone-200'
              : 'bg-[#1d2720] text-emerald-200 hover:bg-[#253329] border-[#25362b]'
          }`}
          title="フォント試し打ち・文章プレビュー"
        >
          <Play className="w-3.5 h-3.5 fill-current text-emerald-600 dark:text-emerald-400" />
          <span>試し打ち</span>
        </button>

        {/* Kanji Radicals palette toggle */}
        <button
          id="btn-header-radicals"
          onClick={onToggleRadicals}
          className={`hidden sm:flex px-2.5 py-1.5 rounded-xl text-xs font-semibold items-center space-x-1.5 transition-all active:scale-95 ${
            showRadicals
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300 shadow-xs ring-2 ring-emerald-500/20'
                : 'bg-emerald-600 text-white font-bold shadow-xs ring-2 ring-emerald-400/20'
              : isLight
              ? 'text-stone-700 hover:bg-emerald-50 hover:text-emerald-900 border border-stone-200/90'
              : 'text-stone-300 hover:bg-[#1d2720] hover:text-emerald-200 border border-[#222e25]'
          }`}
          title="部首・パーツパレット (高品質部首・フォント抽出・康熙214部首)"
        >
          <Sparkles className={`w-3.5 h-3.5 ${showRadicals ? 'text-emerald-700 dark:text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}`} />
          <span className="hidden md:inline font-bold">部首</span>
        </button>

        {/* Toggle Metrics Drawer */}
        {onToggleMetricsDrawer && (
          <button
            onClick={onToggleMetricsDrawer}
            className={`hidden md:flex px-2.5 py-1.5 rounded-xl text-xs font-semibold items-center space-x-1 transition-colors ${
              showMetricsDrawer
                ? isLight
                  ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300'
                  : 'bg-emerald-600 text-white font-bold'
                : isLight
                ? 'text-stone-600 hover:bg-stone-100 border border-stone-200/80'
                : 'text-stone-300 hover:bg-[#1d2720] border border-[#222e25]'
            }`}
            title="メトリクス・変形パネル"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">メトリクス</span>
          </button>
        )}

        {/* Wide / Zen Mode Toggle */}
        {onToggleZenMode && (
          <button
            onClick={onToggleZenMode}
            className={`hidden lg:flex px-2.5 py-1.5 rounded-xl text-xs font-semibold items-center space-x-1 transition-all ${
              isZenMode
                ? isLight
                  ? 'bg-emerald-700 text-white font-bold shadow-xs'
                  : 'bg-emerald-500 text-stone-950 font-bold shadow-xs'
                : isLight
                ? 'text-stone-600 hover:bg-stone-100 border border-stone-200/80'
                : 'text-stone-300 hover:bg-[#1d2720] border border-[#222e25]'
            }`}
            title="全面作図・集中モード (サイドバー収納)"
          >
            {isZenMode ? (
              <>
                <Minimize className="w-3.5 h-3.5" />
                <span>標準表示</span>
              </>
            ) : (
              <>
                <Maximize className="w-3.5 h-3.5" />
                <span>全面作図</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Right: Tools Dropdown & Theme & Save & TTF Export */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
        {/* Unified Tools Dropdown */}
        <div className="relative" ref={toolsMenuRef}>
          <button
            onClick={() => setShowToolsMenu(!showToolsMenu)}
            className={`px-2.5 sm:px-3 py-1.5 h-9 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs border active:scale-95 ${
              showToolsMenu
                ? isLight
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-emerald-950 text-emerald-200 border-emerald-700/60 ring-2 ring-emerald-400/20'
                : isLight
                ? 'bg-white hover:bg-emerald-50/70 text-stone-700 hover:text-emerald-900 border-stone-200 hover:border-emerald-300'
                : 'bg-[#151f19] hover:bg-[#1d2b22] text-emerald-200 border-[#25362b] hover:border-emerald-700/60'
            }`}
            title="拡張ツール・制作スタジオ・ファイル管理メニュー"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold">機能メニュー</span>
            <span
              className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                isLight
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-[#1a2d21] text-emerald-300 border border-emerald-800'
              }`}
            >
              12
            </span>
            <span
              className={`text-[9px] opacity-70 transition-transform duration-150 ${
                showToolsMenu ? 'rotate-180' : ''
              }`}
            >
              ▾
            </span>
          </button>

          {showToolsMenu && (
            <div
              className={`absolute right-0 top-full mt-2 w-[350px] sm:w-[460px] md:w-[500px] max-h-[calc(100vh-72px)] overflow-y-auto overscroll-contain rounded-2xl shadow-2xl border p-2.5 sm:p-3.5 z-50 flex flex-col gap-2.5 animate-in fade-in duration-150 ${
                isLight
                  ? 'bg-white/98 backdrop-blur-md border-stone-200 text-stone-800 shadow-xl'
                  : 'bg-[#151f19]/98 backdrop-blur-md border-[#25362b] text-emerald-100 shadow-xl'
              }`}
            >
              {/* Menu Header with Count and Close Button */}
              <div className="flex items-center justify-between px-1 pb-1.5 border-b border-stone-200/80 dark:border-[#223025]">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold tracking-tight">機能・制作スタジオ</span>
                    <span className="ml-1.5 text-[10px] text-stone-400 dark:text-emerald-400 font-normal">
                      全12ツール
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
                    ? 'bg-emerald-50/70 hover:bg-emerald-100/70 border-emerald-200 text-emerald-950 shadow-xs'
                    : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-800/60 text-emerald-200 shadow-xs'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
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
                      ? 'bg-amber-50/70 hover:bg-amber-100/80 border-amber-200 text-amber-950 shadow-xs'
                      : 'bg-amber-950/30 hover:bg-amber-900/40 border-amber-800/60 text-amber-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Paintbrush className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center space-x-1.5">
                        <span>手書きフォント最適化設定を適用</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-600 text-white font-mono font-normal">
                          ワンクリック
                        </span>
                      </div>
                      <div className="text-[10px] text-stone-500 dark:text-amber-300/80">
                        毛筆38px・高感度筆圧・十文字字面枠・手振れ補正ON
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
                  <span>制作 & 高度自動化スタジオ</span>
                  <span className="text-[9px] font-normal lowercase">7 tools</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-0.5">
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
          )}
        </div>

        {/* Dark/Light Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className={`p-2 rounded-xl transition-colors ${
            isLight ? 'text-stone-600 hover:bg-stone-100' : 'text-emerald-300 hover:bg-[#1d2720]'
          }`}
          title={isLight ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
        >
          {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-300" />}
        </button>

        {/* Reset Project Button */}
        <button
          id="btn-header-reset-project"
          onClick={() => setIsConfirmingNew(true)}
          className={`hidden sm:flex px-2.5 py-1.5 rounded-xl text-xs font-semibold items-center space-x-1.5 transition-all border ${
            isLight
              ? 'bg-stone-100 hover:bg-rose-50 text-stone-700 hover:text-rose-700 border-stone-200 hover:border-rose-300 active:scale-95'
              : 'bg-[#1e2c22] hover:bg-[#2b1b20] text-emerald-200 hover:text-rose-300 border-[#25362b] hover:border-rose-800 active:scale-95'
          }`}
          title="プロジェクトをリセット・白紙から新規作成"
        >
          <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden lg:inline">リセット</span>
        </button>

        {/* Save JSON Data */}
        <button
          onClick={handleSaveProjectJson}
          className={`hidden sm:flex px-3 py-1.5 rounded-xl text-xs font-semibold items-center space-x-1.5 transition-colors border ${
            isLight
              ? 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-200'
              : 'bg-[#1e2c22] hover:bg-[#283b2e] text-emerald-200 border-[#25362b]'
          }`}
          title="セーブデータファイルを出力 (.json)"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden md:inline">保存</span>
        </button>

        {/* Font Info / Settings */}
        <button
          onClick={onOpenFontInfoModal}
          className={`p-2 rounded-xl transition-colors ${
            isLight ? 'text-stone-600 hover:bg-stone-100' : 'text-emerald-300 hover:bg-[#1d2720]'
          }`}
          title="フォント詳細情報・メトリクス設定"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Export Font Modal Prominent Trigger */}
        <button
          onClick={handleExportTtf}
          className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1 sm:space-x-1.5 transition-all shadow-md active:scale-95 shrink-0 ${
            isLight
              ? 'bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold shadow-xs'
              : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold shadow-xs'
          }`}
          title="OSやiPad・アプリで使えるフォントを出力"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">フォント</span>
          <span>出力</span>
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
            className={`w-full max-w-md rounded-2xl p-5 border shadow-2xl space-y-4 ${
              isLight ? 'bg-white border-stone-200 text-stone-900 shadow-xl' : 'bg-[#151e18] border-[#25362b] text-emerald-100 shadow-xl'
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
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
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
                className="w-full py-2.5 px-3 rounded-xl text-xs font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white shadow-md flex items-center justify-center space-x-2 transition-all active:scale-98"
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
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-all active:scale-98 flex items-center justify-center space-x-1"
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
