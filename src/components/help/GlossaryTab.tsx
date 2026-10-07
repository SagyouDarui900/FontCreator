import React, { useState, useMemo } from 'react';
import { Search, BookOpen, Lightbulb, Sparkles, HelpCircle, Layers, CheckCircle2 } from 'lucide-react';
import { FONT_GLOSSARY, GLOSSARY_CATEGORIES, GlossaryTerm } from './FontGlossaryData';

interface GlossaryTabProps {
  isLight: boolean;
}

export const GlossaryTab: React.FC<GlossaryTabProps> = ({ isLight }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTerms = useMemo(() => {
    return FONT_GLOSSARY.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.term.toLowerCase().includes(q) ||
          (item.reading && item.reading.includes(q)) ||
          (item.english && item.english.toLowerCase().includes(q)) ||
          item.shortSummary.toLowerCase().includes(q) ||
          item.easyExplanation.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Friendly Intro Hero */}
      <div
        className={`p-4 rounded-2xl border flex items-start space-x-3.5 ${
          isLight
            ? 'bg-amber-50/80 border-amber-200/80 text-amber-950'
            : 'bg-[#222119] border-amber-800/60 text-amber-100'
        }`}
      >
        <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold mb-1 flex items-center space-x-2">
            <span>フォントの専門用語・図解辞典</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-normal">
              未経験者向け
            </span>
          </h3>
          <p className="text-xs leading-relaxed opacity-90">
            フォント制作で用いられる専門用語（グリフ、ベジェ曲線、サイドベアリングなど）について、図解と平易な語彙で整理・解説しています。
          </p>
        </div>
      </div>

      {/* Visual Diagram: Anatomy of a Font Glyph */}
      <div
        className={`p-4 rounded-2xl border space-y-3 ${
          isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
        }`}
      >
        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center space-x-1.5">
          <Layers className="w-4 h-4" />
          <span>フォントのマス目と余白の仕組み（図解）</span>
        </h4>

        <div
          className={`p-4 rounded-xl border relative overflow-hidden flex flex-col items-center justify-center ${
            isLight ? 'bg-white border-stone-300' : 'bg-[#101712] border-[#223026]'
          }`}
        >
          {/* Simulated Glyph Box Diagram */}
          <div className="w-full max-w-md aspect-[16/9] sm:aspect-[2/1] relative border-2 border-dashed border-emerald-500/70 rounded-lg flex items-center justify-center p-2 sm:p-4">
            {/* Advance Width Indicator */}
            <div className="absolute top-1.5 inset-x-2 flex items-center justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
              <span>← 左端 (X=0)</span>
              <span className="bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded font-bold">送り幅 (Advance Width: 1000)</span>
              <span>右端 (X=1000) →</span>
            </div>

            {/* Left Bearing */}
            <div className="absolute left-0 inset-y-0 w-8 sm:w-12 bg-amber-500/15 border-r border-amber-500/40 flex items-center justify-center">
              <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 -rotate-90 whitespace-nowrap">
                左余白 (LSB)
              </span>
            </div>

            {/* Right Bearing */}
            <div className="absolute right-0 inset-y-0 w-8 sm:w-12 bg-amber-500/15 border-l border-amber-500/40 flex items-center justify-center">
              <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 rotate-90 whitespace-nowrap">
                右余白 (RSB)
              </span>
            </div>

            {/* Inner Glyph Area */}
            <div className="border border-emerald-400/50 bg-emerald-500/5 rounded p-3 text-center flex flex-col items-center justify-center z-10">
              <span className="text-3xl sm:text-4xl font-serif font-black text-emerald-800 dark:text-emerald-200">
                あ
              </span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                字面（文字のインクが乗る範囲）
              </span>
            </div>

            {/* Baseline indicator */}
            <div className="absolute bottom-5 inset-x-0 border-b-2 border-indigo-500/60 flex items-center justify-between px-2 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
              <span>床ライン (ベースライン)</span>
              <span>英字の足元が揃う線</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full mt-3 text-[11px]">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center space-x-1.5 font-bold">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block shrink-0" />
                <span>仮想ボディ (外枠)</span>
              </div>
              <p className="text-[10px] opacity-85 mt-0.5">原稿用紙の1マス。正方形の全体サイズ。</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
              <div className="flex items-center space-x-1.5 font-bold">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block shrink-0" />
                <span>余白 (サイドベアリング)</span>
              </div>
              <p className="text-[10px] opacity-85 mt-0.5">文字と文字がぶつからないための左右のすき間。</p>
            </div>
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-800 dark:text-indigo-300">
              <div className="flex items-center space-x-1.5 font-bold">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block shrink-0" />
                <span>ベースライン (床基準線)</span>
              </div>
              <p className="text-[10px] opacity-85 mt-0.5">アルファベットが水平に並ぶ基準の高さ。</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="用語を検索（例: グリフ, 余白, ベジェ, TTF, 単純化）..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none transition-colors ${
              isLight
                ? 'bg-stone-50 border-stone-300 text-stone-900 focus:bg-white focus:border-emerald-600'
                : 'bg-[#18241d] border-[#2c3d31] text-emerald-100 focus:border-emerald-500'
            }`}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {GLOSSARY_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-medium shrink-0 transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : isLight
                    ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    : 'bg-[#1a261f] hover:bg-[#23332a] text-emerald-300'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Terms Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredTerms.map((t) => (
          <div
            key={t.id}
            className={`p-4 rounded-xl border space-y-2.5 flex flex-col justify-between transition-colors ${
              isLight ? 'bg-stone-50/70 border-stone-200 hover:bg-stone-50' : 'bg-[#18241d] border-[#25362b] hover:bg-[#1b2b21]'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline space-x-1.5">
                  <h5 className="text-sm font-extrabold text-stone-900 dark:text-emerald-100">
                    {t.term}
                  </h5>
                  {t.reading && (
                    <span className="text-[10px] text-stone-400 dark:text-stone-400 font-normal">
                      ({t.reading})
                    </span>
                  )}
                </div>
                {t.badge && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    {t.badge}
                  </span>
                )}
              </div>

              {t.english && (
                <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                  {t.english}
                </div>
              )}

              <p className="text-xs font-bold text-stone-700 dark:text-stone-200">
                {t.shortSummary}
              </p>

              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                {t.easyExplanation}
              </p>
            </div>

            {t.appFeatureTip && (
              <div
                className={`mt-2 p-2 rounded-lg text-[11px] flex items-start space-x-1.5 border ${
                  isLight
                    ? 'bg-emerald-50/60 border-emerald-200/60 text-emerald-800'
                    : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <span className="leading-snug">{t.appFeatureTip}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
