import React, { useState, useMemo } from 'react';
import {
  Keyboard,
  X,
  Search,
  Paintbrush,
  PenTool,
  Move,
  Maximize2,
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
} from 'lucide-react';
import { ThemeMode } from '../utils/theme';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
  initialTab?: 'tutorial' | 'features' | 'shortcuts' | 'faq';
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'tools' | 'drawing' | 'view' | 'nav' | 'edit';
  badge?: string;
}

const SHORTCUTS: ShortcutItem[] = [
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
  { keys: ['Shift', '+', 'Alt', '+', 'S'], description: 'スマート自動字幅・左右余白バランス調律', category: 'drawing', badge: '自動調律' },

  // 表示・ズーム・レイアウト
  { keys: ['Space', '+', 'ドラッグ'], description: '一時的に手のひらツールになりキャンバスをパン移動', category: 'view', badge: '必須' },
  { keys: ['0'], description: 'キャンバス全体を画面に最適フィット', category: 'view' },
  { keys: ['1'], description: '原寸・等倍表示 (100%)', category: 'view' },
  { keys: ['W'], description: 'キャンバス幅いっぱいに拡大フィット', category: 'view' },
  { keys: ['+'], description: 'ズームイン (拡大)', category: 'view' },
  { keys: ['-'], description: 'ズームアウト (縮小)', category: 'view' },
  { keys: ['Z', 'または', 'Shift + Z'], description: '全面作図・集中モード (サイドバーの収納/展開)', category: 'view', badge: '集中' },
  { keys: ['\\'], description: '文字一覧サイドバーの開閉', category: 'view' },
  { keys: ['G'], description: '方眼グリッドの表示 / 非表示切り替え', category: 'view' },
  { keys: ['Alt', '+', '+'], description: '方眼グリッドのマス目サイズを拡大 (+5px)', category: 'view' },
  { keys: ['Alt', '+', '-'], description: '方眼グリッドのマス目サイズを縮小 (-5px)', category: 'view' },

  // 文字送り・ナビゲーション
  { keys: ['Alt', '+', '→', '/', 'PageDown'], description: '次の文字へ進む（五十音順・漢字順）', category: 'nav', badge: '連続作字' },
  { keys: ['Alt', '+', '←', '/', 'PageUp'], description: '前の文字へ戻る', category: 'nav' },
  { keys: ['Alt', '+', 'N'], description: '次の「未作成の文字」へスキップ', category: 'nav', badge: '爆速作字' },
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
  { id: 'tools', label: 'ツール切替', icon: Paintbrush },
  { id: 'drawing', label: '描画・パス編集', icon: PenTool },
  { id: 'view', label: '表示・ズーム', icon: Maximize2 },
  { id: 'nav', label: '文字送り・移動', icon: Move },
  { id: 'edit', label: '履歴・保存', icon: Undo2 },
];

type MainTab = 'tutorial' | 'features' | 'shortcuts' | 'faq';

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
  isOpen,
  onClose,
  theme,
  initialTab = 'tutorial',
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>(initialTab);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isLight = theme === 'light';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors ${
          isLight
            ? 'bg-white border-stone-200 text-stone-900 shadow-xl'
            : 'bg-[#141e17] border-[#25362b] text-emerald-100 shadow-xl'
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
              </h2>
              <p className="text-xs opacity-75">フォントの作り方・便利機能・ショートカットキーの総合マニュアル</p>
            </div>
          </div>
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

        {/* Tab Navigation */}
        <div
          className={`flex items-center px-4 sm:px-6 border-b shrink-0 gap-2 overflow-x-auto no-scrollbar text-xs font-bold ${
            isLight ? 'bg-white border-stone-200' : 'bg-[#141e17] border-[#223025]'
          }`}
        >
          <button
            onClick={() => setActiveTab('tutorial')}
            className={`py-3 px-3 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'tutorial'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-emerald-400 text-emerald-200'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>🔰 はじめてのフォント作り</span>
          </button>

          <button
            onClick={() => setActiveTab('features')}
            className={`py-3 px-3 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'features'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-emerald-400 text-emerald-200'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>✍️ 制作機能・自動化のコツ</span>
          </button>

          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`py-3 px-3 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'shortcuts'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-emerald-400 text-emerald-200'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Keyboard className="w-4 h-4 text-indigo-500" />
            <span>⌨️ ショートカットキー集</span>
          </button>

          <button
            onClick={() => setActiveTab('faq')}
            className={`py-3 px-3 border-b-2 flex items-center space-x-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'faq'
                ? isLight
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-emerald-400 text-emerald-200'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-sky-500" />
            <span>❓ よくある質問・インストール</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: チュートリアル */}
          {activeTab === 'tutorial' && (
            <div className="space-y-6">
              {/* Introduction Card */}
              <div
                className={`p-4 rounded-2xl border flex items-start space-x-3.5 ${
                  isLight
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50/50 border-emerald-200 text-emerald-950'
                    : 'bg-gradient-to-r from-emerald-950/40 to-teal-950/20 border-emerald-800/60 text-emerald-100'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
                  FC
                </div>
                <div>
                  <h3 className="text-sm font-extrabold mb-1">
                    ようこそ！オリジナルフォント作成の世界へ
                  </h3>
                  <p className="text-xs leading-relaxed opacity-90">
                    FontCreatorは、iPadのApple Pencilやペンタブレット・マウスで手軽に日本語フォント（ひらがな・カタカナ・漢字・英数）を作成し、パソコンやスマホで使える正式な<strong>TTF / OTFフォントファイル</strong>として出力できるWebアプリです。
                  </p>
                </div>
              </div>

              {/* 5-Step Workflow */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-emerald-500 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>5分でわかる！フォント作りの基本ステップ</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Step 1 */}
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center">
                          1
                        </span>
                        <h5 className="text-xs font-bold">文字一覧から文字を選ぶ</h5>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                        左側の「文字一覧」サイドバーから作りたい文字（まずは「あ」など）をクリックして選択します。
                      </p>
                    </div>
                    <div className="mt-2 text-[11px] font-mono opacity-70 text-emerald-700 dark:text-emerald-400">
                      💡 ショートカット: Alt+→ で次の文字へ連続作字
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center">
                          2
                        </span>
                        <h5 className="text-xs font-bold">筆またはペンで描く</h5>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                        <strong>筆ツール [B]</strong> で手書き風ストロークを描くか、<strong>ペンツール [P]</strong> でアンカーポイントを打って滑らかなベジェ曲線を作図します。
                      </p>
                    </div>
                    <div className="mt-2 text-[11px] font-mono opacity-70 text-emerald-700 dark:text-emerald-400">
                      💡 太さ調整: [ キー で細く / ] キー で太く
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center">
                          3
                        </span>
                        <h5 className="text-xs font-bold">自動合成や部首パーツで時短</h5>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                        「か」を書けば「が」を<strong>濁点自動合成</strong>でワンクリック作成。「さんずい」などの部首パーツを組み合わせて漢字も効率よく作れます。
                      </p>
                    </div>
                    <div className="mt-2 text-[11px] font-mono opacity-70 text-emerald-700 dark:text-emerald-400">
                      💡 「機能」メニュー ➔ 濁点・小書き自動合成
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold flex items-center justify-center">
                          4
                        </span>
                        <h5 className="text-xs font-bold">試し打ちで文章をチェック</h5>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                        ヘッダーの「<strong>試し打ち</strong>」ボタンを押すと、入力した文章をリアルタイムでフォント表示して文字間の並びやバランスを確認できます。
                      </p>
                    </div>
                    <div className="mt-2 text-[11px] font-mono opacity-70 text-emerald-700 dark:text-emerald-400">
                      💡 未作成文字は代替フォントで自然に補完表示
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    isLight
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-100'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center">
                      5
                    </span>
                    <div>
                      <h5 className="text-xs font-extrabold">「フォント出力」でTTF/OTFをダウンロード！</h5>
                      <p className="text-xs opacity-80">
                        右上の「フォント出力」ボタンから、完成したフォントをPCやiPadにすぐ使えるファイルとして保存できます。
                      </p>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 hidden sm:block" />
                </div>
              </div>

              {/* Device Tips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div
                  className={`p-3.5 rounded-xl border space-y-1.5 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold text-xs text-stone-800 dark:text-emerald-200">
                    <Tablet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>iPad / タブレットで使う場合</span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    Apple Pencilでの筆圧感知描画に対応。ツールバーは画面下部に配置され、片手でもスムーズに切り替えできます。
                  </p>
                </div>

                <div
                  className={`p-3.5 rounded-xl border space-y-1.5 ${
                    isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold text-xs text-stone-800 dark:text-emerald-200">
                    <Laptop className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>PC / マウス・ペンタブで使う場合</span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    スペースキードラッグでのキャンバス移動や、ショートカットキー（B, P, V, Ctrl+Z）を併用すると圧倒的な速度で作字できます。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 機能解説・制作のコツ */}
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
                    毛筆・万年筆・丸ペン・サインペンなど多彩な筆スタイルを搭載。手書き時のヨレを滑らかにする「リアルタイム手振れ補正」と「自動パス結合」で、自然で美しいベクター輪郭を生成します。
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
                    「か・さ・た・は」などの清音から、濁点（゛）・半濁点（゜）付き文字や「っ・ゃ・ゅ・ょ」の小書き文字を一括自動生成。手作業の負担を劇的に削減します。
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
                    <h4 className="text-xs font-bold">フォント品質チェック & 最適化</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    TrueType/OpenType規格に適合しているかを自動検査。極点ノードの自動挿入や輪郭の向き（ワインディングルール）、重複頂点の削除をワンクリックで実行できます。
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
                  <span>プロの作字テクニック: 字面枠（仮想ボディ）と余白の調律</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  文字を書くときは、キャンバスの薄緑の枠（字面枠・900×900）に少し余裕を持って収めると、文章にしたときに文字同士がくっつかず美しく並びます。<strong>Shift+Alt+S</strong> を押すと、文字の左右余白（サイドベアリング）を自動で均等調律できます。
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
                  <strong>A. はい、完全に自由です。</strong> あなた自身が描画・作成したフォントの著作権は100%あなたに帰属します。同人誌、商業印刷、Webサイト、ゲーム、動画テロップ、LINEスタンプなど、商用・非商用問わず無償でご自由にご活用いただけます。
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
                  ブラウザのローカルストレージに自動保存されますが、端末の変更や万一のキャッシュ削除に備えて、「機能」メニュー内の「<strong>セーブ保存 (.json)</strong>」からプロジェクトファイルを保存しておくことをおすすめします。いつでも「セーブ読込」から続きを再開できます。
                </p>
              </div>
            </div>
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
