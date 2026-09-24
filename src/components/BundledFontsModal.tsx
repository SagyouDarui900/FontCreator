import React, { useState } from 'react';
import {
  X,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Info,
  Layers,
  Sparkles,
  FileText,
  Search,
} from 'lucide-react';
import { ThemeMode, isLightTheme } from '../utils/theme';
import { BUNDLED_FONTS_INFO, BundledFontInfo } from '../data/bundledFontsInfo';

interface BundledFontsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: ThemeMode;
}

export const BundledFontsModal: React.FC<BundledFontsModalProps> = ({
  isOpen,
  onClose,
  theme = 'light' as ThemeMode,
}) => {
  const isLight = isLightTheme(theme);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const filtered = BUNDLED_FONTS_INFO.filter((font) => {
    if (filterCategory !== 'all' && font.category !== filterCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        font.name.toLowerCase().includes(q) ||
        font.nameJa.toLowerCase().includes(q) ||
        font.author.toLowerCase().includes(q) ||
        font.role.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
          isLight
            ? 'bg-white border-stone-200 text-stone-800'
            : 'bg-[#121a14] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#162219] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <span>下絵・部首用フォントのライセンス一覧</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-normal bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  SIL OFL 1.1 完全準拠
                </span>
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                本アプリに内蔵されている下絵用および部首抽出用フォントの権利・利用条件
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight
                ? 'text-stone-400 hover:text-stone-700 hover:bg-stone-200'
                : 'text-stone-400 hover:text-white hover:bg-[#25362b]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Legal & Commercial Safety Assurance Banner */}
        <div
          className={`p-3.5 border-b shrink-0 text-xs flex items-start space-x-2.5 ${
            isLight ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-bold">
              商用利用・改変・派生フォントの販売・無料配布は100%問題ありません
            </p>
            <p className="text-[11px] opacity-90">
              Font Creator Studio 内で下絵（お手本）として表示される書体や、部首スタジオでベクター輪郭として抽出される書体は、すべてオープンフォントライセンス（<strong>SIL Open Font License 1.1</strong>）に基づいて提供されています。
              これらのフォントから輪郭をトレース・加工・合成して作成したフォントファイル（TTF / WOFF / SVG）は、商用・非商用問わず自由に公開・販売・組込配布いただけます。
            </p>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div
          className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs ${
            isLight ? 'bg-stone-50/50 border-stone-200' : 'bg-[#141e17] border-[#25362b]'
          }`}
        >
          {/* Category Tabs */}
          <div className="flex items-center space-x-1">
            {[
              { id: 'all', label: 'すべて' },
              { id: '部首 (Radicals)', label: '部首合成用' },
              { id: '下絵 (お手本)', label: '下絵トレース用' },
              { id: 'UI / メトリクス', label: 'エディタUI用' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterCategory(tab.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  filterCategory === tab.id
                    ? isLight
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-emerald-600 text-white shadow-xs'
                    : isLight
                    ? 'text-stone-600 hover:bg-stone-200/70'
                    : 'text-stone-400 hover:bg-[#25362b]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[140px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="フォント名・製作者で絞り込み..."
              className={`w-full pl-7 pr-2.5 py-1 rounded-md border text-[11px] outline-none ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-800 focus:border-emerald-600'
                  : 'bg-[#101712] border-[#25362b] text-emerald-100 focus:border-emerald-500'
              }`}
            />
          </div>
        </div>

        {/* Scrollable Font Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.map((font) => (
            <div
              key={font.id}
              className={`p-3.5 rounded-xl border transition-all ${
                isLight
                  ? 'bg-stone-50/70 border-stone-200 hover:border-emerald-300'
                  : 'bg-[#151f18] border-[#233327] hover:border-emerald-700/60'
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      className="text-base font-bold text-stone-900 dark:text-emerald-100"
                      style={{ fontFamily: font.fontFamily }}
                    >
                      {font.nameJa}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {font.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    製作者 / 著作権者: <span className="font-semibold text-stone-700 dark:text-stone-200">{font.author}</span>
                  </p>
                </div>

                <div className="flex flex-col items-end">
                  <a
                    href={font.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <span>{font.license}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    商用利用・改変フリー
                  </span>
                </div>
              </div>

              {/* Sample Character Preview */}
              <div
                className={`p-2.5 rounded-lg border mb-2 flex items-center justify-between gap-2 overflow-x-auto ${
                  isLight ? 'bg-white border-stone-200' : 'bg-[#101712] border-[#223326]'
                }`}
              >
                <div className="flex items-baseline gap-3 shrink-0">
                  <span
                    className="text-2xl font-normal leading-none"
                    style={{ fontFamily: font.fontFamily }}
                  >
                    永 漢 書 藝 桜
                  </span>
                  <span
                    className="text-lg opacity-70 leading-none"
                    style={{ fontFamily: font.fontFamily }}
                  >
                    あいうえお ABC 123
                  </span>
                </div>
                <span className="text-[10px] text-stone-400 font-mono shrink-0">
                  CSS: {font.fontFamily}
                </span>
              </div>

              {/* Role & Description */}
              <div className="space-y-1 text-xs">
                <div className="flex items-start gap-1 text-stone-600 dark:text-stone-300">
                  <span className="font-semibold shrink-0 text-stone-500 dark:text-stone-400">用途:</span>
                  <span>{font.role}</span>
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                  {font.description}
                </div>
                <div
                  className={`mt-2 p-2 rounded-lg text-[11px] leading-relaxed border ${
                    isLight
                      ? 'bg-amber-50/50 border-amber-200/70 text-amber-900'
                      : 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                  }`}
                >
                  <span className="font-bold">ライセンス詳細:</span> {font.licenseNotes}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-8 text-center text-xs text-stone-400">
              該当するフォント情報が見つかりませんでした。
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-5 py-3 border-t shrink-0 text-xs ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#141e17] border-[#25362b]'
          }`}
        >
          <div className="text-[11px] text-stone-500 dark:text-stone-400">
            ※ 本アプリで作成したフォントには、ご自身で設定した著作権・ライセンスを付与できます。
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              isLight
                ? 'bg-emerald-800 text-white hover:bg-emerald-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
