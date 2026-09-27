import React, { useState } from 'react';
import {
  ExternalLink,
  Bug,
  Sparkles,
  Github,
  Copy,
  Check,
  AlertCircle,
  Laptop,
  Code2,
  Heart,
} from 'lucide-react';

interface FeedbackTabProps {
  isLight: boolean;
}

export const FeedbackTab: React.FC<FeedbackTabProps> = ({ isLight }) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // GitHub Repository & Issue URLs
  const GITHUB_REPO_URL = 'https://github.com/SagyouDarui900/FontCreator';
  const GITHUB_ISSUES_URL = 'https://github.com/SagyouDarui900/FontCreator/issues';
  const GITHUB_NEW_ISSUE_URL = 'https://github.com/SagyouDarui900/FontCreator/issues/new';

  const issueTemplateText = `【不具合報告 / バグ報告】
■ 発生した現象・エラー内容:
(例: 〇〇のボタンを押した時に画面が固まる / エクスポートしたフォントの〇〇が表示されない)

■ 再現手順:
1. 
2. 
3. 

■ ご利用の環境:
- 端末: (PC / Mac / iPad / iPhone / Android 等)
- OS: (Windows 11 / macOS / iOS 17 等)
- ブラウザ: (Google Chrome / Safari / Edge 等)

■ 補足情報・添付:
- プロジェクトJSONファイルの添付可否: (有 / 無)
- スクリーンショットやエラー画面の有無:`;

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(issueTemplateText);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  const handleCopyRepoUrl = () => {
    navigator.clipboard.writeText(GITHUB_REPO_URL);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intro Hero Banner */}
      <div
        className={`p-5 rounded-2xl border relative overflow-hidden ${
          isLight
            ? 'bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border-emerald-200'
            : 'bg-gradient-to-br from-[#132318] via-[#16291e] to-[#101913] border-emerald-800/80'
        }`}
      >
        <div className="relative z-10 space-y-2">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-emerald-700 text-white shadow-xs">
              <Github className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-stone-900 dark:text-emerald-100">
              GitHub リポジトリ & 不具合報告
            </h3>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed max-w-2xl">
            Font Creator Studio をご利用いただきありがとうございます。
            本アプリは生成AIを活用して個人開発を行っています。
            操作中の不具合・文字データの破損・フォント出力エラーなどがございましたら、GitHubのIssueよりお知らせいただけますと幸いです。
          </p>
        </div>
      </div>

      {/* GitHub Repository Card */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#152018] border-[#25362b]'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Code2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span className="text-xs font-bold text-stone-900 dark:text-emerald-100">
              公式 GitHub リポジトリ
            </span>
          </div>
          <p className="text-xs font-mono text-emerald-800 dark:text-emerald-300 break-all select-all">
            {GITHUB_REPO_URL}
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={handleCopyRepoUrl}
            className={`flex-1 sm:flex-initial py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 border transition-colors ${
              copiedUrl
                ? 'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300'
                : isLight
                ? 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
                : 'bg-[#1c2920] border-stone-700 text-stone-200 hover:bg-[#25382b]'
            }`}
            title="リポジトリURLをコピー"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedUrl ? 'URLコピー完了' : 'URLコピー'}</span>
          </button>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-initial py-2 px-3.5 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 bg-stone-900 hover:bg-stone-800 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-xs transition-colors"
          >
            <Github className="w-4 h-4" />
            <span>GitHubを開く</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        </div>
      </div>

      {/* Main Focus: Bug Report Card */}
      <div
        className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
          isLight
            ? 'bg-white border-rose-200 shadow-xs hover:border-rose-400'
            : 'bg-[#181d19] border-rose-950 hover:border-rose-800'
        }`}
      >
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
            <Bug className="w-5 h-5 shrink-0" />
            <h4 className="text-sm font-bold">不具合・バグの報告 (Issue)</h4>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            「作字データが消えてしまう」「フォント出力で文字が崩れる」「特定のボタンでエラーが発生する」などの動作不具合を発見された場合は、Issueにてご報告をお願いいたします。
          </p>
        </div>

        <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex flex-col sm:flex-row gap-2">
          <a
            href={GITHUB_NEW_ISSUE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
          >
            <Github className="w-4 h-4" />
            <span>GitHub Issue で不具合を報告する</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
          <button
            onClick={handleCopyTemplate}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 border transition-colors ${
              copiedTemplate
                ? 'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-300'
                : isLight
                ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                : 'bg-[#1f2a22] border-stone-700 text-stone-200 hover:bg-[#25362a]'
            }`}
            title="Issue投稿用の定型文をクリップボードにコピー"
          >
            {copiedTemplate ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedTemplate ? 'コピー完了' : '報告用テンプレートをコピー'}</span>
          </button>
        </div>
      </div>

      {/* Note about Generative AI & Feature Requests */}
      <div
        className={`p-4 rounded-xl border space-y-2.5 ${
          isLight ? 'bg-amber-50/70 border-amber-200' : 'bg-[#1d1b14] border-amber-900/60'
        }`}
      >
        <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>機能追加・ご要望についてのお知らせ</span>
        </div>
        <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed pl-1">
          本アプリは生成AIを活用して開発を進めている個人プロジェクトです。そのため、新規の大型機能や大幅な仕様変更のご要望には対応が難しい場合がございます。あらかじめご理解いただけますと幸いです。
          （操作上の明らかな不具合やバグの修正については、上記Issueよりご報告いただければ対応いたします）
        </p>
      </div>

      {/* Guide on Reporting Issues Safely */}
      <div
        className={`p-4 rounded-xl border space-y-3 ${
          isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#141e17] border-[#223326]'
        }`}
      >
        <div className="flex items-center space-x-2 text-stone-800 dark:text-emerald-200 font-bold text-xs">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>不具合をご報告いただく際のお願い</span>
        </div>
        <ul className="text-xs text-stone-600 dark:text-stone-300 space-y-2 list-disc list-inside leading-relaxed pl-1">
          <li>
            <strong>プロジェクトのバックアップ（JSON保存）</strong>: ヘッダーの「保存」ボタンからJSONファイルを書き出し、不具合報告時に添付または状況をお知らせいただくと調査がスムーズになります。
          </li>
          <li>
            <strong>ブラウザと端末情報</strong>: Google Chrome、Safari、Edgeなど使用ブラウザと、PC / タブレット等の端末種別を明記してください。
          </li>
          <li>
            <strong>再現手順の共有</strong>: 「どの画面でどのボタンをクリックしたか」「直前にどんな作字操作を行ったか」をお知らせください。
          </li>
        </ul>
      </div>

      {/* Technical & Environment Details */}
      <div
        className={`p-4 rounded-xl border space-y-2.5 ${
          isLight ? 'bg-stone-50/80 border-stone-200' : 'bg-[#121c15] border-[#223326]'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Laptop className="w-4 h-4 text-stone-500" />
            <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
              現在の動作環境・アプリ情報
            </span>
          </div>
          <span className="text-[10.5px] px-2 py-0.5 rounded font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
            PWA Ready / Offline Supported
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600 dark:text-stone-400 pt-1">
          <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-[#16221a] border border-stone-200 dark:border-stone-800">
            <span>アプリバージョン:</span>
            <span className="font-mono font-bold text-stone-900 dark:text-stone-100">v2.1.0</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-[#16221a] border border-stone-200 dark:border-stone-800">
            <span>データ保存形式:</span>
            <span className="font-mono font-bold text-stone-900 dark:text-stone-100">IndexedDB + LocalStorage</span>
          </div>
        </div>
      </div>
    </div>
  );
};
