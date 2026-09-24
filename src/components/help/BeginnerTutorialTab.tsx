import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  Paintbrush,
  Layers,
  Shapes,
  Eye,
  Download,
  Lightbulb,
  Tablet,
  Laptop,
  HelpCircle,
  Zap,
  SlidersHorizontal,
} from 'lucide-react';

interface BeginnerTutorialTabProps {
  isLight: boolean;
  onOpenGlossary: () => void;
}

export const BeginnerTutorialTab: React.FC<BeginnerTutorialTabProps> = ({ isLight, onOpenGlossary }) => {
  return (
    <div className="space-y-6">
      {/* Friendly Welcome Card */}
      <div
        className={`p-4 rounded-2xl border flex items-start space-x-3.5 ${
          isLight
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-[#1b261f] border-emerald-800/60 text-emerald-100'
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs font-black text-base">
          FC
        </div>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-extrabold">
              はじめてのフォント作りガイド（未経験者向け）
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-600 text-white">
              完全無料
            </span>
          </div>
          <p className="text-xs leading-relaxed opacity-90">
            FontCreatorへようこそ。フォント制作の専門知識がなくても、直感的な操作で制作を始められます。iPadのApple Pencilやペンタブレット、マウスを用いて文字を描くだけで、PCや各種デザインアプリで実際に使用できるフォントファイル（.ttf / .otf）を作成・書き出しできます。
          </p>
        </div>
      </div>

      {/* 3 Reassuring Facts for Beginners */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div
          className={`p-3 rounded-xl border space-y-1 ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
          }`}
        >
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>1文字だけでも出力可能</span>
          </div>
          <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-snug">
            すべての文字を一度に制作する必要はありません。「あ」1文字やアルファベット数文字からでも、正式なフォントファイルとして書き出して使用できます。
          </p>
        </div>

        <div
          className={`p-3 rounded-xl border space-y-1 ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
          }`}
        >
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>未作成文字の自動補完</span>
          </div>
          <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-snug">
            まだ作成していない文字がテキスト入力された場合でも、OSの標準フォントが自動で代替表示されるため、気軽に作り始めることができます。
          </p>
        </div>

        <div
          className={`p-3 rounded-xl border space-y-1 ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
          }`}
        >
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>商用利用・配布に対応</span>
          </div>
          <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-snug">
            作成したフォントの著作権は制作者本人に帰属します。同人誌、印刷物、ロゴ、動画テロップ、Webコンテンツなど、商用・非商用を問わず自由に活用できます。
          </p>
        </div>
      </div>

      {/* 3 Recommended Creation Courses */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-emerald-400 flex items-center space-x-1.5">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>制作スタイルに合わせた3つのアプローチ</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Course 1 */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 ${
              isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  <Paintbrush className="w-4 h-4" />
                </div>
                <h5 className="text-xs font-extrabold">① 手書き入力コース</h5>
              </div>
              <span className="text-[9.5px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 inline-block">
                おすすめ
              </span>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                <strong>筆ツール [B]</strong> を選択し、タブレットやマウスで直接文字を書き込みます。手ブレ補正機能により、滑らかなベクター輪郭へ自動変換されます。
              </p>
            </div>
            <div className="text-[10.5px] text-emerald-700 dark:text-emerald-400 font-medium">
              サインペンや丸文字筆など、好みのペン先を選択できます。
            </div>
          </div>

          {/* Course 2 */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 ${
              isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                  <Layers className="w-4 h-4" />
                </div>
                <h5 className="text-xs font-extrabold">② 下絵トレースコース</h5>
              </div>
              <span className="text-[9.5px] px-1.5 py-0.2 rounded font-mono font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 inline-block">
                紙の手書き文字を活用
              </span>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                紙のノートに書いた文字をスマートフォン等で撮影し、上部バーの「下絵」機能から読み込みます。背景に薄く表示された文字をなぞることで、自作フォントとしてベクター化できます。
              </p>
            </div>
            <div className="text-[10.5px] text-teal-700 dark:text-teal-400 font-medium">
              不透明度を調整しながら正確になぞり描きが可能です。
            </div>
          </div>

          {/* Course 3 */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 ${
              isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  <Shapes className="w-4 h-4" />
                </div>
                <h5 className="text-xs font-extrabold">③ 幾何学・デザイン作図コース</h5>
              </div>
              <span className="text-[9.5px] px-1.5 py-0.2 rounded font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 inline-block">
                ロゴ・POP文字向け
              </span>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                矩形・円・直線ツールやペンツールを組み合わせて、幾何学的なフォントを作図できます。ガイド線やスナップ機能を活用し、パスの結合ツールで一体化します。
              </p>
            </div>
            <div className="text-[10.5px] text-indigo-700 dark:text-indigo-400 font-medium">
              定規機能を利用してストローク幅を均一に保てます。
            </div>
          </div>
        </div>
      </div>

      {/* 5-Step Basic Workflow */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-emerald-400 flex items-center space-x-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>作字の基本 5ステップ</span>
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
                <h5 className="text-xs font-bold">文字一覧から文字を選択</h5>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                左側のサイドバーで作字したい文字（まずは「あ」など）をクリックします。上部のフィルターから「ひらがな」「カタカナ」「小学校1年生」等に絞り込みが可能です。
              </p>
            </div>
            <div className="mt-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
              ショートカット: Alt + → で次の文字へ移動できます
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
                <h5 className="text-xs font-bold">筆またはペンで描画</h5>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                <strong>筆ツール [B]</strong> によるフリーハンド描画、または <strong>ペンツール [P]</strong> でアンカーポイントを配置して描きます。中央の薄緑の枠（900×900）を目安に収めます。
              </p>
            </div>
            <div className="mt-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
              線の太さ調整: [ キーで細く / ] キーで太く調整できます
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
                <h5 className="text-xs font-bold">自動調律・自動合成の活用</h5>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                <strong>Shift + Alt + S</strong> を押すと文字の左右余白（サイドベアリング）が自動調律されます。「か」を作成しておけば「が」を濁点自動合成機能で瞬時に生成可能です。
              </p>
            </div>
            <div className="mt-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
              上部「機能」メニューから濁点・小書きを自動合成できます
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
                <h5 className="text-xs font-bold">「試し打ち」で文章確認</h5>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                上部バーの「<strong>試し打ち</strong>」を開くと、任意の文章を入力してリアルタイムに文字の並びや文字間バランスをプレビュー確認できます。
              </p>
            </div>
            <div className="mt-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
              ショートカット: Alt + T で即座に確認画面を起動できます
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
              <h5 className="text-xs font-extrabold">「フォント出力」からファイルを書き出し</h5>
              <p className="text-xs opacity-80">
                画面右上の「フォント出力」ボタンから、完成したフォントをPCやiPadですぐに使用できる形式（TTF / OTF / WOFF）としてダウンロードできます。
              </p>
            </div>
          </div>
          <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 hidden sm:block" />
        </div>
      </div>

      {/* Beginner FAQ / Troubleshooting Callout */}
      <div
        className={`p-4 rounded-xl border space-y-2.5 ${
          isLight
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : 'bg-amber-950/30 border-amber-800/60 text-amber-100'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 font-bold text-xs">
            <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>初心者のよくある疑問・お悩み解決</span>
          </div>
          <button
            onClick={onOpenGlossary}
            className="text-xs text-amber-800 dark:text-amber-300 underline font-bold hover:opacity-80 flex items-center space-x-1"
          >
            <span>用語・概念辞典を見る</span>
          </button>
        </div>

        <div className="space-y-2 text-xs leading-relaxed">
          <div>
            <strong>Q. 文字同士がくっついて読みにくい時は？</strong>
            <p className="text-stone-700 dark:text-stone-300 opacity-90 pl-3 mt-0.5">
              左右の余白（サイドベアリング）が不足している状態です。キーボードの <strong>Shift + Alt + S</strong> を押すか、右サイドバーの「字幅調律」を実行することで、最適な余白に自動調整されます。
            </p>
          </div>
          <div>
            <strong>Q. 手書きした線がガタガタになってしまう時は？</strong>
            <p className="text-stone-700 dark:text-stone-300 opacity-90 pl-3 mt-0.5">
              筆ツールの「手ブレ補正」を50〜75%程度に設定して描画するか、描画後に <strong>Alt + S（パス単純化）</strong> を実行することで、余分なアンカーポイントを削減して滑らかな曲線に最適化できます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
