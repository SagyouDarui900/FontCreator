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
  BookOpen,
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
              無料
            </span>
          </div>
          <p className="text-xs leading-relaxed opacity-90">
            ブラウザ上で文字を描画し、PCや各種デザインアプリで使用可能なフォントファイル（.ttf / .otf）を作成・書き出しできます。マウス、スタイラスペン、タッチ操作に対応しています。
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
            <span>1文字から出力可能</span>
          </div>
          <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-snug">
            すべての文字を作成する必要はありません。1文字または任意の文字数のみでもフォントファイルとして書き出して使用できます。
          </p>
        </div>

        <div
          className={`p-3 rounded-xl border space-y-1 ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#18241d] border-[#25362b]'
          }`}
        >
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>未作成文字のフォールバック表示</span>
          </div>
          <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-snug">
            未作成の文字が入力された場合は、OSの標準フォントによる代替表示（フォールバック）が適用されます。
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
            作成したフォントデータの著作権は制作者に帰属します。商用・非商用を問わず利用・配布が可能です。
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
                フリーハンド
              </span>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                <strong>筆ツール [B]</strong> を選択し、タブレットやマウスで文字を描画します。手ブレ補正機能により入力座標が平滑化され、ベクター輪郭へ変換されます。
              </p>
            </div>
            <div className="text-[10.5px] text-emerald-700 dark:text-emerald-400 font-medium">
              ペン先プリセットから線のスタイルを選択できます。
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
                画像参照
              </span>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                紙に書いた文字の写真などを上部バーの「下絵」から読み込みます。背景に表示された画像を参照しながら輪郭を描画します。
              </p>
            </div>
            <div className="text-[10.5px] text-teal-700 dark:text-teal-400 font-medium">
              下絵の不透明度や配置倍率を調整できます。
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
                <h5 className="text-xs font-extrabold">③ 幾何学・図形作図コース</h5>
              </div>
              <span className="text-[9.5px] px-1.5 py-0.2 rounded font-mono font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 inline-block">
                幾何図形
              </span>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                矩形・円・直線ツールやペンツールを組み合わせて作図します。ガイド線やスナップ機能を用いて配置し、パス結合ツールで輪郭を統合します。
              </p>
            </div>
            <div className="text-[10.5px] text-indigo-700 dark:text-indigo-400 font-medium">
              定規機能を利用してストローク幅を計測できます。
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
                <strong>筆ツール [B]</strong> によるフリーハンド描画、または <strong>ペンツール [P]</strong> でアンカーポイントを配置して描きます。中央の薄緑の枠（850×850）を目安に収めます。
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
                <h5 className="text-xs font-bold">余白計算とグリフ合成の適用</h5>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                <strong>Shift + Alt + S</strong> を押すと文字の左右余白（サイドベアリング）が数値計算され適用されます。「か」の輪郭データから濁点付き文字を生成する合成処理も可能です。
              </p>
            </div>
            <div className="mt-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
              上部「機能」メニューから濁点・小書き文字の合成処理を実行できます
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
                上部バーの「<strong>試し打ち</strong>」を開き、任意の文字列を入力して文字の並びや文字間隔のバランスを確認します。
              </p>
            </div>
            <div className="mt-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
              ショートカット: Alt + T で確認画面を表示できます
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
                画面右上の「フォント出力」ボタンから、フォントファイル（TTF / OTF / WOFF）を書き出してダウンロードします。
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
            <span>よくある質問と対処法</span>
          </div>
          <button
            onClick={onOpenGlossary}
            className="text-xs text-amber-800 dark:text-amber-300 underline font-bold hover:opacity-80 flex items-center space-x-1 cursor-pointer"
          >
            <span>用語・概念辞典を見る</span>
          </button>
        </div>

        <div className="space-y-2 text-xs leading-relaxed">
          <div>
            <strong>Q. 文字同士が重なる・間隔が狭い場合は？</strong>
            <p className="text-stone-700 dark:text-stone-300 opacity-90 pl-3 mt-0.5">
              左右の余白（サイドベアリング）が不足しています。キーボードの <strong>Shift + Alt + S</strong> を押すか、右サイドバーの「字幅自動設定」を実行することで余白を再計算して設定できます。
            </p>
          </div>
          <div>
            <strong>Q. 手書きした線の凹凸を抑えるには？</strong>
            <p className="text-stone-700 dark:text-stone-300 opacity-90 pl-3 mt-0.5">
              筆ツールの「手ブレ補正」の数値を上げて描画するか、描画後に <strong>Alt + S（パス単純化）</strong> を実行して不要なアンカーポイントを削減します。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
