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

interface VendorDocument extends Document {
 webkitFullscreenElement?: Element | null;
 mozFullScreenElement?: Element | null;
 msFullscreenElement?: Element | null;
 webkitExitFullscreen?: () => Promise<void>;
 mozCancelFullScreen?: () => Promise<void>;
 msExitFullscreen?: () => Promise<void>;
}

interface VendorDocumentElement extends HTMLElement {
 webkitRequestFullscreen?: () => Promise<void>;
 mozRequestFullScreen?: () => Promise<void>;
 msRequestFullscreen?: () => Promise<void>;
}

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
 const vendorDocument = document as VendorDocument;
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
 vendorDocument.webkitFullscreenElement ||
 vendorDocument.mozFullScreenElement ||
 vendorDocument.msFullscreenElement
 );
 });

 useEffect(() => {
 const handleFullscreenChange = () => {
 const isFs = !!(
 document.fullscreenElement ||
 vendorDocument.webkitFullscreenElement ||
 vendorDocument.mozFullScreenElement ||
 vendorDocument.msFullscreenElement
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
 vendorDocument.webkitFullscreenElement ||
 vendorDocument.mozFullScreenElement ||
 vendorDocument.msFullscreenElement
 );

 if (!isCurrentlyFs) {
 const docEl = document.documentElement as VendorDocumentElement;
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
 const doc = vendorDocument;
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
 className={`min-h-[44px] h-[calc(2.75rem+env(safe-area-inset-top,0px))] sm:h-[calc(3rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] border-b flex items-center justify-between px-2 sm:px-3 shrink-0 z-40 select-none relative transition-colors overflow-x-auto no-scrollbar gap-1.5 sm:gap-2 ${themeClasses.headerBg}`}
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
 <div className="flex items-center gap-1 sm:gap-1.5 shrink min-w-0">
 <button
 onClick={onToggleGridDrawer}
 className={`h-8 px-2 sm:px-2.5 rounded-lg sm:rounded-xl transition-colors inline-flex items-center gap-1 text-xs font-bold shrink-0 border ${
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

 {/* Brand & Project Info (Compact on tablet/mobile) */}
 <div className="flex items-center gap-1.5 shrink min-w-0">
 <div className="flex flex-col min-w-0 justify-center">
 <span className="text-xs font-bold tracking-tight flex items-center gap-1.5 min-w-0 leading-tight">
 <span className="truncate max-w-[65px] xs:max-w-[95px] sm:max-w-[130px] md:max-w-[160px] lg:max-w-[200px]">
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
 className={`text-[9.5px] font-mono hidden lg:inline truncate leading-tight ${
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
 className={`h-6 px-1.5 rounded-md sm:rounded-lg transition-all inline-flex items-center gap-1 border text-[10px] font-bold shrink-0 ${
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
 className={`h-8 px-2 sm:px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all active:scale-95 border shrink-0 ${
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
 className={`h-8 px-2 rounded-lg text-xs font-bold hidden lg:inline-flex items-center gap-1 transition-all border active:scale-95 ${
 isLight
 ? 'bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-900 border-emerald-200 hover:border-emerald-300'
 : 'bg-[#1a2d21] hover:bg-[#223b2c] text-emerald-200 border-emerald-800/60 hover:border-emerald-700'
 }`}
 title="説明書・チュートリアル・ショートカット集 [?]"
 >
 <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
 <span className="leading-none">説明書・ガイド</span>
 <kbd className="hidden xl:inline-block px-1 py-0.2 rounded text-[10px] font-mono font-bold bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 leading-none">
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
 <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
 {/* Metrics Panel toggle (Desktop & Tablet) */}
 {onToggleMetricsDrawer && (
 <button
 id="btn-header-metrics"
 onClick={onToggleMetricsDrawer}
 className={`px-2 py-1 h-8 rounded-lg text-xs font-bold hidden md:inline-flex items-center gap-1 transition-all border active:scale-95 cursor-pointer shrink-0 ${
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
 <span className="font-bold leading-none hidden xl:inline">メトリクス</span>
 </button>
 )}

 {/* Unified Tools Dropdown */}
 <div className="relative shrink-0" ref={toolsMenuRef}>
 <button
 onClick={() => setShowToolsMenu(!showToolsMenu)}
 className={`px-2 sm:px-2.5 py-1 sm:py-1.5 h-8 rounded-lg sm:rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border active:scale-95 shrink-0 ${
 showToolsMenu
 ? isLight
 ? 'bg-emerald-100 text-emerald-950 border-emerald-300 ring-2 ring-emerald-500/20'
 : 'bg-emerald-950 text-emerald-200 border-emerald-700/60 ring-2 ring-emerald-400/20'
 : isLight
 ? 'bg-white hover:bg-emerald-50/70 text-stone-700 hover:text-emerald-900 border-stone-200 hover:border-emerald-300'
 : 'bg-[#151f19] hover:bg-[#1d2b22] text-emerald-200 border-[#25362b] hover:border-emerald-700/60'
 }`}
 title="機能メニュー"
 >
 <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
 <span className="font-bold leading-none">機能</span>
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
 className="fixed inset-0 z-50 bg-black/40"
 onClick={() => setShowToolsMenu(false)}
 />
 <div
 style={{
 maxHeight: 'calc(100vh - 56px)',
 paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 24px)',
 }}
 className={`fixed right-1 sm:right-4 top-[48px] sm:top-[54px] w-[calc(100vw-8px)] sm:w-[460px] md:w-[480px] overflow-y-auto overscroll-contain rounded-2xl border p-3 sm:p-3.5 z-50 flex flex-col gap-3 animate-in fade-in duration-150 ${
 isLight
 ? 'bg-white border-stone-200 text-stone-800 shadow-xl'
 : 'bg-[#151f19] border-[#25362b] text-emerald-100 shadow-xl'
 }`}
 >
 {/* Menu Header */}
 <div className="flex items-center justify-between px-0.5 pb-2 border-b border-stone-200/80 dark:border-[#223025]">
 <div className="flex items-center space-x-2">
 <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
 <Sliders className="w-3.5 h-3.5" />
 </div>
 <span className="text-xs font-bold tracking-tight">機能メニュー</span>
 </div>
 <button
 onClick={() => setShowToolsMenu(false)}
 className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#202d24] transition-colors cursor-pointer"
 title="閉じる"
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
 className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer group ${
 isLight
 ? 'bg-emerald-50/80 hover:bg-emerald-100/80 border-emerald-200 text-emerald-950'
 : 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-800/60 text-emerald-200'
 }`}
 >
 <div className="flex items-center space-x-2.5">
 <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
 <Download className="w-4 h-4" />
 </div>
 <div>
 <div className="text-xs font-bold">フォントを出力 (TTF / OTF)</div>
 <div className="text-[10.5px] text-stone-500 dark:text-emerald-300/80">
 インストール用・ダウンロード用フォントファイルの書き出し
 </div>
 </div>
 </div>
 <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 pr-1 shrink-0">
 出力 ➔
 </span>
 </button>

 {/* Mobile Metrics Panel Trigger */}
 {onToggleMetricsDrawer && (
 <button
 onClick={() => {
 onToggleMetricsDrawer();
 setShowToolsMenu(false);
 }}
 className={`w-full sm:hidden p-2 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
 showMetricsDrawer
 ? isLight
 ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
 : 'bg-emerald-950 text-emerald-200 border-emerald-700/60'
 : isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] text-emerald-200'
 }`}
 >
 <div className="flex items-center space-x-2">
 <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
 <div>
 <div className="text-xs font-bold">メトリクスパネル</div>
 <div className="text-[10px] text-stone-500 dark:text-stone-400">
 {showMetricsDrawer ? '表示中 (タップで閉じる)' : '文字枠・送り幅の調整'}
 </div>
 </div>
 </div>
 <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
 {showMetricsDrawer ? '閉じる' : '開く ➔'}
 </span>
 </button>
 )}

 {/* Section 1: 作字・編集ツール */}
 <div>
 <div className="px-1 pb-1 text-[10px] font-bold text-stone-400 dark:text-emerald-500 uppercase tracking-wider">
 作字・編集ツール
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-0.5">
 {/* Pixel Font */}
 {onOpenPixelStudio && (
 <button
 onClick={() => {
 onOpenPixelStudio();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform text-xs font-bold">
 <Grid className="w-3.5 h-3.5" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">ピクセルフォント</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 ドット絵形式の作字・グリッド編集
 </div>
 </div>
 </button>
 )}

 {/* Radical / Parts */}
 <button
 onClick={() => {
 onOpenRadicalStudio();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <Shapes className="w-4 h-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">部首・パーツ</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 漢字の偏や旁の作成・再利用
 </div>
 </div>
 </button>

 {/* Custom Pen Creation */}
 {onOpenPenPresetsModal && (
 <button
 onClick={() => {
 onOpenPenPresetsModal();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <Sliders className="w-4 h-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">カスタムペン</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 筆先形状・入り抜き・筆圧設定
 </div>
 </div>
 </button>
 )}

 {/* Image / Photo Trace */}
 <button
 onClick={() => {
 onOpenTraceModal();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <Layers className="w-4 h-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">下絵トレース</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 手書きノートや画像からの輪郭抽出
 </div>
 </div>
 </button>

 {/* SVG Vectorizer Import */}
 <button
 onClick={() => {
 onOpenSvgModal();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer col-span-1 sm:col-span-2 ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <FileCode className="w-4 h-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">SVGインポート</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 ベクター画像（SVG）のパス取り込み
 </div>
 </div>
 </button>
 </div>
 </div>

 {/* Section 2: 自動化・フォント調整 */}
 <div>
 <div className="px-1 pb-1 text-[10px] font-bold text-stone-400 dark:text-emerald-500 uppercase tracking-wider">
 自動化・フォント調整
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-0.5">
 {/* Glyph Synthesis */}
 {onOpenGlyphSynthesisModal && (
 <button
 onClick={() => {
 onOpenGlyphSynthesisModal();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <Wand2 className="w-4 h-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">濁点・小書き合成</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 清音から濁音・促音・拗音を一括生成
 </div>
 </div>
 </button>
 )}

 {/* Batch Normalize */}
 <button
 onClick={() => {
 onOpenBatchNormalizeModal();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <Sliders className="w-4 h-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">サイズ・太さ統一</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 字面枠や線の太さの一括正規化
 </div>
 </div>
 </button>

 {/* Weight Interpolation */}
 {onOpenWeightInterpolationModal && (
 <button
 onClick={() => {
 onOpenWeightInterpolationModal();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <Sliders className="w-4 h-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">ウェイト補間</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 太さの異なるファミリー書体を生成
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
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <ArrowLeftRight className="w-4 h-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">カーニング調整</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 文字ペアの間隔・余白設定
 </div>
 </div>
 </button>
 )}

 {/* Quality Check */}
 {onOpenQualityModal && (
 <button
 onClick={() => {
 onOpenQualityModal();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <ShieldCheck className="w-4 h-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">品質チェック</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 重複ノード・極点・パス交差の検査
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
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <Eye className="w-4 h-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">グリフ比較</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 複数文字の重ね合わせバランス確認
 </div>
 </div>
 </button>
 )}

 {/* OpenType Features */}
 {onOpenOpenTypeFeaturesModal && (
 <button
 onClick={() => {
 onOpenOpenTypeFeaturesModal();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <FileCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">縦書き・合字</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 縦書き用グリフと合字 (OpenType) 設定
 </div>
 </div>
 </button>
 )}

 {/* Grid Fitting */}
 {onOpenGridFittingModal && (
 <button
 onClick={() => {
 onOpenGridFittingModal();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-start space-x-2 group cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-300 text-stone-900'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] hover:border-emerald-700/60 text-emerald-100'
 }`}
 >
 <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#1a2920] text-emerald-700 dark:text-emerald-300 border border-stone-200/80 dark:border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
 <Grid className="w-4 h-4 text-amber-600 dark:text-amber-400" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs font-bold truncate">グリッド整列</div>
 <div className="text-[10.5px] text-stone-500 dark:text-stone-400 leading-snug">
 低解像度向けの自動ヒンティング
 </div>
 </div>
 </button>
 )}
 </div>
 </div>

 {/* Section 3: ファイル・設定 */}
 <div className="pt-1 border-t border-stone-200/80 dark:border-[#223025]">
 <div className="px-1 pb-1 text-[10px] font-bold text-stone-400 dark:text-emerald-500 uppercase tracking-wider">
 ファイル・設定
 </div>
 <div className="grid grid-cols-2 gap-1.5 mt-0.5">
 <button
 onClick={() => {
 fileInputRef.current?.click();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 cursor-pointer ${
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
 className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 cursor-pointer ${
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
 className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 cursor-pointer ${
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
 className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
 : 'bg-[#1a251e] hover:bg-[#202d24] border-[#25362b] text-emerald-200'
 }`}
 >
 <Scale className="w-3.5 h-3.5 text-amber-500 shrink-0" />
 <span className="text-xs font-medium truncate">フォント情報・設定</span>
 </button>

 {onOpenStorageManagerModal && (
 <button
 onClick={() => {
 onOpenStorageManagerModal();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 col-span-2 cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] text-emerald-200'
 }`}
 >
 <HardDrive className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
 <div className="flex-1 min-w-0">
 <div className="text-xs font-medium truncate">保存管理・バックアップ</div>
 <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
 ストレージ容量・履歴スナップショット
 </div>
 </div>
 </button>
 )}

 {onOpenShortcutsModal && (
 <button
 onClick={() => {
 onOpenShortcutsModal();
 setShowToolsMenu(false);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 col-span-2 cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] text-emerald-200'
 }`}
 >
 <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
 <span className="text-xs font-medium truncate">ショートカット・操作ガイド</span>
 </button>
 )}

 {/* Theme switcher option for mobile & accessibility */}
 <button
 onClick={() => {
 setShowToolsMenu(false);
 setShowThemeMenu(true);
 }}
 className={`text-left p-2 rounded-xl border transition-all flex items-center space-x-2 col-span-2 cursor-pointer ${
 isLight
 ? 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
 : 'bg-[#18271e] hover:bg-[#203428] border-[#25362b] text-emerald-200'
 }`}
 >
 <Palette className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
 <div className="flex-1 min-w-0">
 <div className="text-xs font-medium truncate">カラーテーマ・目の保護</div>
 <div className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
 現在のテーマ: {getThemePreset(theme).name}
 </div>
 </div>
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
 className="w-full text-left px-2.5 py-1.5 text-xs rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2 font-medium transition-colors cursor-pointer"
 >
 <FilePlus className="w-3.5 h-3.5 shrink-0" />
 <span>新規プロジェクト作成</span>
 </button>
 </div>
 </div>
 </>
 )}
 </div>

 {/* In-App PWA Install Button (Desktop & Tablet) */}
 <div className="hidden sm:flex items-center">
 <PWAInstallButton isLight={isLight} />
 </div>

 {/* Theme Preset Selector Dropdown Trigger (Visible on all screen sizes) */}
 <div className="relative shrink-0" ref={themeMenuRef}>
 <button
 onClick={() => setShowThemeMenu((prev) => !prev)}
 className={`p-1.5 sm:p-2 h-8 rounded-lg sm:rounded-xl transition-all flex items-center space-x-1 border ${
 isLight
 ? 'bg-stone-100/80 hover:bg-stone-200/80 text-stone-700 border-stone-200/90'
 : 'bg-[#18241d] hover:bg-[#203027] text-emerald-300 border-[#25362b]'
 }`}
 title="カラーテーマ・目の保護（セピア/ブルーライトカット）の切り替え"
 >
 <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 dark:text-amber-400 shrink-0" />
 <span className="hidden xl:inline text-[11px] font-bold">
 {getThemePreset(theme).name.split(' ')[0]}
 </span>
 <ChevronDown className="w-3 h-3 opacity-60 hidden xl:inline" />
 </button>

 {/* Global Theme Selector Popover Menu */}
 {showThemeMenu && (
 <>
 <div
 className="fixed inset-0 z-50 bg-black/40"
 onClick={() => setShowThemeMenu(false)}
 />
 <div
 onPointerDown={(e) => e.stopPropagation()}
 onTouchStart={(e) => e.stopPropagation()}
 className={`fixed right-2 sm:right-16 top-[48px] sm:top-[52px] w-[calc(100vw-16px)] sm:w-80 max-w-sm rounded-2xl border shadow-2xl z-50 p-3 text-left ${themeClasses.cardBg}`}
 >
 <div className="px-1 py-1 border-b border-stone-200/80 dark:border-stone-800/80 flex items-center justify-between mb-2">
 <div className="flex items-center space-x-1.5">
 <Palette className="w-4 h-4 text-amber-500" />
 <span className="text-xs font-bold">テーマ・目への優しさ設定</span>
 </div>
 <button
 onClick={() => setShowThemeMenu(false)}
 className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#202d24] transition-colors cursor-pointer"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 <div className="space-y-1.5 max-h-[380px] overflow-y-auto p-0.5">
 {THEME_PRESETS.map((p) => {
 const isActive = theme === p.id;
 return (
 <button
 key={p.id}
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 if (onChangeTheme) {
 onChangeTheme(p.id);
 } else {
 onToggleTheme();
 }
 notify(`テーマを「${p.name}」に変更しました`, 'info');
 setShowThemeMenu(false);
 }}
 className={`w-full text-left p-2 rounded-xl border flex items-start space-x-2.5 cursor-pointer ${
 isActive
 ? isLight
 ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400/50'
 : 'bg-[#1c2c22] border-emerald-500 ring-2 ring-emerald-500/50'
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
 className={`hidden md:flex p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all border shrink-0 active:scale-95 items-center justify-center ${
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
 className={`hidden xl:inline-flex p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-colors shrink-0 ${
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
 className={`hidden lg:inline-flex p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-colors shrink-0 ${
 isLight ? 'text-stone-600 hover:bg-stone-100' : 'text-emerald-300 hover:bg-[#1d2720]'
 }`}
 title="フォント詳細情報・メトリクス設定"
 >
 <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
 </button>

 {/* Export Font Modal Prominent Trigger */}
 <button
 onClick={handleExportTtf}
 className={`px-2.5 sm:px-3 py-1 sm:py-1.5 h-8 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0 shadow-xs ${themeClasses.accentBtn}`}
 title="OSやiPad・アプリで使えるフォントを出力 (TTF/OTF/WOFF)"
 >
 <Download className="w-3.5 h-3.5 shrink-0" />
 <span className="leading-none whitespace-nowrap">
 <span className="hidden sm:inline">フォント</span>出力
 </span>
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
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
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
