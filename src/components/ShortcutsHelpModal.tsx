import React, { useState, useMemo, useEffect } from 'react';
import {
  Keyboard,
  X,
  Search,
  Paintbrush,
  PenTool,
  Move,
  Maximize2,
  Minimize2,
  Undo2,
  BookOpen,
  Sparkles,
  Layers,
  Download,
  HelpCircle,
  FileCode,
  ShieldCheck,
  Wand2,
  ArrowLeftRight,
  Shapes,
  CheckCircle2,
  Lightbulb,
  ExternalLink,
  Laptop,
  Tablet,
  Grid,
  Sliders,
  Database,
  Hand,
  Book,
  Mouse,
} from 'lucide-react';
import { ThemeMode, isLightTheme } from '../utils/theme';
import { BeginnerTutorialTab } from './help/BeginnerTutorialTab';
import { GlossaryTab } from './help/GlossaryTab';
import { FeedbackTab } from './help/FeedbackTab';
import { Github, MessageSquare } from 'lucide-react';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
  initialTab?: 'tutorial' | 'glossary' | 'features' | 'shortcuts' | 'faq' | 'feedback';
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'tools' | 'drawing' | 'view' | 'nav' | 'edit' | 'mouse';
  badge?: string;
}

const SHORTCUTS: ShortcutItem[] = [
  // マウス・ホイール・クリック操作
  { keys: ['通常ホイール'], description: '画面の上下スクロール移動 (Pan Y)', category: 'mouse', badge: '基本' },
  { keys: ['Shift', '+', 'ホイール'], description: '画面の左右スクロール移動 (Pan X)', category: 'mouse' },
  { keys: ['Ctrl / ⌘', '+', 'ホイール'], description: 'マウスカーソル位置を中心とした拡大・縮小（10%〜3200%）', category: 'mouse', badge: '便利' },
  { keys: ['Alt', '+', 'ホイール'], description: '筆太さ・消しゴムサイズの直感的ホイール拡大縮小調整', category: 'mouse', badge: '直感操作' },
  { keys: ['中ボタン (ホイール押し込みドラッグ)'], description: 'ツール切り替え不要でキャンバスを自由にパン移動（手のひら）', category: 'mouse', badge: 'おすすめ' },
  { keys: ['Space', '+', '左ドラッグ'], description: '一時的に手のひらツールになりキャンバスを高速パン移動', category: 'mouse' },
  { keys: ['パスをダブルクリック'], description: '当該輪郭の全ノード選択＆ノード編集モード（アンカー・ハンドル編集）へ自動切替', category: 'mouse', badge: '時短' },
  { keys: ['Shift', '+', '左クリック (選択時)'], description: '複数輪郭パーツの追加選択・除外（複数選択トグル）', category: 'mouse' },
  { keys: ['Shift', '+', '左ドラッグ (筆描画時)'], description: '直前位置から水平・垂直・45度への直線引きアシスト', category: 'mouse' },

  // ツール切替
  { keys: ['B'], description: '筆・毛筆ブラシツールに切り替え', category: 'tools', badge: '手書き' },
  { keys: ['P'], description: 'ベクターペンツール（ベジェ曲線）に切り替え', category: 'tools', badge: 'ベジェ' },
  { keys: ['V'], description: '選択・移動ツールに切り替え', category: 'tools' },
  { keys: ['A'], description: 'ノード編集・ダイレクト選択ツールに切り替え', category: 'tools' },
  { keys: ['E'], description: '消しゴムツールに切り替え', category: 'tools' },
  { keys: ['U', 'または', 'S'], description: '長方形ツールに切り替え', category: 'tools' },
  { keys: ['O'], description: '楕円・円ツールに切り替え', category: 'tools' },
  { keys: ['R'], description: '定規・距離計測ツールに切り替え', category: 'tools' },
  { keys: ['H'], description: '手のひらツール（キャンバス移動）に切り替え', category: 'tools' },

  // 描画・編集操作
  { keys: ['Ctrl / ⌘', '+', 'C'], description: '選択した輪郭パスをクリップボードにコピー', category: 'drawing', badge: '便利' },
  { keys: ['Ctrl / ⌘', '+', 'X'], description: '選択した輪郭パスをクリップボードに切り取り', category: 'drawing' },
  { keys: ['Ctrl / ⌘', '+', 'V'], description: 'クリップボードの輪郭パスを現在の文字に貼り付け', category: 'drawing', badge: '便利' },
  { keys: ['Ctrl / ⌘', '+', 'D'], description: '選択した輪郭パスをその場で複製', category: 'drawing' },
  { keys: ['↑', '↓', '←', '→'], description: '選択したパスやノードを矢印キーで微動（Shiftで10px単位）', category: 'drawing' },
  { keys: ['['], description: 'ブラシ / 消しゴムの太さを細く (-2px)', category: 'drawing' },
  { keys: [']'], description: 'ブラシ / 消しゴムの太さを太く (+2px)', category: 'drawing' },
  { keys: ['Shift', '+', '['], description: 'ブラシサイズを大幅に縮小 (-10px)', category: 'drawing' },
  { keys: ['Shift', '+', ']'], description: 'ブラシサイズを大幅に拡大 (+10px)', category: 'drawing' },
  { keys: ['Shift', '+', 'ドラッグ'], description: '水平・垂直・45度の直線ストロークを描画', category: 'drawing', badge: '手書き便利' },
  { keys: ['Enter'], description: 'ペンツールでのパス作成を確定・輪郭を閉じる', category: 'drawing' },
  { keys: ['Ctrl / ⌘', '+', 'Z'], description: '描画中に直前のノード配置や操作を取り消す', category: 'drawing' },
  { keys: ['Delete', '/', 'Backspace'], description: '選択中の輪郭、または選択ノードを削除', category: 'drawing' },
  { keys: ['Ctrl / ⌘', '+', 'A'], description: '現在の文字のすべての輪郭パスを選択', category: 'drawing' },
  { keys: ['Alt', '+', 'S'], description: 'パスの単純化（頂点数を減らし滑らかに最適化）', category: 'drawing', badge: '最適化' },
  { keys: ['Shift', '+', 'Alt', '+', 'S'], description: '左右余白（サイドベアリング）自動設定', category: 'drawing', badge: '自動設定' },

  // モーダル・ダイアログの即時呼び出し
  { keys: ['Ctrl / ⌘', '+', 'E', 'または', 'Alt + E'], description: 'フォント書き出しモーダル（TTF / WOFF / SVG）を開く', category: 'tools', badge: '書き出し' },
  { keys: ['Alt', '+', 'T'], description: '試し打ち・文章プレビュー画面を開く', category: 'tools', badge: 'プレビュー' },
  { keys: ['Alt', '+', 'Q'], description: 'フォント品質検査・自動診断画面を開く', category: 'tools', badge: '品質診断' },
  { keys: ['Alt', '+', 'I'], description: 'フォント情報・基本メトリクス設定を開く', category: 'tools' },
  { keys: ['Alt', '+', 'K'], description: 'カーニング（文字間ペア調整）画面を開く', category: 'tools' },
  { keys: ['Alt', '+', 'M'], description: 'ストレージ管理・バックアップ復元画面を開く', category: 'tools' },

  // 表示・ズーム・レイアウト
  { keys: ['Space', '+', 'ドラッグ'], description: '一時的に手のひらツールになりキャンバスをパン移動', category: 'view', badge: '必須' },
  { keys: ['0'], description: 'キャンバス全体を画面に最適フィット', category: 'view' },
  { keys: ['1'], description: '原寸・等倍表示 (100%)', category: 'view' },
  { keys: ['W'], description: 'キャンバス幅いっぱいに拡大フィット', category: 'view' },
  { keys: ['+'], description: 'ズームイン (拡大)', category: 'view' },
  { keys: ['-'], description: 'ズームアウト (縮小)', category: 'view' },
  { keys: ['Z', 'または', 'Shift + Z'], description: '全面作図・集中モード (サイドバーの収納/展開)', category: 'view', badge: '集中' },
  { keys: ['F'], description: 'フォント品質・プレビュー・ヒートマップの全画面切替', category: 'view', badge: '全画面' },
  { keys: ['\\'], description: '文字一覧サイドバーの開閉', category: 'view' },
  { keys: ['Shift', '+', 'O', 'または', 'Alt + O'], description: 'パス輪郭のみ表示（ワイヤーフレーム表示 / 塗りつぶし）の切り替え', category: 'view', badge: '輪郭モード' },
  { keys: ['N'], description: 'パス頂点（ノード）とハンドルの表示 / 非表示切り替え', category: 'view', badge: '頂点表示' },
  { keys: ['G'], description: '方眼グリッドの表示 / 非表示切り替え', category: 'view' },
  { keys: ['Alt', '+', '+'], description: '方眼グリッドのマス目サイズを拡大 (+5px)', category: 'view' },
  { keys: ['Alt', '+', '-'], description: '方眼グリッドのマス目サイズを縮小 (-5px)', category: 'view' },

  // 各専用モーダル内の効率ショートカット
  { keys: ['R'], description: '【品質診断】フォントの品質を再スキャン / 【ストレージ】再読込', category: 'view' },
  { keys: ['H'], description: '【品質診断】過密アンカー文字の輪郭密度ヒートマップ診断を即起動', category: 'view', badge: 'ヒートマップ' },
  { keys: ['/'], description: '【品質診断】文字・Unicode検索バーにフォーカス', category: 'view' },
  { keys: ['1 ~ 7'], description: '【品質診断】検査カテゴリ（重複・交差・過密・極値等）を瞬時に切替', category: 'view' },
  { keys: ['Enter'], description: '【ヒートマップ診断】表示中文字の全過密輪郭を一括安全単純化', category: 'drawing', badge: '一括単純化' },
  { keys: ['1 / 2 / 3'], description: '【ヒートマップ診断】単純化強度（軽度 2px / 標準 3.5px / 強力 5px）を切替', category: 'drawing' },
  { keys: ['P'], description: '【ヒートマップ診断】アンカー密集度ドットの表示 / 非表示切替', category: 'drawing' },

  // 文字送り・ナビゲーション
  { keys: ['Alt', '+', '→', '/', 'PageDown'], description: '次の文字へ進む（五十音順・漢字順）', category: 'nav', badge: '連続作字' },
  { keys: ['Alt', '+', '←', '/', 'PageUp'], description: '前の文字へ戻る', category: 'nav' },
  { keys: ['Alt', '+', 'N'], description: '次の「未作成の文字」へスキップ', category: 'nav', badge: '効率化' },
  { keys: ['Alt', '+', 'P'], description: '前の「未作成の文字」へスキップ', category: 'nav' },

  // 編集・プロジェクト保存
  { keys: ['Ctrl / ⌘', '+', 'Z'], description: '元に戻す (Undo)', category: 'edit' },
  { keys: ['Ctrl / ⌘', '+', 'Shift', '+', 'Z'], description: 'やり直す (Redo)', category: 'edit' },
  { keys: ['Ctrl / ⌘', '+', 'Y'], description: 'やり直す (Redo)', category: 'edit' },
  { keys: ['Ctrl / ⌘', '+', 'S'], description: 'プロジェクトをブラウザに即時保存', category: 'edit', badge: '保存' },
  { keys: ['Esc'], description: 'パス描画中止 / 選択解除 / モーダルを閉じる', category: 'edit' },
  { keys: ['?'], description: 'この説明書・ショートカット集を開く', category: 'edit' },
];

const SHORTCUT_CATEGORIES = [
  { id: 'all', label: 'すべて', icon: Keyboard },
  { id: 'mouse', label: 'マウス・ホイール', icon: Mouse },
  { id: 'tools', label: 'ツール切替', icon: Paintbrush },
  { id: 'drawing', label: '描画・パス編集', icon: PenTool },
  { id: 'view', label: '表示・ズーム', icon: Maximize2 },
  { id: 'nav', label: '文字送り・移動', icon: Move },
  { id: 'edit', label: '履歴・保存', icon: Undo2 },
];

type MainTab = 'tutorial' | 'glossary' | 'features' | 'shortcuts' | 'faq' | 'feedback';

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
  isOpen,
  onClose,
  theme,
  initialTab = 'tutorial',
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isLight = isLightTheme(theme);

  // Keyboard shortcut listener: Escape and F
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if ((e.key === 'f' || e.key === 'F') && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose]);

  const filteredShortcuts = useMemo(() => {
    return SHORTCUTS.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesKey = item.keys.some((k) => k.toLowerCase().includes(q));
        return matchesDesc || matchesKey;
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 transition-all ${
        isFullscreen
          ? 'p-0 w-screen h-screen bg-black/85 flex flex-col'
          : 'flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150'
      }`}
    >
      <div
        className={`flex flex-col transition-all overflow-hidden ${
          isFullscreen
            ? isLight
              ? 'w-screen h-screen rounded-none border-none shadow-none bg-white text-stone-900'
              : 'w-screen h-screen rounded-none border-none shadow-none bg-[#141e17] text-emerald-100'
            : isLight
            ? 'w-full max-w-3xl xl:max-w-4xl rounded-2xl border max-h-[92vh] bg-white border-stone-200 text-stone-900 shadow-xl'
            : 'w-full max-w-3xl xl:max-w-4xl rounded-2xl border max-h-[92vh] bg-[#141e17] border-[#25362b] text-emerald-100 shadow-xl'
        }`}
      >
        {/* Modal Top Header */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-3.5 border-b shrink-0 ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18231c] border-[#233327]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-xl flex items-center justify-center ${
                isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-900/60 text-emerald-300'
              }`}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight flex items-center space-x-2">
                <span>FontCreator 説明書 & ガイド</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-normal bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  v2.0
                </span>
                {isFullscreen && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-medium">
                    全画面モード
                  </span>
                )}
              </h2>
              <p className="text-xs opacity-75">フォントの作り方・便利機能・ショートカットキーの総合マニュアル</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                isFullscreen
                  ? isLight
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                  : 'bg-[#101813] border-[#25362b] text-emerald-300 hover:bg-[#18231c]'
              }`}
              title={isFullscreen ? '通常表示に戻す (F または Esc)' : '全画面表示に拡大 (F)'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">通常</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">全画面</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors ${
                isLight
                  ? 'text-stone-400 hover:bg-stone-200 hover:text-stone-700'
                  : 'text-stone-400 hover:bg-[#202d24] hover:text-emerald-200'
              }`}
              title="閉じる (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          className={`flex items-center px-4 sm:px-6 border-b shrink-0 gap-2 overflow-x-auto custom-scrollbar touch-scroll-x min-w-0 text-xs font-bold ${
            isLight ? 'bg-white border-stone-200' : 'bg-[#141e17] border-[#223025]'
          }`}
        >
          <button
            onClick={() => setActiveTab('tutorial')}
            className={`py-3 px-3 border-b-2 shrink-0 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'tutorial'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800 font-extrabold'
                  : 'border-emerald-400 text-emerald-200 font-extrabold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>初心者入門ガイド</span>
          </button>

          <button
            onClick={() => setActiveTab('glossary')}
            className={`py-3 px-3 border-b-2 shrink-0 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'glossary'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800 font-extrabold'
                  : 'border-emerald-400 text-emerald-200 font-extrabold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Book className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>用語・概念辞典</span>
          </button>

          <button
            onClick={() => setActiveTab('features')}
            className={`py-3 px-3 border-b-2 shrink-0 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'features'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800 font-extrabold'
                  : 'border-emerald-400 text-emerald-200 font-extrabold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>制作機能・自動化</span>
          </button>

          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`py-3 px-3 border-b-2 shrink-0 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'shortcuts'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800 font-extrabold'
                  : 'border-emerald-400 text-emerald-200 font-extrabold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Keyboard className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>ショートカット一覧</span>
          </button>

          <button
            onClick={() => setActiveTab('faq')}
            className={`py-3 px-3 border-b-2 shrink-0 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'faq'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800 font-extrabold'
                  : 'border-emerald-400 text-emerald-200 font-extrabold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-sky-500 shrink-0" />
            <span>よくあるご質問・導入</span>
          </button>

          <button
            onClick={() => setActiveTab('feedback')}
            className={`py-3 px-3 border-b-2 shrink-0 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'feedback'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800 font-extrabold'
                  : 'border-emerald-400 text-emerald-200 font-extrabold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Github className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span>フィードバック & 不具合報告 (GitHub)</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
          {/* TAB 1: チュートリアル */}
          {activeTab === 'tutorial' && (
            <BeginnerTutorialTab
              isLight={isLight}
              onOpenGlossary={() => setActiveTab('glossary')}
            />
          )}

          {/* TAB 2: 専門用語図解辞典 */}
          {activeTab === 'glossary' && (
            <GlossaryTab isLight={isLight} />
          )}

          {/* TAB 3: 機能解説・制作のコツ */}
          {activeTab === 'features' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Feature 1 */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                      <Paintbrush className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold">筆ツール & 手振れ補正</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    毛筆・万年筆・丸ペン・サインペンなどの筆スタイルを搭載。手書き時のヨレを平滑化する「手振れ補正」と「自動パス結合」でベクター輪郭を生成します。
                  </p>
                </div>

                {/* Feature 2 */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                      <Wand2 className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold">濁点・小書き自動合成</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    「か・さ・た・は」などの清音から、濁点（゛）・半濁点（゜）付き文字や「っ・ゃ・ゅ・ょ」の小書き文字を一括自動生成できます。
                  </p>
                </div>

                {/* Feature 3 */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      <Shapes className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold">部首パーツ工房 (Radical Studio)</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    「さんずい」「きへん」「しんにょう」などのへん・つくりパーツを一度作れば、他の漢字にドラッグ＆ドロップで何度でも再利用・合成可能です。
                  </p>
                </div>

                {/* Feature 4 */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold">下絵・写真トレース</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    紙のノートに書いた文字や看板の写真をキャンバス背景に下絵として表示。不透明度や拡大縮小を調整しながら、正確になぞり描きできます。
                  </p>
                </div>

                {/* Feature 5 */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold">SVGベクターインポート</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    Adobe IllustratorやFigma、Inkscape等でデザインしたSVGベクターデータを読み込み、自動でフォントのベジェ輪郭に変換して取り込めます。
                  </p>
                </div>

                {/* Feature 6 */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold">フォント品質チェック & 最適化（全画面対応）</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    TrueType/OpenType規格に適合しているかを自動検査。極点ノードの自動挿入や輪郭の向き、線幅均一化、重複頂点・過剰ノード削除を一括修正可能。「F」キーまたは全画面ボタンで広い画面いっぱいに字形を一覧点検できます。
                  </p>
                </div>

                {/* Feature 7 */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      <Grid className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold">10種類の作図基準ガイド & 凡例カード</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    十文字格・米字格・九宮格・田字格・同心円格・黄金比・3x3ブロック・六角グリッド・欧文4線など、美文字やフォント設計の伝統的グリッドをワンタッチ切替。キャンバス右上の「ガイド凡例」で各基準線の役割や余白の目安をいつでも参照できます。
                  </p>
                </div>

                {/* Feature 8 */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                      <Hand className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold">パームリジェクション & タッチジェスチャー</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    Apple Pencilやスタイラスペン描画時に手が画面に触れても誤動作しないパームリジェクションを搭載。さらに「2本指タップで取り消し (Undo)」「3本指タップでやり直し (Redo)」「2本指ピンチでズーム」など直感的な操作に対応しています。
                  </p>
                </div>

                {/* Feature 9 */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold">複数ウェイト自動補間 (ファミリー展開)</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    作成したRegularフォントから、Thin（極細）・Light（細字）・Regular・Bold（太字）・Heavy（極太）の全5ウェイトを一括自動生成。一連のフォントファミリーとしてZIP形式でまとめて書き出せます。
                  </p>
                </div>

                {/* Feature 10 */}
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                      <Database className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold">ストレージ管理 & スナップショット復元</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    自動保存に加えて、世代バックアップ（スナップショット履歴）から過去の状態へいつでも復元可能。ストレージの消費量内訳の確認や、単一文字のJSONバックアップ書き出しにも対応しています。
                  </p>
                </div>
              </div>

              {/* Pro Tip Callout */}
              <div
                className={`p-4 rounded-xl border space-y-2 ${
                  isLight
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-amber-950/30 border-amber-800/60 text-amber-100'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-xs">
                  <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>字面枠（仮想ボディ）と余白の調整</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  文字を書くときは、キャンバスの薄緑の枠（字面枠・900×900）の内側に収めると、文章にしたときに文字同士が重ならず並びます。<strong>Shift+Alt+S</strong> を押すと、文字の左右余白（サイドベアリング）を自動で設定できます。
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: キーボードショートカット集 */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              {/* Search & Category Filter Bar */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ショートカットや機能を検索（例: ブラシ, 移動, 保存, 拡大）..."
                    className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none transition-colors ${
                      isLight
                        ? 'bg-stone-50 border-stone-300 text-stone-900 focus:bg-white focus:border-emerald-600'
                        : 'bg-[#18241d] border-[#2c3d31] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                  {SHORTCUT_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-2.5 py-1 rounded-lg font-medium flex items-center space-x-1.5 shrink-0 transition-all ${
                          isActive
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : isLight
                            ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                            : 'bg-[#1a261f] hover:bg-[#23332a] text-emerald-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shortcuts List */}
              <div className="space-y-1.5">
                {filteredShortcuts.length > 0 ? (
                  filteredShortcuts.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                        isLight
                          ? 'bg-stone-50/50 hover:bg-stone-50 border-stone-200/80'
                          : 'bg-[#18241d]/50 hover:bg-[#18241d] border-[#25362b]'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0 pr-2">
                        <span className="truncate">{item.description}</span>
                        {item.badge && (
                          <span className="text-[9.5px] px-1.5 py-0.2 rounded font-mono shrink-0 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] shadow-xs border ${
                              k === 'または' || k === '+' || k === '/'
                                ? 'bg-transparent border-transparent shadow-none text-stone-400 font-sans text-xs px-0.5'
                                : isLight
                                ? 'bg-white border-stone-300 text-stone-800'
                                : 'bg-[#101712] border-[#2d4034] text-emerald-200'
                            }`}
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-stone-400 dark:text-emerald-400/60">
                    一致するショートカットが見つかりませんでした
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: よくある質問・インストール方法 */}
          {activeTab === 'faq' && (
            <div className="space-y-4">
              {/* FAQ 1 */}
              <div
                className={`p-4 rounded-xl border space-y-1.5 ${
                  isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                }`}
              >
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Q. 作成したフォントは商用利用・配布できますか？</span>
                </h4>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-5">
                  <strong>A. はい、商用・非商用問わず自由に利用できます。</strong> 自身が描画・作成したフォントの著作権は制作者に帰属します。商業印刷、Webサイト、ゲーム、動画テロップなど、用途を問わず利用可能です。
                </p>
              </div>

              {/* FAQ 2 */}
              <div
                className={`p-4 rounded-xl border space-y-1.5 ${
                  isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                }`}
              >
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Q. 出力したフォントをWindowsやMacにインストールするには？</span>
                </h4>
                <div className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-5 space-y-1">
                  <p><strong>Windows:</strong> ダウンロードした <code>.ttf</code> または <code>.otf</code> ファイルを右クリックして「すべてのユーザーに対してインストール」をクリックします。</p>
                  <p><strong>Mac:</strong> ファイルをダブルクリックして「Font Book」を開き、「フォントをインストール」をクリックします。</p>
                </div>
              </div>

              {/* FAQ 3 */}
              <div
                className={`p-4 rounded-xl border space-y-1.5 ${
                  isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                }`}
              >
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Q. iPadやiPhoneでフォントを使うには？</span>
                </h4>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-5">
                  無料のフォント管理アプリ（<strong>Fontcase</strong> や <strong>iFont</strong> 等）にエクスポートした <code>.ttf</code> ファイルを取り込み、構成プロファイルをインストールすることで、Pages, Keynote, CLIP STUDIO PAINT, Procreate, ibisPaint 等のアプリで直接使用できます。
                </p>
              </div>

              {/* FAQ 4 */}
              <div
                className={`p-4 rounded-xl border space-y-1.5 ${
                  isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                }`}
              >
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Q. 途中で作業を中断・保存したい場合は？</span>
                </h4>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-5">
                  ブラウザのローカルストレージおよびIndexedDBに自動保存されますが、端末の変更やキャッシュ削除に備えて、「機能」メニュー内の「<strong>セーブ保存 (.fontproj.json)</strong>」からプロジェクトファイルを定期的に保存してください。いつでも「セーブ読込」から再開できます。
                </p>
              </div>

              {/* FAQ 5 */}
              <div
                className={`p-4 rounded-xl border space-y-1.5 ${
                  isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                }`}
              >
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Q. iPadやApple Pencilで描く時の筆圧感知の設定方法は？</span>
                </h4>
                <div className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-5 space-y-1.5">
                  <p>
                    <strong>リアルタイム筆圧表示:</strong> Apple Pencilで画面に触れると、筆ツールバーの筆圧項目横に緑色の「筆圧: ○○%」バッジがリアルタイム表示されます。
                  </p>
                  <p>
                    <strong>筆圧感度の調整:</strong> 筆圧バーの「感度: 高 / 標準 / 低」から筆圧の利き具合を切り替えられます。万年筆・Gペン・毛筆・和風墨筆スタイルを選ぶと、筆圧による線の強弱が特に豊かに表現されます。
                  </p>
                  <p>
                    <strong>タッチジェスチャー:</strong> キャンバス上を<strong>2本指タップで1手戻す (Undo)</strong>、<strong>3本指タップでやり直す (Redo)</strong>、<strong>2本指ピンチで拡大・縮小・移動</strong>がスムーズに行えます。
                  </p>
                  <p>
                    <strong>パームリジェクション:</strong> 画面上部の設定メニューから「パームリジェクション」を「自動」または「スタイラス専用」に設定すると、画面に置いた手のひらによる誤反応を防止できます。
                  </p>
                </div>
              </div>

              {/* FAQ 6 */}
              <div
                className={`p-4 rounded-xl border space-y-1.5 ${
                  isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                }`}
              >
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Q. 画数が多い漢字（20〜30画超）で描画が重くなるのを防ぐには？</span>
                </h4>
                <div className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pl-5 space-y-1">
                  <p>
                    最新バージョンでは<strong>局所サブセットブーリアン結合（Localized Subset Union）</strong>と<strong>幾何キャッシュ</strong>が導入され、画数が増えても描画遅延が極小化されています。
                  </p>
                  <p>
                    さらに描画後にキーボードの <strong>Alt + S（パス単純化）</strong> を押すと、微細な不要ノードを削減してデータ量を軽量化し、フォントファイルサイズをコンパクトに保てます。
                  </p>
                </div>
              </div>

              {/* FAQ 7: 機能追加・ご要望について */}
              <div
                className={`p-4 rounded-xl border space-y-1.5 ${
                  isLight ? 'bg-amber-50/70 border-amber-200' : 'bg-[#1e1c14] border-amber-900/60'
                }`}
              >
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Q. 新機能の追加や機能要望・アイデアのリクエストはできますか？</span>
                </h4>
                <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed pl-5">
                  本アプリは生成AIを活用して開発を進めている個人プロジェクトです。そのため、新規の大型機能の追加や大幅な仕様変更・独自仕様のご要望につきましては、AI生成の特性上対応が厳しい（難しい）場合がございます。あらかじめご理解・ご了承をいただけますと幸いです。（操作上の明らかな不具合やバグの修正、既存機能の改善については「フィードバック」タブのGitHub Issueよりご報告いただければ積極的に対応いたします）
                </p>
              </div>
            </div>
          )}

          {/* TAB 6: フィードバック & GitHub 不具合報告 */}
          {activeTab === 'feedback' && (
            <FeedbackTab isLight={isLight} />
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-3 border-t shrink-0 text-xs ${
            isLight ? 'bg-stone-50 border-stone-200 text-stone-600' : 'bg-[#18231c] border-[#233327] text-stone-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span>キーボードショートカットはいつでも</span>
            <kbd className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-emerald-200">
              ?
            </kbd>
            <span>キーで開けます</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
