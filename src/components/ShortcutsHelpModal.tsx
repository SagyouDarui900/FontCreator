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
  Grid,
  Sparkles,
  Layers,
} from 'lucide-react';
import { ThemeMode } from '../utils/theme';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeMode;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'tools' | 'drawing' | 'view' | 'nav' | 'edit';
  badge?: string;
}

const SHORTCUTS: ShortcutItem[] = [
  // ツール切替
  { keys: ['B'], description: '筆・毛筆ブラシツールに切り替え', category: 'tools' },
  { keys: ['P'], description: 'ベクターペンツール（ベジェ曲線）に切り替え', category: 'tools' },
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
  { keys: ['Ctrl / ⌘', '+', 'Z'], description: 'ペン描画中に直前のノード配置を取り消す', category: 'drawing' },
  { keys: ['Delete', '/', 'Backspace'], description: '選択中の輪郭、または選択ノードを削除', category: 'drawing' },
  { keys: ['Ctrl / ⌘', '+', 'A'], description: '現在の文字のすべてのパスを選択', category: 'drawing' },
  { keys: ['Alt', '+', 'S'], description: 'パスの単純化（頂点削減で滑らかに）', category: 'drawing' },
  { keys: ['Shift', '+', 'Alt', '+', 'S'], description: 'スマート自動字幅・左右余白バランス調整', category: 'drawing', badge: '自動調律' },

  // 表示・ズーム・レイアウト
  { keys: ['Space', '+', 'ドラッグ'], description: '一時的に手のひらツールになりキャンバスをパン移動', category: 'view', badge: '必須' },
  { keys: ['0'], description: 'キャンバス全体を画面に最適フィット', category: 'view' },
  { keys: ['1'], description: '原寸・等倍表示 (100%)', category: 'view' },
  { keys: ['W'], description: 'キャンバス幅いっぱいに拡大フィット', category: 'view' },
  { keys: ['+'], description: 'ズームイン (拡大)', category: 'view' },
  { keys: ['-'], description: 'ズームアウト (縮小)', category: 'view' },
  { keys: ['F', 'または', 'Shift + Z'], description: '全面作図・集中モード (サイドバーの収納/展開)', category: 'view' },
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
  { keys: ['Ctrl / ⌘', '+', 'S'], description: 'プロジェクトをブラウザに保存', category: 'edit', badge: '保存' },
  { keys: ['Esc'], description: 'パス描画中止 / 選択解除 / モーダルを閉じる', category: 'edit' },
  { keys: ['?'], description: 'このキーボードショートカット集を表示', category: 'edit' },
];

const CATEGORIES = [
  { id: 'all', label: 'すべて', icon: Keyboard },
  { id: 'tools', label: 'ツール切替', icon: Paintbrush },
  { id: 'drawing', label: '描画・パス編集', icon: PenTool },
  { id: 'view', label: '表示・ズーム', icon: Maximize2 },
  { id: 'nav', label: '文字移動・送り', icon: Move },
  { id: 'edit', label: '履歴・保存', icon: Undo2 },
];

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
  isOpen,
  onClose,
  theme,
}) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
          isLight
            ? 'bg-white border-stone-200 text-stone-900 shadow-emerald-950/10'
            : 'bg-[#151f18] border-[#25362b] text-emerald-100 shadow-black/50'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18231c] border-[#233327]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-2 rounded-xl ${
                isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-900/60 text-emerald-300'
              }`}
            >
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">キーボードショートカット集</h2>
              <p className="text-xs opacity-70">作字スピードと快適性を高めるショートカットキー一覧</p>
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

        {/* Search & Category Filter Bar */}
        <div
          className={`p-3.5 border-b space-y-2.5 ${
            isLight ? 'bg-stone-50/50 border-stone-200' : 'bg-[#131b15] border-[#202d23]'
          }`}
        >
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ショートカットや機能を検索（例: ブラシ, 移動, 保存, 拡大）..."
              className={`w-full pl-9 pr-3 py-1.5 rounded-xl border text-xs outline-none transition-colors ${
                isLight
                  ? 'bg-white border-stone-300 text-stone-900 focus:border-emerald-600'
                  : 'bg-[#18241d] border-[#2c3d31] text-emerald-100 focus:border-emerald-500'
              }`}
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {CATEGORIES.map((cat) => {
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

        {/* Shortcut Table List */}
        <div className="p-4 overflow-y-auto max-h-[55vh] space-y-2 text-xs">
          {filteredShortcuts.length === 0 ? (
            <div className="py-12 text-center text-stone-400 dark:text-stone-500">
              該当するショートカットは見つかりませんでした
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filteredShortcuts.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                    isLight
                      ? 'bg-stone-50/70 hover:bg-stone-100/80 border-stone-200/80'
                      : 'bg-[#18231c]/60 hover:bg-[#1f2d24] border-[#25362b]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-3">
                    <span className="font-medium text-stone-800 dark:text-emerald-100 truncate">
                      {item.description}
                    </span>
                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {item.keys.map((k, ki) => {
                      if (k === '+' || k === 'または' || k === '/') {
                        return (
                          <span key={ki} className="text-[10px] opacity-50 px-0.5">
                            {k}
                          </span>
                        );
                      }
                      return (
                        <kbd
                          key={ki}
                          className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold shadow-xs border ${
                            isLight
                              ? 'bg-white border-stone-300 text-stone-800'
                              : 'bg-[#223026] border-[#34483a] text-emerald-200'
                          }`}
                        >
                          {k}
                        </kbd>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div
          className={`px-5 py-3 border-t text-[11px] flex items-center justify-between ${
            isLight ? 'bg-stone-50 border-stone-200 text-stone-500' : 'bg-[#18231c] border-[#233327] text-stone-400'
          }`}
        >
          <span>
            ヒント: 作字中にいつでも <kbd className="px-1.5 py-0.5 rounded border bg-stone-200 dark:bg-stone-800 font-mono text-[10px] font-bold">?</kbd> キーを押してこの一覧を表示できます
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
