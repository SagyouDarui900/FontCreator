import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  isLight?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ isLight = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition shadow-xs ${
          isLight
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold'
        }`}
        title="アプリをデバイスにインストール (オフライン対応)"
      >
        <Download className="w-3.5 h-3.5" />
        <span>アプリ追加</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition ${
            isLight
              ? 'border border-stone-300 text-stone-700 hover:bg-stone-100'
              : 'border border-slate-700 text-slate-200 hover:bg-slate-800'
          }`}
          title="iOSでのインストール手順"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>iOSに追加</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div
              className={`w-full max-w-sm rounded-xl p-5 shadow-2xl border ${
                isLight
                  ? 'bg-white text-stone-900 border-stone-200'
                  : 'bg-slate-900 text-slate-100 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-slate-800">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  <span>iPhone / iPad に追加</span>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-md hover:bg-stone-200 dark:hover:bg-slate-800 text-stone-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 text-xs space-y-2.5 leading-relaxed text-stone-600 dark:text-slate-300">
                <p>
                  Safariブラウザで表示している場合、ホーム画面に追加することでアプリとしてオフライン利用が可能です。
                </p>
                <ol className="list-decimal list-inside space-y-1.5 font-medium pl-1">
                  <li>画面下部（または上部）の <strong>「共有」ボタン</strong> をタップ</li>
                  <li>メニューを下にスクロールし <strong>「ホーム画面に追加」</strong> を選択</li>
                  <li>右上の <strong>「追加」</strong> をタップして完了</li>
                </ol>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
