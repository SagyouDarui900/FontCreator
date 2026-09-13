import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Sparkles,
  Search,
  ExternalLink,
  Wand2,
  Maximize2,
  ChevronRight,
  Layers,
  Activity,
  Zap,
  Scissors,
  SlidersHorizontal,
  Check,
  ArrowRight,
  Scale,
  Minimize2,
  Compass,
} from 'lucide-react';
import { FontProject, GlyphData, PathContour } from '../types';
import { ThemeMode } from '../utils/theme';
import {
  contoursToSvgPath,
  normalizeGlyphContoursWinding,
  NodeOptimizationOptions,
  StrokeEqualizationOptions,
  ExtremaOptimizationOptions,
} from '../utils/pathUtils';
import {
  checkFontQuality,
  fixQualityIssue,
  batchFixQualityIssues,
  batchOptimizeProjectNodes,
  BatchNodeOptimizationResult,
  batchEqualizeProjectStrokes,
  BatchStrokeEqualizationResult,
  batchOptimizeProjectExtrema,
  BatchExtremaOptimizationResult,
  FontQualityReport,
  QualityIssue,
  QualityIssueType,
  QualitySeverity,
} from '../utils/qualityChecker';

interface FontQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
  onSelectGlyph?: (unicode: number) => void;
  theme: ThemeMode;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  commitHistory?: () => void;
}

type TabFilter = 'all' | QualityIssueType;

export const FontQualityModal: React.FC<FontQualityModalProps> = ({
  isOpen,
  onClose,
  project,
  setProject,
  onSelectGlyph,
  theme,
  onShowToast,
  commitHistory,
}) => {
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | QualitySeverity>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [report, setReport] = useState<FontQualityReport | null>(null);

  // Node Optimization panel state
  const [isOptimizePanelOpen, setIsOptimizePanelOpen] = useState<boolean>(false);
  const [optLevel, setOptLevel] = useState<'mild' | 'normal' | 'strong'>('normal');
  const [optScope, setOptScope] = useState<'all' | 'excessive' | 'filtered'>('all');
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [lastOptimizationResult, setLastOptimizationResult] = useState<BatchNodeOptimizationResult | null>(null);

  // Stroke Equalization panel state
  const [isEqualizePanelOpen, setIsEqualizePanelOpen] = useState<boolean>(false);
  const [eqMode, setEqMode] = useState<'balanced' | 'boost_thin' | 'shrink_thick'>('balanced');
  const [eqStrength, setEqStrength] = useState<number>(0.65);
  const [eqScope, setEqScope] = useState<'all' | 'uneven' | 'filtered'>('all');
  const [isEqualizing, setIsEqualizing] = useState<boolean>(false);
  const [lastEqualizationResult, setLastEqualizationResult] = useState<BatchStrokeEqualizationResult | null>(null);

  // Extrema Optimization panel state
  const [isExtremaPanelOpen, setIsExtremaPanelOpen] = useState<boolean>(false);
  const [extAlignAxis, setExtAlignAxis] = useState<boolean>(true);
  const [extSensitivity, setExtSensitivity] = useState<'normal' | 'strict' | 'fine'>('normal');
  const [extScope, setExtScope] = useState<'all' | 'missing' | 'filtered'>('all');
  const [isOptimizingExtrema, setIsOptimizingExtrema] = useState<boolean>(false);
  const [lastExtremaResult, setLastExtremaResult] = useState<BatchExtremaOptimizationResult | null>(null);

  const notify = (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    if (onShowToast) {
      onShowToast(text, type);
    }
  };

  // Run or refresh report
  const runScan = () => {
    setIsScanning(true);
    // Slight tick to let UI show loading animation smoothly
    setTimeout(() => {
      const rep = checkFontQuality(project);
      setReport(rep);
      setIsScanning(false);
    }, 50);
  };

  useEffect(() => {
    if (isOpen) {
      runScan();
    }
  }, [isOpen, project]);

  // Filtered issue list
  const filteredIssues = useMemo(() => {
    if (!report) return [];
    return report.issues.filter((issue) => {
      // Tab filter
      if (activeTab !== 'all' && issue.type !== activeTab) {
        return false;
      }
      // Severity filter
      if (severityFilter !== 'all' && issue.severity !== severityFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const charMatch = issue.char.toLowerCase().includes(query);
        const nameMatch = issue.glyphName.toLowerCase().includes(query);
        const hexMatch = issue.unicode.toString(16).toLowerCase().includes(query);
        const titleMatch = issue.title.toLowerCase().includes(query);
        if (!charMatch && !nameMatch && !hexMatch && !titleMatch) {
          return false;
        }
      }
      return true;
    });
  }, [report, activeTab, severityFilter, searchQuery]);

  // Single Fix
  const handleFixIssue = (issue: QualityIssue) => {
    if (commitHistory) commitHistory();
    const res = fixQualityIssue(project, issue);
    if (res.success) {
      setProject(res.updatedProject);
      notify(res.message, 'success');
      runScan();
    } else {
      notify(res.message, 'error');
    }
  };

  // Batch Fix by Type
  const handleBatchFix = (type?: QualityIssueType) => {
    if (!report) return;
    if (commitHistory) commitHistory();
    const res = batchFixQualityIssues(project, report.issues, type);
    if (res.fixedCount > 0) {
      setProject(res.updatedProject);
      notify(`${res.fixedCount} 件の問題を一括修正しました`, 'success');
      runScan();
    } else {
      notify('自動修正可能な対象がありませんでした', 'info');
    }
  };

  // Node Optimization (Redundant collinear nodes reduction & path smoothing)
  const handleRunNodeOptimization = () => {
    if (isOptimizing) return;
    setIsOptimizing(true);

    setTimeout(() => {
      try {
        if (commitHistory) commitHistory();

        let targetUnicodes: number[] | undefined = undefined;
        if (optScope === 'excessive') {
          const excIssues = (report?.issues || []).filter((i) => i.type === 'excessive_nodes');
          targetUnicodes = Array.from(new Set(excIssues.map((i) => i.unicode)));
          if (targetUnicodes.length === 0) {
            notify('過剰ノードとして指摘された文字はありません', 'info');
            setIsOptimizing(false);
            return;
          }
        } else if (optScope === 'filtered') {
          targetUnicodes = Array.from(new Set(filteredIssues.map((i) => i.unicode)));
          if (targetUnicodes.length === 0) {
            notify('現在表示されている文字がありません', 'info');
            setIsOptimizing(false);
            return;
          }
        }

        const res = batchOptimizeProjectNodes(project, targetUnicodes, {
          level: optLevel,
          preserveSharpCorners: true,
          maxBboxDeviation: 1.5,
        });

        setLastOptimizationResult(res);

        if (res.totalReducedNodes > 0) {
          setProject(res.updatedProject);
          notify(
            `${res.optimizedGlyphsCount} 文字の直線冗長ノード ${res.totalReducedNodes} 個を間引き、パスを滑らかに最適化しました（削減率: ${res.reductionPercentage}%）`,
            'success'
          );
          runScan();
        } else {
          notify('直線上の冗長ノードは見つかりませんでした（すでに最適化されています）', 'info');
        }
      } catch (err) {
        console.error('Node optimization error:', err);
        notify('ノード最適化処理中にエラーが発生しました', 'error');
      } finally {
        setIsOptimizing(false);
      }
    }, 50);
  };

  // Single glyph node optimization
  const handleOptimizeSingleGlyph = (unicode: number, char: string) => {
    if (commitHistory) commitHistory();
    const res = batchOptimizeProjectNodes(project, [unicode], {
      level: optLevel,
      preserveSharpCorners: true,
      maxBboxDeviation: 1.5,
    });

    if (res.totalReducedNodes > 0) {
      setProject(res.updatedProject);
      notify(
        `文字「${char}」の直線冗長ノード ${res.totalReducedNodes} 個を間引き、パスを滑らかに最適化しました`,
        'success'
      );
      runScan();
    } else {
      notify(`文字「${char}」には直線上の冗長ノードは見つかりませんでした`, 'info');
    }
  };

  // Stroke Equalization (Analyze stroke widths and equalize thin/thick spots)
  const handleRunStrokeEqualization = () => {
    if (isEqualizing) return;
    setIsEqualizing(true);

    setTimeout(() => {
      try {
        if (commitHistory) commitHistory();

        let targetUnicodes: number[] | undefined = undefined;
        if (eqScope === 'uneven') {
          const unevenIssues = (report?.issues || []).filter((i) => i.type === 'uneven_stroke');
          targetUnicodes = Array.from(new Set(unevenIssues.map((i) => i.unicode)));
          if (targetUnicodes.length === 0) {
            notify('線幅の不均一として指摘された文字はありません', 'info');
            setIsEqualizing(false);
            return;
          }
        } else if (eqScope === 'filtered') {
          targetUnicodes = Array.from(new Set(filteredIssues.map((i) => i.unicode)));
          if (targetUnicodes.length === 0) {
            notify('現在表示されている文字がありません', 'info');
            setIsEqualizing(false);
            return;
          }
        }

        const res = batchEqualizeProjectStrokes(project, targetUnicodes, {
          mode: eqMode,
          strength: eqStrength,
          preserveSharpCorners: true,
        });

        setLastEqualizationResult(res);

        if (res.equalizedGlyphsCount > 0) {
          setProject(res.updatedProject);
          notify(
            `${res.equalizedGlyphsCount} 文字のストローク線幅を均一化しました (細線補強: ${res.totalThinFixed}箇所, 太線調整: ${res.totalThickFixed}箇所)`,
            'success'
          );
          runScan();
        } else {
          notify('線幅の調整対象は見つかりませんでした（すでに均一です）', 'info');
        }
      } catch (err) {
        console.error('Stroke equalization error:', err);
        notify('ストローク均一化処理中にエラーが発生しました', 'error');
      } finally {
        setIsEqualizing(false);
      }
    }, 50);
  };

  // Single glyph stroke equalization (1-click from issue item or toolbar)
  const handleEqualizeSingleGlyph = (unicode: number, char: string) => {
    if (commitHistory) commitHistory();
    const res = batchEqualizeProjectStrokes(project, [unicode], {
      mode: eqMode,
      strength: eqStrength,
      preserveSharpCorners: true,
    });

    if (res.equalizedGlyphsCount > 0) {
      setProject(res.updatedProject);
      notify(
        `文字「${char}」のストローク線幅を均一化しました (補強: ${res.totalThinFixed}箇所, 調整: ${res.totalThickFixed}箇所)`,
        'success'
      );
      runScan();
    } else {
      notify(`文字「${char}」の線幅はすでにバランスが取れています`, 'info');
    }
  };

  // Extrema Optimization (Analyze Bézier extrema and insert nodes with axis-aligned handles)
  const handleRunExtremaOptimization = () => {
    if (isOptimizingExtrema) return;
    setIsOptimizingExtrema(true);

    setTimeout(() => {
      try {
        if (commitHistory) commitHistory();

        let targetUnicodes: number[] | undefined = undefined;
        if (extScope === 'missing') {
          const missingIssues = (report?.issues || []).filter((i) => i.type === 'missing_extrema');
          targetUnicodes = Array.from(new Set(missingIssues.map((i) => i.unicode)));
          if (targetUnicodes.length === 0) {
            notify('極点ノードの不足として指摘された文字はありません', 'info');
            setIsOptimizingExtrema(false);
            return;
          }
        } else if (extScope === 'filtered') {
          targetUnicodes = Array.from(new Set(filteredIssues.map((i) => i.unicode)));
          if (targetUnicodes.length === 0) {
            notify('現在表示されている文字がありません', 'info');
            setIsOptimizingExtrema(false);
            return;
          }
        }

        const minDist = extSensitivity === 'strict' ? 8 : extSensitivity === 'fine' ? 3 : 5;
        const res = batchOptimizeProjectExtrema(project, targetUnicodes, {
          alignHandlesToAxis: extAlignAxis,
          minDistanceThreshold: minDist,
          minParameterThreshold: 0.03,
        });

        setLastExtremaResult(res);

        if (res.optimizedGlyphsCount > 0) {
          setProject(res.updatedProject);
          notify(
            `${res.optimizedGlyphsCount} 文字のベジェ曲線極点に合計 ${res.totalNodesAdded} 個のノードを追加・最適化しました`,
            'success'
          );
          runScan();
        } else {
          notify('極点ノードの追加対象は見つかりませんでした（すでに最適化されています）', 'info');
        }
      } catch (err) {
        console.error('Extrema optimization error:', err);
        notify('極点最適化処理中にエラーが発生しました', 'error');
      } finally {
        setIsOptimizingExtrema(false);
      }
    }, 50);
  };

  // Single glyph extrema optimization
  const handleOptimizeSingleGlyphExtrema = (unicode: number, char: string) => {
    if (commitHistory) commitHistory();
    const minDist = extSensitivity === 'strict' ? 8 : extSensitivity === 'fine' ? 3 : 5;
    const res = batchOptimizeProjectExtrema(project, [unicode], {
      alignHandlesToAxis: extAlignAxis,
      minDistanceThreshold: minDist,
      minParameterThreshold: 0.03,
    });

    if (res.optimizedGlyphsCount > 0) {
      setProject(res.updatedProject);
      notify(
        `文字「${char}」のベジェ曲線極点にノードを ${res.totalNodesAdded} 箇所追加・最適化しました`,
        'success'
      );
      runScan();
    } else {
      notify(`文字「${char}」の極点ノードはすでに最適化されています`, 'info');
    }
  };

  // Jump to character in Canvas
  const handleGoToGlyph = (unicode: number) => {
    if (onSelectGlyph) {
      onSelectGlyph(unicode);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-5xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors ${
          isLight
            ? 'bg-white border-stone-200 text-stone-900 shadow-emerald-950/10'
            : 'bg-[#151f18] border-[#25362b] text-emerald-100 shadow-black/50'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isLight ? 'bg-stone-50/80 border-stone-200' : 'bg-[#111a14] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isLight
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                  : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">フォント品質チェック</h2>
                {report && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                      report.score >= 90
                        ? isLight
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : report.score >= 70
                        ? isLight
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                        : isLight
                        ? 'bg-rose-100 text-rose-900 border-rose-300'
                        : 'bg-rose-950 text-rose-300 border-rose-800'
                    }`}
                  >
                    品質スコア: {report.score} / 100
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 ${
                    isLight
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-emerald-950/50 text-emerald-300 border-emerald-800/70'
                  }`}
                  title="字形、角の尖り、線の太さ、曲率を崩さない安全な修正アルゴリズムを適用します"
                >
                  <ShieldCheck className="w-3 h-3" />
                  形状保護モード
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                字形重複・交差・過剰ノード・線幅の偏り・ベースラインの総合検査と自動最適化
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Extremum Optimization Button */}
            <button
              onClick={() => {
                setIsExtremaPanelOpen((prev) => !prev);
                if (!isExtremaPanelOpen) {
                  setIsEqualizePanelOpen(false);
                  setIsOptimizePanelOpen(false);
                }
              }}
              className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs ${
                isExtremaPanelOpen
                  ? isLight
                    ? 'bg-cyan-700 text-white border-cyan-800 shadow-sm ring-2 ring-cyan-500/20'
                    : 'bg-cyan-600 text-white border-cyan-500 shadow-sm ring-2 ring-cyan-500/40'
                  : isLight
                  ? 'bg-cyan-50 text-cyan-900 border-cyan-200 hover:bg-cyan-100'
                  : 'bg-cyan-950/60 text-cyan-200 border-cyan-800/80 hover:bg-cyan-900'
              }`}
              title="ベジェ曲線の極点（extremum）を分析し、必要に応じてノードを追加・配置して輪郭を数学的に正しく最適化するツール"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span className="hidden sm:inline">極点最適化</span>
            </button>

            {/* Stroke Equalization Button */}
            <button
              onClick={() => {
                setIsEqualizePanelOpen((prev) => !prev);
                if (!isEqualizePanelOpen) {
                  setIsOptimizePanelOpen(false);
                  setIsExtremaPanelOpen(false);
                }
              }}
              className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs ${
                isEqualizePanelOpen
                  ? isLight
                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-emerald-600 text-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/40'
                  : isLight
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900'
              }`}
              title="線幅を幾何学的に分析し、かすれ線や潰れを自動均一化するツール"
            >
              <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">ストローク均一化</span>
            </button>

            {/* Node Optimization Button */}
            <button
              onClick={() => {
                setIsOptimizePanelOpen((prev) => !prev);
                if (!isOptimizePanelOpen) {
                  setIsEqualizePanelOpen(false);
                  setIsExtremaPanelOpen(false);
                }
              }}
              className={`p-2 sm:px-3 sm:py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs ${
                isOptimizePanelOpen
                  ? isLight
                    ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-emerald-600 text-white border-emerald-500 shadow-sm ring-2 ring-emerald-500/40'
                  : isLight
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900'
              }`}
              title="ほぼ直線上に並ぶ冗長ノードを間引き、パスを滑らかにする最適化ツール"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span className="hidden sm:inline">ノード最適化</span>
            </button>

            <button
              onClick={runScan}
              disabled={isScanning}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                  : 'bg-[#1a261f] border-[#25362b] text-emerald-200 hover:bg-[#223328]'
              }`}
              title="フォント全体を再検査"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">再検査</span>
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl border transition-colors ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-500 hover:bg-stone-100'
                  : 'bg-[#1a261f] border-[#25362b] text-stone-400 hover:bg-[#223328]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stroke Equalization Settings & Execution Panel */}
        {isEqualizePanelOpen && (
          <div
            className={`px-5 py-4 border-b transition-all text-xs ${
              isLight
                ? 'bg-emerald-50/70 border-emerald-200 text-stone-800'
                : 'bg-[#102016] border-[#223d2b] text-emerald-100'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
                    isLight
                      ? 'bg-emerald-700 text-white border-emerald-800'
                      : 'bg-emerald-500 text-black border-emerald-400'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm text-stone-900 dark:text-white">
                      ストローク均一化（線幅分析 &amp; かすれ・潰れ自動補正）
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                        isLight
                          ? 'bg-emerald-100/80 text-emerald-800 border-emerald-300'
                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      角・形状保護
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed">
                    文字全体のストローク線幅（太さ）を幾何学的に測定し、過度に細い箇所（かすれ）や太い箇所（潰れ）を自動調整して均等なストローク感に仕上げます。
                    トメ・ハネなどの鋭角コーナーは保護されます。
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEqualizePanelOpen(false)}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isLight
                    ? 'bg-white border-stone-200 text-stone-400 hover:text-stone-700'
                    : 'bg-[#16271c] border-[#253f2c] text-stone-400 hover:text-white'
                }`}
                title="パネルを閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Option 1: Equalization Mode */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-white border-emerald-200/80' : 'bg-[#142319] border-[#223d2b]'
                }`}
              >
                <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center space-x-1">
                  <SlidersHorizontal className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>均一化モード</span>
                </div>
                <div className="space-y-1">
                  {[
                    {
                      id: 'balanced',
                      label: 'バランス調整（推奨）',
                      desc: '中央値に合わせて、過度な細線を補強しつつ太線部をスリム化',
                    },
                    {
                      id: 'boost_thin',
                      label: '細線・かすれ補強のみ',
                      desc: '太線は維持し、かすれや欠落リスクのある細い箇所のみ太く補強',
                    },
                    {
                      id: 'shrink_thick',
                      label: '太線・潰れスリム化のみ',
                      desc: '細線は維持し、黒く潰れやすい太い箇所のみシェイプアップ',
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEqMode(m.id as any)}
                      className={`w-full text-left p-2 rounded-lg border transition-all text-xs ${
                        eqMode === m.id
                          ? isLight
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-500/20'
                            : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold ring-1 ring-emerald-500/30'
                          : isLight
                          ? 'border-transparent hover:bg-stone-50 text-stone-700'
                          : 'border-transparent hover:bg-[#1a2c20] text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{m.label}</span>
                        {eqMode === m.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 font-normal mt-0.5 leading-snug">
                        {m.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 2: Target Scope */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-white border-emerald-200/80' : 'bg-[#142319] border-[#223d2b]'
                }`}
              >
                <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center space-x-1">
                  <Layers className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>対象文字の範囲</span>
                </div>
                <div className="space-y-1">
                  {[
                    {
                      id: 'all',
                      label: 'すべての文字（全文字一括）',
                      desc: `フォントプロジェクト内の全登録グリフ（${report?.totalGlyphsChecked || 0} 文字）`,
                    },
                    {
                      id: 'uneven',
                      label: '線幅の偏り・問題検出文字のみ',
                      desc: `品質検査でかすれ/潰れが指摘された文字（${report?.categoryCounts.uneven_stroke || 0} 文字）`,
                    },
                    {
                      id: 'filtered',
                      label: '現在表示・検索中の文字',
                      desc: `リストに表示されている指摘文字（${filteredIssues.length} 件）`,
                    },
                  ].map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setEqScope(sc.id as any)}
                      className={`w-full text-left p-2 rounded-lg border transition-all text-xs ${
                        eqScope === sc.id
                          ? isLight
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-500/20'
                            : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold ring-1 ring-emerald-500/30'
                          : isLight
                          ? 'border-transparent hover:bg-stone-50 text-stone-700'
                          : 'border-transparent hover:bg-[#1a2c20] text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{sc.label}</span>
                        {eqScope === sc.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 font-normal mt-0.5 leading-snug">
                        {sc.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 3: Strength & Action */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-white border-emerald-200/80' : 'bg-[#142319] border-[#223d2b]'
                }`}
              >
                <div>
                  <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Sliders className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>補正の強さ</span>
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      {Math.round(eqStrength * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={eqStrength}
                    onChange={(e) => setEqStrength(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-600 mb-2"
                  />
                  <ul className="text-[11px] text-stone-600 dark:text-stone-300 space-y-1 leading-relaxed">
                    <li className="flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>角・筆先の角度 &gt; 35° は鋭さを自動保護</span>
                    </li>
                    <li className="flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>輪郭の自己反転・交差歪みを自動防止</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleRunStrokeEqualization}
                    disabled={isEqualizing}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-sm ${
                      isLight
                        ? 'bg-emerald-700 text-white hover:bg-emerald-800 active:scale-98'
                        : 'bg-emerald-500 text-black hover:bg-emerald-400 active:scale-98'
                    }`}
                  >
                    {isEqualizing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>線幅均一化処理中...</span>
                      </>
                    ) : (
                      <>
                        <Scale className="w-3.5 h-3.5" />
                        <span>
                          {eqScope === 'all'
                            ? '全文字のストロークを均一化'
                            : eqScope === 'uneven'
                            ? '線幅偏り文字を均一化'
                            : '表示中文字のストロークを均一化'}
                        </span>
                      </>
                    )}
                  </button>

                  {lastEqualizationResult && (
                    <div
                      className={`text-[10px] p-2 rounded-lg text-center font-medium border ${
                        isLight
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      直近の実行結果: {lastEqualizationResult.equalizedGlyphsCount} 文字を均一化（細線補強:{' '}
                      <span className="font-bold">{lastEqualizationResult.totalThinFixed}</span> 箇所 / 太線調整:{' '}
                      <span className="font-bold">{lastEqualizationResult.totalThickFixed}</span> 箇所）
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Node Optimization Settings & Execution Panel */}
        {isOptimizePanelOpen && (
          <div
            className={`px-5 py-4 border-b transition-all text-xs ${
              isLight
                ? 'bg-emerald-50/70 border-emerald-200 text-stone-800'
                : 'bg-[#102016] border-[#223d2b] text-emerald-100'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
                    isLight
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-emerald-500 text-black border-emerald-400'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm text-stone-900 dark:text-white">
                      ノード最適化（冗長点の間引き &amp; パス平滑化）
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                        isLight
                          ? 'bg-emerald-100/80 text-emerald-800 border-emerald-300'
                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      形状保護保証
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed">
                    ほぼ直線上に並ぶ不要な中間点や重複ノードを間引き、文字の輪郭パスを美しく滑らかに整流します。
                    角（トメ・ハネ・コーナー）や直線の張り、縦横比、曲率は厳格に保護されます。
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOptimizePanelOpen(false)}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isLight
                    ? 'bg-white border-stone-200 text-stone-400 hover:text-stone-700'
                    : 'bg-[#16271c] border-[#253f2c] text-stone-400 hover:text-white'
                }`}
                title="パネルを閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Option 1: Optimization Strength (Level) */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-white border-emerald-200/80' : 'bg-[#142319] border-[#223d2b]'
                }`}
              >
                <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center space-x-1">
                  <SlidersHorizontal className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>最適化の強度</span>
                </div>
                <div className="space-y-1">
                  {[
                    {
                      id: 'mild',
                      label: 'マイルド（形状変化 0%）',
                      desc: '直線上の共線ノードと重複点のみを精密に除去。文字形状は完全に100%同一',
                    },
                    {
                      id: 'normal',
                      label: '標準（推奨・形状保持 99.8%）',
                      desc: '直線上の冗長ノード除去 ＋ 緩やかな曲線の微小な手ブレを滑らかに整流',
                    },
                    {
                      id: 'strong',
                      label: '強力（形状保持 99.0%）',
                      desc: '密集した過剰ノードをしっかり間引いてスリム化。扱いやすいパスに軽量化',
                    },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setOptLevel(lvl.id as any)}
                      className={`w-full text-left p-2 rounded-lg border transition-all text-xs ${
                        optLevel === lvl.id
                          ? isLight
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-500/20'
                            : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold ring-1 ring-emerald-500/30'
                          : isLight
                          ? 'border-transparent hover:bg-stone-50 text-stone-700'
                          : 'border-transparent hover:bg-[#1a2c20] text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{lvl.label}</span>
                        {optLevel === lvl.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 font-normal mt-0.5 leading-snug">
                        {lvl.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 2: Target Scope */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-white border-emerald-200/80' : 'bg-[#142319] border-[#223d2b]'
                }`}
              >
                <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center space-x-1">
                  <Layers className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>対象文字の範囲</span>
                </div>
                <div className="space-y-1">
                  {[
                    {
                      id: 'all',
                      label: 'すべての文字（全文字一括）',
                      desc: `フォントプロジェクト内の全登録グリフ（${report?.totalGlyphsChecked || 0} 文字）`,
                    },
                    {
                      id: 'excessive',
                      label: '過剰ノードが検出された文字のみ',
                      desc: `品質検査でノード数過剰と判定された文字（${report?.categoryCounts.excessive_nodes || 0} 文字）`,
                    },
                    {
                      id: 'filtered',
                      label: '現在表示・検索中の文字',
                      desc: `リストに表示されている指摘文字（${filteredIssues.length} 件）`,
                    },
                  ].map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setOptScope(sc.id as any)}
                      className={`w-full text-left p-2 rounded-lg border transition-all text-xs ${
                        optScope === sc.id
                          ? isLight
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-500/20'
                            : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold ring-1 ring-emerald-500/30'
                          : isLight
                          ? 'border-transparent hover:bg-stone-50 text-stone-700'
                          : 'border-transparent hover:bg-[#1a2c20] text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{sc.label}</span>
                        {optScope === sc.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 font-normal mt-0.5 leading-snug">
                        {sc.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Column & Guarantees */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-white border-emerald-200/80' : 'bg-[#142319] border-[#223d2b]'
                }`}
              >
                <div>
                  <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>形状保護セーフガード</span>
                  </div>
                  <ul className="text-[11px] text-stone-600 dark:text-stone-300 space-y-1 leading-relaxed">
                    <li className="flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>トメ・ハネ・鋭角コーナーを 100% 保持</span>
                    </li>
                    <li className="flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>バウンディングボックスのズレ ≤ 1.5px (0.15%)</span>
                    </li>
                    <li className="flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>角筆などの直線図形は角ノードのみ保持</span>
                    </li>
                    <li className="flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>いつでも元に戻す (Ctrl+Z) 可能</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleRunNodeOptimization}
                    disabled={isOptimizing}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-sm ${
                      isLight
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-98'
                        : 'bg-emerald-500 text-black hover:bg-emerald-400 active:scale-98'
                    }`}
                  >
                    {isOptimizing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>最適化処理中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {optScope === 'all'
                            ? '全文字のノードを最適化'
                            : optScope === 'excessive'
                            ? '過剰ノード文字を最適化'
                            : '表示中文字のノードを最適化'}
                        </span>
                      </>
                    )}
                  </button>

                  {lastOptimizationResult && (
                    <div
                      className={`text-[10px] p-2 rounded-lg text-center font-medium border ${
                        isLight
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      直近の実行結果: {lastOptimizationResult.optimizedGlyphsCount} 文字で{' '}
                      <span className="font-bold">{lastOptimizationResult.totalReducedNodes}</span> 個のノードを削減（-
                      {lastOptimizationResult.reductionPercentage}%）
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Extrema Optimization Settings & Execution Panel */}
        {isExtremaPanelOpen && (
          <div
            className={`px-5 py-4 border-b transition-all text-xs ${
              isLight
                ? 'bg-cyan-50/70 border-cyan-200 text-stone-800'
                : 'bg-[#0e1c20] border-[#1d3840] text-cyan-100'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
                    isLight
                      ? 'bg-cyan-700 text-white border-cyan-800'
                      : 'bg-cyan-500 text-black border-cyan-400'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm text-stone-900 dark:text-white">
                      極点最適化（ベジェ曲線 Extrema ノード自動追加 &amp; 軸整列）
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                        isLight
                          ? 'bg-cyan-100/80 text-cyan-900 border-cyan-300'
                          : 'bg-cyan-950/80 text-cyan-200 border-cyan-700'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      TrueType / OpenType 規格準拠
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed">
                    3次ベジェ曲線の水平・垂直極点（dx/dt = 0 または dy/dt = 0）を幾何学的に検出し、輪郭形状を 100% 保持したまま極点上にノードを追加します。
                    制御ハンドルを軸（水平・垂直）に数学的に正しく整列させることで、フォントレンダリングやヒンティングの精度を最大化します。
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsExtremaPanelOpen(false)}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isLight
                    ? 'bg-white border-stone-200 text-stone-400 hover:text-stone-700'
                    : 'bg-[#142327] border-[#223f49] text-stone-400 hover:text-white'
                }`}
                title="パネルを閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Option 1: Handle Axis Alignment */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-white border-cyan-200/80' : 'bg-[#112126] border-[#1d3840]'
                }`}
              >
                <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center space-x-1">
                  <SlidersHorizontal className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                  <span>ハンドル軸整列</span>
                </div>
                <div className="space-y-1">
                  {[
                    {
                      val: true,
                      label: '完全水平・垂直スナップ（推奨）',
                      desc: '極点ノードの制御ハンドルを完全な水平/垂直に揃えます。フォント工学の標準規格',
                    },
                    {
                      val: false,
                      label: '元の接線角度を維持',
                      desc: '極点位置にノードを追加しつつ、分割前の微小な接線傾きをそのまま保ちます',
                    },
                  ].map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setExtAlignAxis(opt.val)}
                      className={`w-full text-left p-2 rounded-lg border transition-all text-xs ${
                        extAlignAxis === opt.val
                          ? isLight
                            ? 'bg-cyan-50 border-cyan-500 text-cyan-950 font-bold ring-1 ring-cyan-500/20'
                            : 'bg-cyan-950/60 border-cyan-500 text-cyan-200 font-bold ring-1 ring-cyan-500/30'
                          : isLight
                          ? 'border-transparent hover:bg-stone-50 text-stone-700'
                          : 'border-transparent hover:bg-[#162a30] text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{opt.label}</span>
                        {extAlignAxis === opt.val && <Check className="w-3.5 h-3.5 text-cyan-600" />}
                      </div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 font-normal mt-0.5 leading-snug">
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 2: Sensitivity / Distance threshold */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-white border-cyan-200/80' : 'bg-[#112126] border-[#1d3840]'
                }`}
              >
                <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center space-x-1">
                  <Sliders className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                  <span>検出感度（最小ノード間隔）</span>
                </div>
                <div className="space-y-1">
                  {[
                    {
                      id: 'normal',
                      label: '標準（5px・推奨）',
                      desc: '端点から5px以上離れた極点にノードを追加。適正なノード数を維持',
                    },
                    {
                      id: 'strict',
                      label: '厳格（8px）',
                      desc: '明瞭な外端・大きな曲線のみを対象とし、過度なノード追加を防止',
                    },
                    {
                      id: 'fine',
                      label: '高精度（3px）',
                      desc: '微小なハネや装飾の極点も網羅的にノード化（緻密な字形向け）',
                    },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setExtSensitivity(s.id as any)}
                      className={`w-full text-left p-2 rounded-lg border transition-all text-xs ${
                        extSensitivity === s.id
                          ? isLight
                            ? 'bg-cyan-50 border-cyan-500 text-cyan-950 font-bold ring-1 ring-cyan-500/20'
                            : 'bg-cyan-950/60 border-cyan-500 text-cyan-200 font-bold ring-1 ring-cyan-500/30'
                          : isLight
                          ? 'border-transparent hover:bg-stone-50 text-stone-700'
                          : 'border-transparent hover:bg-[#162a30] text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{s.label}</span>
                        {extSensitivity === s.id && <Check className="w-3.5 h-3.5 text-cyan-600" />}
                      </div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400 font-normal mt-0.5 leading-snug">
                        {s.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 3: Target Scope & Execution */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  isLight ? 'bg-white border-cyan-200/80' : 'bg-[#112126] border-[#1d3840]'
                }`}
              >
                <div>
                  <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mb-1.5 flex items-center space-x-1">
                    <Layers className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span>対象文字の範囲</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      {
                        id: 'all',
                        label: '全文字一括（全グリフ）',
                        desc: `全文字（${report?.totalGlyphsChecked || 0} 文字）の極点を最適化`,
                      },
                      {
                        id: 'missing',
                        label: '極点ノード不足が検出された文字のみ',
                        desc: `指摘を受けた文字（${report?.categoryCounts.missing_extrema || 0} 文字）`,
                      },
                      {
                        id: 'filtered',
                        label: '現在表示・検索中の文字',
                        desc: `リスト表示中の文字（${filteredIssues.length} 件）`,
                      },
                    ].map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setExtScope(sc.id as any)}
                        className={`w-full text-left p-1.5 rounded-lg border transition-all text-xs ${
                          extScope === sc.id
                            ? isLight
                              ? 'bg-cyan-50 border-cyan-500 text-cyan-950 font-bold ring-1 ring-cyan-500/20'
                              : 'bg-cyan-950/60 border-cyan-500 text-cyan-200 font-bold ring-1 ring-cyan-500/30'
                            : isLight
                            ? 'border-transparent hover:bg-stone-50 text-stone-700'
                            : 'border-transparent hover:bg-[#162a30] text-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{sc.label}</span>
                          {extScope === sc.id && <Check className="w-3.5 h-3.5 text-cyan-600" />}
                        </div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 font-normal mt-0.5 leading-snug">
                          {sc.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleRunExtremaOptimization}
                    disabled={isOptimizingExtrema}
                    className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-sm ${
                      isLight
                        ? 'bg-cyan-700 text-white hover:bg-cyan-800 active:scale-98'
                        : 'bg-cyan-500 text-black hover:bg-cyan-400 active:scale-98'
                    }`}
                  >
                    {isOptimizingExtrema ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>極点最適化処理中...</span>
                      </>
                    ) : (
                      <>
                        <Compass className="w-3.5 h-3.5" />
                        <span>
                          {extScope === 'all'
                            ? '全文字の極点を最適化'
                            : extScope === 'missing'
                            ? '極点不足文字を最適化'
                            : '表示中文字の極点を最適化'}
                        </span>
                      </>
                    )}
                  </button>

                  {lastExtremaResult && (
                    <div
                      className={`text-[10px] p-2 rounded-lg text-center font-medium border ${
                        isLight
                          ? 'bg-cyan-50 text-cyan-900 border-cyan-200'
                          : 'bg-cyan-950/60 text-cyan-200 border-cyan-800'
                      }`}
                    >
                      直近の実行結果: {lastExtremaResult.optimizedGlyphsCount} 文字の極点に{' '}
                      <span className="font-bold">{lastExtremaResult.totalNodesAdded}</span> 箇所のノードを追加・最適化
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Overview Cards */}
        {report && (
          <div
            className={`grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 px-5 py-3 border-b text-xs ${
              isLight ? 'bg-stone-50/50 border-stone-200' : 'bg-[#121c15] border-[#25362b]'
            }`}
          >
            {/* Duplicate Shapes */}
            <button
              onClick={() => setActiveTab('duplicate_shape')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                activeTab === 'duplicate_shape'
                  ? isLight
                    ? 'bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500/20'
                    : 'bg-[#1a261f] border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                  : isLight
                  ? 'bg-white/80 border-stone-200 hover:border-stone-300'
                  : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
              }`}
            >
              <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">字形の重複</div>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-base font-bold text-stone-900 dark:text-white">
                  {report.categoryCounts.duplicate_shape}
                </span>
                <span className="text-[10px] text-stone-400">件</span>
              </div>
            </button>

            {/* Path Intersections */}
            <button
              onClick={() => setActiveTab('path_intersection')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                activeTab === 'path_intersection'
                  ? isLight
                    ? 'bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500/20'
                    : 'bg-[#1a261f] border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                  : isLight
                  ? 'bg-white/80 border-stone-200 hover:border-stone-300'
                  : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
              }`}
            >
              <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">パス交差</div>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-base font-bold text-stone-900 dark:text-white">
                  {report.categoryCounts.path_intersection}
                </span>
                <span className="text-[10px] text-stone-400">件</span>
              </div>
            </button>

            {/* Excessive Nodes */}
            <button
              onClick={() => setActiveTab('excessive_nodes')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                activeTab === 'excessive_nodes'
                  ? isLight
                    ? 'bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500/20'
                    : 'bg-[#1a261f] border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                  : isLight
                  ? 'bg-white/80 border-stone-200 hover:border-stone-300'
                  : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
              }`}
            >
              <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">過剰ノード数</div>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-base font-bold text-stone-900 dark:text-white">
                  {report.categoryCounts.excessive_nodes}
                </span>
                <span className="text-[10px] text-stone-400">件</span>
              </div>
            </button>

            {/* Uneven Strokes */}
            <button
              onClick={() => setActiveTab('uneven_stroke')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                activeTab === 'uneven_stroke'
                  ? isLight
                    ? 'bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500/20'
                    : 'bg-[#1a261f] border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                  : isLight
                  ? 'bg-white/80 border-stone-200 hover:border-stone-300'
                  : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
              }`}
            >
              <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">線幅の偏り</div>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-base font-bold text-stone-900 dark:text-white">
                  {report.categoryCounts.uneven_stroke || 0}
                </span>
                <span className="text-[10px] text-stone-400">件</span>
              </div>
            </button>

            {/* Extremum Nodes */}
            <button
              onClick={() => setActiveTab('missing_extrema')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                activeTab === 'missing_extrema'
                  ? isLight
                    ? 'bg-white border-cyan-500 shadow-xs ring-1 ring-cyan-500/20'
                    : 'bg-[#112429] border-cyan-500 shadow-xs ring-1 ring-cyan-500/30'
                  : isLight
                  ? 'bg-white/80 border-stone-200 hover:border-stone-300'
                  : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
              }`}
            >
              <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">極点ノード</div>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-base font-bold text-stone-900 dark:text-white">
                  {report.categoryCounts.missing_extrema || 0}
                </span>
                <span className="text-[10px] text-stone-400">件</span>
              </div>
            </button>

            {/* Baseline Deviations */}
            <button
              onClick={() => setActiveTab('baseline_deviation')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                activeTab === 'baseline_deviation'
                  ? isLight
                    ? 'bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500/20'
                    : 'bg-[#1a261f] border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                  : isLight
                  ? 'bg-white/80 border-stone-200 hover:border-stone-300'
                  : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
              }`}
            >
              <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">ベースライン</div>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-base font-bold text-stone-900 dark:text-white">
                  {report.categoryCounts.baseline_deviation}
                </span>
                <span className="text-[10px] text-stone-400">件</span>
              </div>
            </button>

            {/* All Issues / Overall */}
            <button
              onClick={() => setActiveTab('all')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                activeTab === 'all'
                  ? isLight
                    ? 'bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500/20'
                    : 'bg-[#1a261f] border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                  : isLight
                  ? 'bg-white/80 border-stone-200 hover:border-stone-300'
                  : 'bg-[#152018] border-[#25362b] hover:border-stone-700'
              }`}
            >
              <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">全指摘事項</div>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-base font-bold text-stone-900 dark:text-white">
                  {report.totalIssues}
                </span>
                <span className="text-[10px] text-stone-400">/ {report.totalGlyphsChecked} 字</span>
              </div>
            </button>
          </div>
        )}

        {/* Action & Filter Bar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b text-xs ${
            isLight ? 'bg-white border-stone-200' : 'bg-[#141e17] border-[#25362b]'
          }`}
        >
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="文字、Unicode、キーワード検索..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-hidden transition-colors ${
                isLight
                  ? 'bg-stone-50 border-stone-200 focus:border-emerald-600 focus:bg-white text-stone-900'
                  : 'bg-[#111913] border-[#25362b] focus:border-emerald-500 text-emerald-100'
              }`}
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto py-0.5 scrollbar-none">
            {[
              { id: 'all', label: 'すべて' },
              { id: 'duplicate_shape', label: '字形重複' },
              { id: 'path_intersection', label: 'パス交差' },
              { id: 'excessive_nodes', label: 'ノード数' },
              { id: 'missing_extrema', label: '極点ノード' },
              { id: 'uneven_stroke', label: '線幅均一性' },
              { id: 'baseline_deviation', label: 'ベースライン' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabFilter)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? isLight
                      ? 'bg-emerald-800 text-white'
                      : 'bg-emerald-600 text-white'
                    : isLight
                    ? 'text-stone-600 hover:bg-stone-100'
                    : 'text-stone-400 hover:bg-[#1f2d22]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Batch Fixes */}
          <div className="flex items-center space-x-1.5 ml-auto">
            {report && (report.categoryCounts.missing_extrema || 0) > 0 && (
              <button
                onClick={() => handleBatchFix('missing_extrema')}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-colors border shadow-xs ${
                  isLight
                    ? 'bg-cyan-700 text-white border-cyan-800 hover:bg-cyan-800'
                    : 'bg-cyan-600 text-white border-cyan-500 hover:bg-cyan-500'
                }`}
                title="極点ノードが不足しているグリフを一括最適化（ノード配置＆ハンドル軸整列）"
              >
                <Compass className="w-3 h-3" />
                <span>極点最適化一括修正</span>
              </button>
            )}

            {report && report.categoryCounts.path_intersection > 0 && (
              <button
                onClick={() => handleBatchFix('path_intersection')}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-colors border shadow-xs ${
                  isLight
                    ? 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700'
                    : 'bg-amber-600 text-white border-amber-500 hover:bg-amber-500'
                }`}
                title="一筆書きの交差やストローク重なりが検出された文字を一括結合し、白抜きを防止"
              >
                <Sparkles className="w-3 h-3 text-amber-200" />
                <span>重なり白抜き一括解消</span>
              </button>
            )}

            {report && report.categoryCounts.uneven_stroke > 0 && (
              <button
                onClick={() => handleBatchFix('uneven_stroke')}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-colors border ${
                  isLight
                    ? 'bg-emerald-700 text-white border-emerald-800 hover:bg-emerald-800 shadow-xs'
                    : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500 shadow-xs'
                }`}
                title="線幅の偏り・かすれ・潰れが検出されたグリフを一括均一化"
              >
                <Scale className="w-3 h-3" />
                <span>線幅均一化一括修正</span>
              </button>
            )}

            {report && report.categoryCounts.excessive_nodes > 0 && (
              <button
                onClick={() => handleBatchFix('excessive_nodes')}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-colors border ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900'
                }`}
                title="過剰ノードが検出されたグリフの頂点を一括最適化"
              >
                <Wand2 className="w-3 h-3" />
                <span>過剰ノード一括修正</span>
              </button>
            )}

            {report && report.categoryCounts.baseline_deviation > 0 && (
              <button
                onClick={() => handleBatchFix('baseline_deviation')}
                className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-colors border ${
                  isLight
                    ? 'bg-stone-100 border-stone-300 text-stone-800 hover:bg-stone-200'
                    : 'bg-[#1c2920] border-[#25362b] text-emerald-200 hover:bg-[#25372b]'
                }`}
                title="ベースラインから浮遊・沈下している文字を一括整列"
              >
                <Sliders className="w-3 h-3" />
                <span>ベースライン一括整列</span>
              </button>
            )}
          </div>
        </div>

        {/* Issue List View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredIssues.length === 0 ? (
            <div className="py-16 text-center">
              <div
                className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center border mb-3 ${
                  isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-emerald-950/50 border-emerald-800 text-emerald-400'
                }`}
              >
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold">
                {report && report.totalIssues === 0
                  ? '問題は検出されませんでした'
                  : '該当する指摘項目はありません'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto mt-1">
                {report && report.totalIssues === 0
                  ? 'すべてのグリフがベースライン、ノード数、ストローク線幅、パス基準を満たしており、フォント出力準備が整っています。'
                  : 'フィルタ条件または検索語句を変更して他の項目を確認してください。'}
              </p>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const glyphData = project.glyphs?.[issue.unicode];
              const contours = glyphData?.contours || [];
              const svgPath = contoursToSvgPath(normalizeGlyphContoursWinding(contours));

              return (
                <div
                  key={issue.id}
                  className={`p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row gap-4 transition-all ${
                    isLight
                      ? 'bg-white border-stone-200 hover:border-stone-300 shadow-xs'
                      : 'bg-[#162119] border-[#25362b] hover:border-stone-700'
                  }`}
                >
                  {/* Glyph Preview Tile */}
                  <div className="flex sm:flex-col items-center justify-between sm:justify-start gap-2 shrink-0">
                    <div
                      className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl border overflow-hidden flex items-center justify-center ${
                        isLight ? 'bg-stone-50 border-stone-200' : 'bg-[#0f1611] border-[#223025]'
                      }`}
                    >
                      {/* Grid / Metrics Guide Overlay */}
                      <svg
                        viewBox="0 0 1000 1000"
                        className="w-full h-full pointer-events-none absolute inset-0"
                      >
                        {/* Baseline Guide (Y = 800) */}
                        <line
                          x1="0"
                          y1="800"
                          x2="1000"
                          y2="800"
                          stroke={isLight ? '#ef4444' : '#f87171'}
                          strokeWidth="12"
                          strokeDasharray="24 24"
                          opacity="0.65"
                        />
                        {/* Ascender / Descender Lines */}
                        <line
                          x1="0"
                          y1="200"
                          x2="1000"
                          y2="200"
                          stroke={isLight ? '#94a3b8' : '#475569'}
                          strokeWidth="8"
                          strokeDasharray="16 16"
                          opacity="0.4"
                        />
                        {/* Render Glyph Contour Path */}
                        {svgPath && (
                          <path
                            d={svgPath}
                            fill={isLight ? '#1c1917' : '#ecfdf5'}
                            fillRule="nonzero"
                          />
                        )}
                        {/* Intersection Marker Points */}
                        {issue.details?.intersectionPoints?.map((pt, pIdx) => (
                          <circle
                            key={pIdx}
                            cx={pt.x}
                            cy={pt.y}
                            r="32"
                            fill="#ef4444"
                            stroke="#ffffff"
                            strokeWidth="8"
                          />
                        ))}
                        {/* Thin stroke marker points */}
                        {issue.details?.thinPoints?.map((pt, pIdx) => (
                          <circle
                            key={`thin-${pIdx}`}
                            cx={pt.x}
                            cy={pt.y}
                            r="28"
                            fill="#f59e0b"
                            stroke="#ffffff"
                            strokeWidth="6"
                          />
                        ))}
                        {/* Thick stroke marker points */}
                        {issue.details?.thickPoints?.map((pt, pIdx) => (
                          <circle
                            key={`thick-${pIdx}`}
                            cx={pt.x}
                            cy={pt.y}
                            r="28"
                            fill="#8b5cf6"
                            stroke="#ffffff"
                            strokeWidth="6"
                          />
                        ))}
                        {/* Extrema marker points */}
                        {issue.details?.extremaPoints?.map((pt, pIdx) => (
                          <g key={`ext-${pIdx}`}>
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="26"
                              fill="#06b6d4"
                              stroke="#ffffff"
                              strokeWidth="6"
                            />
                            <line
                              x1={pt.x - 14}
                              y1={pt.y}
                              x2={pt.x + 14}
                              y2={pt.y}
                              stroke="#ffffff"
                              strokeWidth="4"
                            />
                            <line
                              x1={pt.x}
                              y1={pt.y - 14}
                              x2={pt.x}
                              y2={pt.y + 14}
                              stroke="#ffffff"
                              strokeWidth="4"
                            />
                          </g>
                        ))}
                      </svg>
                    </div>

                    <div className="text-center sm:w-20">
                      <div className="text-xs font-bold truncate">{issue.char}</div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        U+{issue.unicode.toString(16).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Issue Information Body */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Severity Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          issue.severity === 'error'
                            ? isLight
                              ? 'bg-rose-100 text-rose-900 border-rose-200'
                              : 'bg-rose-950 text-rose-300 border-rose-800'
                            : issue.severity === 'warning'
                            ? isLight
                              ? 'bg-amber-100 text-amber-900 border-amber-200'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                            : isLight
                            ? 'bg-sky-100 text-sky-900 border-sky-200'
                            : 'bg-sky-950 text-sky-300 border-sky-800'
                        }`}
                      >
                        {issue.severity === 'error'
                          ? 'エラー'
                          : issue.severity === 'warning'
                          ? '警告'
                          : '情報'}
                      </span>

                      {/* Issue Category Pill */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                          isLight
                            ? 'bg-stone-100 text-stone-700 border-stone-200'
                            : 'bg-[#1e2a21] text-stone-300 border-[#25362b]'
                        }`}
                      >
                        {issue.type === 'duplicate_shape'
                          ? '字形の重複'
                          : issue.type === 'path_intersection'
                          ? 'パス交差'
                          : issue.type === 'excessive_nodes'
                          ? '過剰ノード数'
                          : issue.type === 'missing_extrema'
                          ? '極点ノード不足'
                          : issue.type === 'uneven_stroke'
                          ? '線幅の偏り'
                          : issue.type === 'baseline_deviation'
                          ? 'ベースライン逸脱'
                          : issue.type === 'isolated_node'
                          ? '孤立頂点'
                          : '境界逸脱'}
                      </span>

                      {/* Issue Title */}
                      <h4 className="text-xs font-bold text-stone-900 dark:text-white">
                        {issue.title}
                      </h4>
                    </div>

                    <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                      {issue.description}
                    </p>

                    {/* Stroke Width Stats details if available */}
                    {issue.details?.minStrokeWidth !== undefined && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] pt-0.5">
                        <div
                          className={`px-2 py-1 rounded-md border font-mono flex items-center gap-1.5 ${
                            isLight
                              ? 'bg-stone-50 border-stone-200 text-stone-700'
                              : 'bg-[#101912] border-[#223326] text-emerald-200'
                          }`}
                        >
                          <Scale className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            最小: <strong className="text-amber-600 dark:text-amber-400">{issue.details.minStrokeWidth}px</strong>
                          </span>
                          <span className="text-stone-300 dark:text-stone-600">/</span>
                          <span>
                            中央値: <strong>{issue.details.medianStrokeWidth}px</strong>
                          </span>
                          <span className="text-stone-300 dark:text-stone-600">/</span>
                          <span>
                            最大: <strong className="text-purple-600 dark:text-purple-400">{issue.details.maxStrokeWidth}px</strong>
                          </span>
                        </div>
                      </div>
                    )}

                    {issue.recommendation && (
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-[#111913] p-2 rounded-lg border border-stone-200/60 dark:border-[#223025]">
                        <span className="font-bold text-stone-700 dark:text-stone-300">改善指針: </span>
                        {issue.recommendation}
                      </p>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-[#223025]">
                    {issue.canAutoFix && (
                      <button
                        onClick={() => handleFixIssue(issue)}
                        title="文字の形や角・曲率を崩さずに安全に修正します"
                        className={`w-full sm:w-auto px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border shadow-xs ${
                          isLight
                            ? 'bg-emerald-700 text-white hover:bg-emerald-800 border-emerald-800'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-500'
                        }`}
                      >
                        {issue.autoFixType === 'equalize_strokes' ? (
                          <>
                            <Scale className="w-3.5 h-3.5" />
                            <span>均一化を適用</span>
                          </>
                        ) : issue.autoFixType === 'optimize_extrema' ? (
                          <>
                            <Compass className="w-3.5 h-3.5" />
                            <span>極点最適化を適用</span>
                          </>
                        ) : issue.autoFixType === 'merge_intersection' ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>白抜き解消</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>安全修正</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Single Glyph Extrema Optimization */}
                    <button
                      onClick={() => handleOptimizeSingleGlyphExtrema(issue.unicode, issue.char)}
                      title="この文字のベジェ曲線極点（水平・垂直の最外端）を分析し、ノードを追加・配置して輪郭を数学的に最適化します"
                      className={`w-full sm:w-auto px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border ${
                        isLight
                          ? 'bg-cyan-50 border-cyan-300 text-cyan-900 hover:bg-cyan-100'
                          : 'bg-cyan-950/60 border-cyan-800 text-cyan-200 hover:bg-cyan-900'
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>極点最適化</span>
                    </button>

                    {/* Single Glyph Stroke Equalization button */}
                    <button
                      onClick={() => handleEqualizeSingleGlyph(issue.unicode, issue.char)}
                      title="この文字の線幅（太さ）を自動均一化します（かすれ・潰れを補正）"
                      className={`w-full sm:w-auto px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border ${
                        isLight
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900'
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>ストローク均一化</span>
                    </button>

                    {/* Single Glyph Node Optimization */}
                    <button
                      onClick={() => handleOptimizeSingleGlyph(issue.unicode, issue.char)}
                      title="この文字の直線上の冗長ノードを間引き、パスを滑らかに最適化します（形状保護済）"
                      className={`w-full sm:w-auto px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border ${
                        isLight
                          ? 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                          : 'bg-[#1a261f] border-[#25362b] text-emerald-200 hover:bg-[#223328]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>ノード最適化</span>
                    </button>

                    <button
                      onClick={() => handleGoToGlyph(issue.unicode)}
                      className={`w-full sm:w-auto px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors border ${
                        isLight
                          ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                          : 'bg-[#1b261f] border-[#25362b] text-emerald-200 hover:bg-[#233329]'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>キャンバスで開く</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info and close button */}
        <div
          className={`flex items-center justify-between px-5 py-3 border-t text-xs ${
            isLight ? 'bg-stone-50/80 border-stone-200' : 'bg-[#111a14] border-[#25362b]'
          }`}
        >
          <div className="text-stone-500 dark:text-stone-400 text-[11px] leading-relaxed">
            ※ 赤破線はベースライン (Y=800) です。ストローク均一化や自動修正は文字の形（角・筆先・曲率・縦横比）を保護しながら適用されます。「元に戻す (Ctrl+Z)」でいつでも取り消せます。
          </div>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl font-bold transition-colors ${
              isLight
                ? 'bg-stone-800 text-white hover:bg-stone-900'
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
