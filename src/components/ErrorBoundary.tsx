import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Download } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  hasSavedBackup: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
      hasSavedBackup: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, hasSavedBackup: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Font Studio:', error, errorInfo);
  }

  private handleExportBackup = async () => {
    try {
      let jsonString = localStorage.getItem('font_editor_project_data_v2');

      if (!jsonString) {
        try {
          const { loadProjectFromIndexedDB } = await import('../utils/indexedDBStorage');
          const result = await loadProjectFromIndexedDB();
          if (result && result.project) {
            jsonString = JSON.stringify(result.project, null, 2);
          }
        } catch {
          // ignore
        }
      }

      if (!jsonString) {
        return;
      }

      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `font_rescue_backup_${Date.now()}.fontproj.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this.setState({ hasSavedBackup: true });
    } catch (e) {
      console.error('Failed to export rescue backup:', e);
    }
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('font_editor_project_data_v2');
      localStorage.removeItem('font_editor_theme_mode');
    } catch {
      // Ignored
    }
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#f7faf8] text-stone-900 p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-xl border border-emerald-100 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-stone-800 mb-2">画面の表示で予期せぬエラーが発生しました</h1>
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
              作業データの一時的な不整合または描画中に例外が生じました。初期化する前に、現在の作字データを安全にJSON保存できます。
            </p>
            {this.state.error && (
              <div className="w-full max-h-28 overflow-y-auto bg-stone-50 p-2.5 rounded-lg text-left text-[11px] font-mono text-stone-600 border border-stone-200 mb-5 break-all">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            {/* Rescue backup button */}
            <div className="w-full mb-3">
              <button
                type="button"
                onClick={this.handleExportBackup}
                className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  this.state.hasSavedBackup
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-md'
                }`}
              >
                <Download className="w-4 h-4" />
                {this.state.hasSavedBackup ? '救済バックアップJSONを保存完了' : 'プロジェクトを救済保存 (JSONエクスポート)'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 px-4 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                再読み込み
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-600 border border-stone-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                title="ローカル保存データを初期化して復元します"
              >
                キャッシュ初期化
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
