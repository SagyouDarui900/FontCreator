import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
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
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in Font Studio:', error, errorInfo);
  }

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
            <h1 className="text-xl font-bold text-stone-800 mb-2">画面の読み込みでエラーが発生しました</h1>
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
              作業データの一時的な不整合またはブラウザの表示更新中に問題が生じた可能性があります。再読み込みをお試しください。
            </p>
            {this.state.error && (
              <div className="w-full max-h-28 overflow-y-auto bg-stone-50 p-2.5 rounded-lg text-left text-[11px] font-mono text-stone-600 border border-stone-200 mb-5 break-all">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                再読み込み
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
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
