import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Flame,
  BarChart3,
  ClipboardList,
  Copy,
  Plus,
  FileSearch,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  ListFilter,
} from 'lucide-react';
import { FontProject, GlyphData, PathContour } from '../types';
import { ThemeMode, isLightTheme } from '../utils/theme';
import { GlyphDensityHeatmapModal } from './GlyphDensityHeatmapModal';
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
import {
  runProjectDiagnostics,
  ProjectDiagnosticsReport,
  DiagnosticItem,
  DiagnosticStatus,
  DiagnosticScope,
  CategoryDiagnosticStat,
} from '../utils/projectDiagnostics';
import { ProjectDiagnosticsPanel } from './ProjectDiagnosticsPanel';

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
  const isLight = isLightTheme(theme);

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

  // Density Heatmap Inspector state
  const [heatmapModalUnicode, setHeatmapModalUnicode] = useState<number | null>(null);

  // List of unicodes that have excessive_nodes issues
  const excessiveNodesUnicodes = useMemo(() => {
    if (!report || !report.issues) return [];
    const list: number[] = [];
    report.issues.forEach((iss) => {
      if (iss.type === 'excessive_nodes' && !list.includes(iss.unicode)) {
        list.push(iss.unicode);
      }
    });
    return list;
  }, [report]);

  // Main View: 'quality' (品質検査) or 'diagnostics' (プロジェクト診断)
  const [mainView, setMainView] = useState<'quality' | 'diagnostics'>('quality');

  // Project Diagnostics state
  const [diagScope, setDiagScope] = useState<DiagnosticScope>('standard_japanese');
  const [diagFilter, setDiagFilter] = useState<'all_attention' | 'all' | 'empty' | 'critically_low' | 'draft' | 'complete'>('all_attention');
  const [diagCategoryFilter, setDiagCategoryFilter] = useState<string>('all');
  const [diagSortBy, setDiagSortBy] = useState<'complexity_asc' | 'complexity_desc' | 'nodes_asc' | 'unicode' | 'severity'>('complexity_asc');
  const [diagSearchQuery, setDiagSearchQuery] = useState<string>('');
  const [diagReport, setDiagReport] = useState<ProjectDiagnosticsReport | null>(null);
  const [isDiagScanning, setIsDiagScanning] = useState<boolean>(false);
  const [showCategoryProgress, setShowCategoryProgress] = useState<boolean>(true);

  // Fullscreen view mode
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const diagSearchInputRef = React.useRef<HTMLInputElement>(null);

  const notify = (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    if (onShowToast) {
      onShowToast(text, type);
    }
  };

  // Run or refresh report
  const runScan = useCallback(() => {
    setIsScanning(true);
    setTimeout(() => {
      const rep = checkFontQuality(project);
      setReport(rep);
      setIsScanning(false);
    }, 50);
  }, [project]);

  // Run project diagnostics
  const runDiagnostics = useCallback((scope?: DiagnosticScope) => {
    setIsDiagScanning(true);
    const targetScope = scope || diagScope;
    setTimeout(() => {
      const rep = runProjectDiagnostics(project, { scope: targetScope, includeCompletedInItems: true });
      setDiagReport(rep);
      setIsDiagScanning(false);
    }, 40);
  }, [project, diagScope]);

  // Copy unfinished characters to clipboard
  const handleCopyUnfinishedList = () => {
    if (!diagReport) return;
    const attentionItems = diagReport.items.filter((it) => it.status !== 'complete');
    if (attentionItems.length === 0) {
      notify('未完成または要確認の文字はありません', 'info');
      return;
    }

    const charsText = attentionItems.map((it) => it.char).join('');
    const detailText = attentionItems
      .map((it) => `[${it.statusLabel}] ${it.char} (U+${it.unicode.toString(16).toUpperCase()}): ${it.reason}`)
      .join('\n');

    const fullExport = `【フォント制作診断 未完了・要確認文字リスト (${attentionItems.length}字)】\n文字一覧: ${charsText}\n\n詳細リスト:\n${detailText}`;

    navigator.clipboard.writeText(fullExport).then(() => {
      notify(`要確認文字 ${attentionItems.length} 字のリストをクリップボードにコピーしました`, 'success');
    }).catch(() => {
      notify('クリップボードへのコピーに失敗しました', 'error');
    });
  };

  // Add an empty glyph to project
  const handleAddEmptyGlyph = (unicode: number, char: string, name?: string) => {
    if (commitHistory) commitHistory();
    const glyphName = name || `uni${unicode.toString(16).toUpperCase()}`;
    const newGlyph: GlyphData = {
      unicode,
      char: char || String.fromCodePoint(unicode),
      name: glyphName,
      advanceWidth: project.metadata.unitsPerEm || 1000,
      lsb: 50,
      contours: [],
      modified: true,
    };

    setProject((prev) => ({
      ...prev,
      glyphs: {
        ...prev.glyphs,
        [unicode]: newGlyph,
      },
      updatedAt: Date.now(),
    }));

    notify(`文字「${char}」(U+${unicode.toString(16).toUpperCase()}) を空グリフとして登録しました`, 'success');
    runScan();
    runDiagnostics();
  };

  // Batch add all empty chars in current filtered scope
  const handleBatchAddFilteredEmptyGlyphs = () => {
    if (!diagReport) return;
    const emptyItems = diagReport.items.filter((it) => it.status === 'empty' && !it.isRegisteredInProject);
    if (emptyItems.length === 0) {
      notify('追加可能な未登録文字はありません', 'info');
      return;
    }

    if (commitHistory) commitHistory();

    setProject((prev) => {
      const nextGlyphs = { ...prev.glyphs };
      emptyItems.forEach((it) => {
        nextGlyphs[it.unicode] = {
          unicode: it.unicode,
          char: it.char,
          name: it.glyphName,
          advanceWidth: prev.metadata.unitsPerEm || 1000,
          lsb: 50,
          contours: [],
          modified: true,
        };
      });
      return {
        ...prev,
        glyphs: nextGlyphs,
        updatedAt: Date.now(),
      };
    });

    notify(`未登録文字 ${emptyItems.length} 字をプロジェクトに一括登録しました`, 'success');
    runScan();
    runDiagnostics();
  };

  // Keyboard shortcuts: Escape, F (fullscreen), R (rescan), H (heatmap), D (diagnostics toggle), / (search focus), 1-7 (tabs)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      if (e.key === 'Escape') {
        e.preventDefault();
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
        return;
      }

      if (!isInput) {
        if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setIsFullscreen((prev) => !prev);
        } else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          runScan();
          runDiagnostics();
          notify('再検査およびプロジェクト診断を実行しました', 'info');
        } else if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setMainView((prev) => (prev === 'quality' ? 'diagnostics' : 'quality'));
        } else if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (excessiveNodesUnicodes.length > 0) {
            e.preventDefault();
            setHeatmapModalUnicode(excessiveNodesUnicodes[0]);
          }
        } else if (e.key === '/') {
          e.preventDefault();
          if (mainView === 'diagnostics') {
            diagSearchInputRef.current?.focus();
          } else {
            searchInputRef.current?.focus();
          }
        } else if (!e.ctrlKey && !e.metaKey && !e.altKey && mainView === 'quality') {
          const tabMap: Record<string, TabFilter> = {
            '1': 'all',
            '2': 'duplicate_shape',
            '3': 'path_intersection',
            '4': 'excessive_nodes',
            '5': 'missing_extrema',
            '6': 'uneven_stroke',
            '7': 'baseline_deviation',
          };
          if (tabMap[e.key]) {
            e.preventDefault();
            setActiveTab(tabMap[e.key]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose, runScan, runDiagnostics, excessiveNodesUnicodes, mainView]);

  useEffect(() => {
    if (isOpen) {
      runScan();
      runDiagnostics();
    }
  }, [isOpen, project, diagScope]);

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

  // Quality Health status and stats computations
  const totalAutoFixableCount = useMemo(() => {
    if (!report?.issues) return 0;
    return report.issues.filter((iss) => iss.canAutoFix).length;
  }, [report]);

  const categoryStats = useMemo(() => {
    const counts = report?.categoryCounts || {
      duplicate_shape: 0,
      path_intersection: 0,
      excessive_nodes: 0,
      missing_extrema: 0,
      uneven_stroke: 0,
      baseline_deviation: 0,
    };
    return [
      {
        id: 'duplicate_shape' as TabFilter,
        label: '字形重複',
        count: counts.duplicate_shape || 0,
        desc: '同一形状・コピーの重複',
        icon: Copy,
        color: 'stone',
      },
      {
        id: 'path_intersection' as TabFilter,
        label: '重なり白抜き',
        count: counts.path_intersection || 0,
        desc: '交差による白抜き欠損',
        icon: Sparkles,
        color: 'amber',
        canBatchFix: true,
      },
      {
        id: 'missing_extrema' as TabFilter,
        label: '極点ノード',
        count: counts.missing_extrema || 0,
        desc: '水平・垂直の最外端欠落',
        icon: Compass,
        color: 'cyan',
        canBatchFix: true,
      },
      {
        id: 'uneven_stroke' as TabFilter,
        label: '線幅均一性',
        count: counts.uneven_stroke || 0,
        desc: 'かすれ線・潰れの偏り',
        icon: Scale,
        color: 'emerald',
        canBatchFix: true,
      },
      {
        id: 'excessive_nodes' as TabFilter,
        label: '過剰ノード',
        count: counts.excessive_nodes || 0,
        desc: '冗長アンカー・肥大パス',
        icon: Wand2,
        color: 'purple',
        canBatchFix: true,
      },
      {
        id: 'baseline_deviation' as TabFilter,
        label: 'ベースライン',
        count: counts.baseline_deviation || 0,
        desc: '基準線からの浮沈逸脱',
        icon: Sliders,
        color: 'blue',
        canBatchFix: true,
      },
    ];
  }, [report]);

  const healthStatus = useMemo(() => {
    const score = report?.score ?? 100;
    if (score >= 90) {
      return {
        label: '優良',
        subtitle: 'すべての品質基準を満たしており、フォント出力準備が整っています',
        colorText: isLight ? 'text-emerald-800' : 'text-emerald-400',
        colorBg: isLight ? 'bg-emerald-50/80 border-emerald-200' : 'bg-emerald-950/40 border-emerald-800/60',
        badgeBg: isLight ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-emerald-950 text-emerald-300 border-emerald-800',
        icon: ShieldCheck,
      };
    }
    if (score >= 70) {
      return {
        label: '概ね良好',
        subtitle: '軽微な調整推奨項目がありますが、通常利用可能です',
        colorText: isLight ? 'text-sky-800' : 'text-sky-400',
        colorBg: isLight ? 'bg-sky-50/80 border-sky-200' : 'bg-sky-950/40 border-sky-800/60',
        badgeBg: isLight ? 'bg-sky-100 text-sky-900 border-sky-300' : 'bg-sky-950 text-sky-300 border-sky-800',
        icon: Info,
      };
    }
    if (score >= 50) {
      return {
        label: '改善推奨',
        subtitle: '白抜きや線幅の偏りなどの警告が検出されています',
        colorText: isLight ? 'text-amber-800' : 'text-amber-400',
        colorBg: isLight ? 'bg-amber-50/80 border-amber-200' : 'bg-amber-950/40 border-amber-800/60',
        badgeBg: isLight ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-amber-950 text-amber-300 border-amber-800',
        icon: AlertTriangle,
      };
    }
    return {
      label: '要修正',
      subtitle: 'フォント描画や出力に影響するエラーが検出されています',
      colorText: isLight ? 'text-rose-800' : 'text-rose-400',
      colorBg: isLight ? 'bg-rose-50/80 border-rose-200' : 'bg-rose-950/40 border-rose-800/60',
      badgeBg: isLight ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-rose-950 text-rose-300 border-rose-800',
      icon: AlertCircle,
    };
  }, [report, isLight]);

  // Filtered diagnostic items for Project Diagnostics
  const filteredDiagnosticItems = useMemo(() => {
    if (!diagReport) return [];
    return diagReport.items
      .filter((item) => {
        // Status filter
        if (diagFilter === 'all_attention') {
          if (item.status === 'complete') return false;
        } else if (diagFilter === 'empty') {
          if (item.status !== 'empty') return false;
        } else if (diagFilter === 'critically_low') {
          if (item.status !== 'critically_low_complexity') return false;
        } else if (diagFilter === 'draft') {
          if (item.status !== 'draft') return false;
        } else if (diagFilter === 'complete') {
          if (item.status !== 'complete') return false;
        }

        // Category filter
        if (diagCategoryFilter !== 'all') {
          if (diagCategoryFilter === 'kanji' && item.categoryType !== 'kanji') return false;
          if (diagCategoryFilter === 'hiragana' && item.categoryType !== 'hiragana') return false;
          if (diagCategoryFilter === 'katakana' && item.categoryType !== 'katakana') return false;
          if (diagCategoryFilter === 'latin' && item.categoryType !== 'latin') return false;
          if (diagCategoryFilter === 'digits' && item.categoryType !== 'digits') return false;
          if (diagCategoryFilter === 'symbols' && item.categoryType !== 'symbols') return false;
        }

        // Search query
        if (diagSearchQuery.trim()) {
          const query = diagSearchQuery.trim().toLowerCase();
          const charMatch = item.char.toLowerCase().includes(query);
          const nameMatch = item.glyphName.toLowerCase().includes(query);
          const hexMatch = item.unicode.toString(16).toLowerCase().includes(query);
          const reasonMatch = item.reason.toLowerCase().includes(query);
          const catMatch = item.categoryName.toLowerCase().includes(query);
          if (!charMatch && !nameMatch && !hexMatch && !reasonMatch && !catMatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (diagSortBy === 'complexity_asc') {
          return (
            a.metrics.complexityScore - b.metrics.complexityScore ||
            a.metrics.nodeCount - b.metrics.nodeCount ||
            a.unicode - b.unicode
          );
        }
        if (diagSortBy === 'complexity_desc') {
          return b.metrics.complexityScore - a.metrics.complexityScore || b.unicode - a.unicode;
        }
        if (diagSortBy === 'nodes_asc') {
          return a.metrics.nodeCount - b.metrics.nodeCount || a.unicode - b.unicode;
        }
        if (diagSortBy === 'unicode') {
          return a.unicode - b.unicode;
        }
        if (diagSortBy === 'severity') {
          const rank = { error: 0, warning: 1, info: 2, success: 3 };
          return rank[a.severity] - rank[b.severity] || a.unicode - b.unicode;
        }
        return 0;
      });
  }, [diagReport, diagFilter, diagCategoryFilter, diagSearchQuery, diagSortBy]);

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
    <div
      className={`fixed inset-0 z-50 transition-all ${
        isFullscreen
          ? 'p-0 w-screen h-screen bg-black/85 flex flex-col'
          : 'flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150'
      }`}
    >
      <div
        className={`flex flex-col transition-all overflow-hidden ${
          isFullscreen
            ? isLight
              ? 'w-screen h-screen rounded-none border-none shadow-none bg-white text-stone-900'
              : 'w-screen h-screen rounded-none border-none shadow-none bg-[#151f18] text-emerald-100'
            : isLight
            ? 'w-full max-w-5xl xl:max-w-6xl rounded-2xl border border-stone-200 shadow-2xl max-h-[94vh] bg-white text-stone-900 shadow-emerald-950/10'
            : 'w-full max-w-5xl xl:max-w-6xl rounded-2xl border border-[#25362b] shadow-2xl max-h-[94vh] bg-[#151f18] text-emerald-100 shadow-black/50'
        }`}
      >
        {/* Header */}
        <div
          className={`flex flex-col md:flex-row md:items-center justify-between gap-2.5 px-3 py-3 sm:px-5 sm:py-4 border-b ${
            isLight ? 'bg-stone-50/80 border-stone-200' : 'bg-[#111a14] border-[#25362b]'
          }`}
        >
          <div className="flex items-center justify-between md:justify-start space-x-3 min-w-0">
            <div className="flex items-center space-x-2 min-w-0">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border shrink-0 transition-colors ${
                  mainView === 'diagnostics'
                    ? isLight
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-amber-950/80 border-amber-800 text-amber-300'
                    : isLight
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                    : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                }`}
              >
                {mainView === 'diagnostics' ? (
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {/* View Switcher Segment */}
                  <div className="flex items-center bg-stone-200/80 dark:bg-[#1c2920] p-0.5 rounded-lg border border-stone-300/80 dark:border-[#2a3c2e]">
                    <button
                      type="button"
                      onClick={() => setMainView('quality')}
                      className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-bold flex items-center space-x-1.5 transition-all ${
                        mainView === 'quality'
                          ? isLight
                            ? 'bg-white text-emerald-950 shadow-2xs'
                            : 'bg-[#152319] text-emerald-300 shadow-2xs'
                          : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>品質検査</span>
                      {report && report.totalIssues > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-mono font-bold">
                          {report.totalIssues}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setMainView('diagnostics')}
                      className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-bold flex items-center space-x-1.5 transition-all ${
                        mainView === 'diagnostics'
                          ? isLight
                            ? 'bg-white text-amber-950 shadow-2xs'
                            : 'bg-[#152319] text-amber-300 shadow-2xs'
                          : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5 text-amber-600" />
                      <span>プロジェクト診断</span>
                      {diagReport && diagReport.totalAttentionCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-mono font-bold">
                          {diagReport.totalAttentionCount}
                        </span>
                      )}
                    </button>
                  </div>

                  {mainView === 'quality' && report && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold border ${
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
                      スコア: {report.score}/100
                    </span>
                  )}

                  {mainView === 'diagnostics' && diagReport && (
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold border ${
                        isLight
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}
                    >
                      完成率: {diagReport.overallCompletionRate}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className={`md:hidden p-1.5 rounded-xl border transition-colors shrink-0 ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-500 hover:bg-stone-100'
                  : 'bg-[#1a261f] border-[#25362b] text-stone-400 hover:bg-[#223328]'
              }`}
              title="閉じる (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={runScan}
              disabled={isScanning}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center space-x-1.5 transition-colors shrink-0 ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                  : 'bg-[#1a261f] border-[#25362b] text-emerald-200 hover:bg-[#223328]'
              }`}
              title="フォント全体を再検査 (R)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">再検査</span>
            </button>

            {/* Fullscreen Toggle Button */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`hidden sm:flex p-2 sm:px-2.5 sm:py-2 rounded-xl border text-xs font-semibold items-center space-x-1.5 transition-colors shrink-0 ${
                isFullscreen
                  ? isLight
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-xs'
                    : 'bg-emerald-950 text-emerald-300 border-emerald-700 shadow-xs'
                  : isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                  : 'bg-[#1a261f] border-[#25362b] text-emerald-200 hover:bg-[#223328]'
              }`}
              title={isFullscreen ? '通常表示に戻す (F または Esc)' : '全画面表示に拡大 (F)'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>通常</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>全画面</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className={`hidden md:block p-2 rounded-xl border transition-colors shrink-0 ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-500 hover:bg-stone-100'
                  : 'bg-[#1a261f] border-[#25362b] text-stone-400 hover:bg-[#223328]'
              }`}
              title="閉じる (Esc)"
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
                      desc: '直線上の共線ノードと重複点のみを除去し、文字形状を保持します。',
                    },
                    {
                      id: 'normal',
                      label: '標準（推奨・形状保持 99.8%）',
                      desc: '直線上の冗長ノード除去および曲線の手ブレを整流',
                    },
                    {
                      id: 'strong',
                      label: '強力（形状保持 99.0%）',
                      desc: '密集したノードを間引き、パスを軽量化します。',
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
                      label: '水平・垂直スナップ（推奨）',
                      desc: '極点ノードの制御ハンドルを水平または垂直に揃えます。フォント規格準拠',
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

        {/* Main View Mode: Project Diagnostics or Quality Issues */}
        {mainView === 'diagnostics' ? (
          <ProjectDiagnosticsPanel
            project={project}
            setProject={setProject}
            isLight={isLight}
            diagReport={diagReport}
            diagScope={diagScope}
            setDiagScope={setDiagScope}
            diagFilter={diagFilter}
            setDiagFilter={setDiagFilter}
            diagCategoryFilter={diagCategoryFilter}
            setDiagCategoryFilter={setDiagCategoryFilter}
            diagSortBy={diagSortBy}
            setDiagSortBy={setDiagSortBy}
            diagSearchQuery={diagSearchQuery}
            setDiagSearchQuery={setDiagSearchQuery}
            isDiagScanning={isDiagScanning}
            onRescan={runDiagnostics}
            onSelectGlyph={onSelectGlyph}
            onCloseModal={onClose}
            onShowToast={onShowToast}
            commitHistory={commitHistory}
          />
        ) : (
          <>
            {/* Top Quality Health Summary & Compact Controls */}
            <div
              className={`p-3 sm:p-4 border-b shrink-0 transition-colors space-y-2.5 ${
                isLight ? 'bg-stone-50/70 border-stone-200' : 'bg-[#131d16] border-[#223326]'
              }`}
            >
              {/* Health Score & Quick Tool Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-xs shrink-0 ${
                      healthStatus.badgeBg
                    }`}
                  >
                    <healthStatus.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs sm:text-sm font-bold truncate">
                        品質スコア: <span className="font-mono font-black">{report?.score ?? 100}</span>/100
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${healthStatus.badgeBg}`}
                      >
                        {healthStatus.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                      {report && report.totalIssues > 0
                        ? `${report.totalIssues}件の改善推奨事項（${report.totalGlyphsChecked}字検査済）`
                        : 'すべての品質基準を満たしています'}
                    </p>
                  </div>
                </div>

                {/* Right side: Global Auto-Fix & Advanced Tools Chips */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {report && report.totalIssues > 0 && (
                    <button
                      onClick={() => handleBatchFix(undefined)}
                      title="安全な修正（白抜き解消・極点最適化・線幅均一化）を一括実行します"
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm active:scale-98 ${
                        isLight
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                      <span>全 {report.totalIssues} 件を一括自動修正</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1 border-l pl-2 border-stone-300 dark:border-stone-700">
                    <button
                      onClick={() => {
                        setIsExtremaPanelOpen((prev) => !prev);
                        if (!isExtremaPanelOpen) {
                          setIsEqualizePanelOpen(false);
                          setIsOptimizePanelOpen(false);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center space-x-1 transition-all ${
                        isExtremaPanelOpen
                          ? isLight
                            ? 'bg-cyan-700 text-white border-cyan-800'
                            : 'bg-cyan-600 text-white border-cyan-500'
                          : isLight
                          ? 'bg-white text-cyan-900 border-cyan-200 hover:bg-cyan-50'
                          : 'bg-[#17251d] text-cyan-200 border-cyan-900/60 hover:bg-[#1f3328]'
                      }`}
                      title="極点ノードの自動追加・軸整列ツールを開く"
                    >
                      <Compass className="w-3 h-3 text-cyan-500" />
                      <span>極点最適化</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsEqualizePanelOpen((prev) => !prev);
                        if (!isEqualizePanelOpen) {
                          setIsOptimizePanelOpen(false);
                          setIsExtremaPanelOpen(false);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center space-x-1 transition-all ${
                        isEqualizePanelOpen
                          ? isLight
                            ? 'bg-emerald-700 text-white border-emerald-800'
                            : 'bg-emerald-600 text-white border-emerald-500'
                          : isLight
                          ? 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50'
                          : 'bg-[#17251d] text-emerald-200 border-emerald-900/60 hover:bg-[#1f3328]'
                      }`}
                      title="線幅均一化・かすれ潰れ補正ツールを開く"
                    >
                      <Scale className="w-3 h-3 text-emerald-500" />
                      <span>線幅均一化</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsOptimizePanelOpen((prev) => !prev);
                        if (!isOptimizePanelOpen) {
                          setIsEqualizePanelOpen(false);
                          setIsExtremaPanelOpen(false);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center space-x-1 transition-all ${
                        isOptimizePanelOpen
                          ? isLight
                            ? 'bg-emerald-700 text-white border-emerald-800'
                            : 'bg-emerald-600 text-white border-emerald-500'
                          : isLight
                          ? 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50'
                          : 'bg-[#17251d] text-emerald-200 border-emerald-900/60 hover:bg-[#1f3328]'
                      }`}
                      title="冗長ノードの間引きツールを開く"
                    >
                      <Wand2 className="w-3 h-3 text-emerald-500" />
                      <span>ノード軽量化</span>
                    </button>

                    <button
                      onClick={() => {
                        if (excessiveNodesUnicodes.length > 0) {
                          setHeatmapModalUnicode(excessiveNodesUnicodes[0]);
                        } else {
                          const firstKey = Object.keys(project.glyphs || {})[0];
                          if (firstKey) {
                            setHeatmapModalUnicode(Number(firstKey));
                          } else {
                            notify('解析可能なグリフがありません', 'warning');
                          }
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center space-x-1 transition-all ${
                        isLight
                          ? 'bg-white text-amber-900 border-amber-300 hover:bg-amber-50'
                          : 'bg-[#17251d] text-amber-200 border-amber-900/60 hover:bg-[#1f3328]'
                      }`}
                      title="アンカー密度ヒートマップを開く"
                    >
                      <Flame className="w-3 h-3 text-amber-500" />
                      <span>ヒートマップ</span>
                      {excessiveNodesUnicodes.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-white font-mono font-bold">
                          {excessiveNodesUnicodes.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div
              className={`flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2 border-b text-xs ${
                isLight ? 'bg-white border-stone-200' : 'bg-[#141e17] border-[#25362b]'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                {/* Search Input */}
                <div className="relative min-w-[140px] max-w-xs flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="文字、Unicode、指摘内容検索... (/)"
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
                    { id: 'all', label: 'すべて', count: report?.totalIssues ?? 0 },
                    { id: 'duplicate_shape', label: '字形重複', count: report?.categoryCounts.duplicate_shape ?? 0 },
                    { id: 'path_intersection', label: '重なり白抜き', count: report?.categoryCounts.path_intersection ?? 0 },
                    { id: 'missing_extrema', label: '極点ノード', count: report?.categoryCounts.missing_extrema ?? 0 },
                    { id: 'uneven_stroke', label: '線幅均一性', count: report?.categoryCounts.uneven_stroke ?? 0 },
                    { id: 'excessive_nodes', label: 'ノード数', count: report?.categoryCounts.excessive_nodes ?? 0 },
                    { id: 'baseline_deviation', label: 'ベースライン', count: report?.categoryCounts.baseline_deviation ?? 0 },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabFilter)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors whitespace-nowrap flex items-center space-x-1 ${
                        activeTab === tab.id
                          ? isLight
                            ? 'bg-emerald-800 text-white shadow-2xs'
                            : 'bg-emerald-600 text-white shadow-2xs'
                          : isLight
                          ? 'text-stone-600 hover:bg-stone-100'
                          : 'text-stone-400 hover:bg-[#1f2d22]'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                            activeTab === tab.id
                              ? 'bg-white/20 text-white'
                              : isLight
                              ? 'bg-stone-200 text-stone-700'
                              : 'bg-stone-800 text-stone-300'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category-Specific Quick Batch Fix Button if filtered */}
              <div className="flex items-center space-x-1.5 shrink-0 ml-auto">
                {activeTab === 'path_intersection' && (report?.categoryCounts.path_intersection ?? 0) > 0 && (
                  <button
                    onClick={() => handleBatchFix('path_intersection')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center space-x-1.5 transition-colors border shadow-xs ${
                      isLight
                        ? 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700'
                        : 'bg-amber-600 text-white border-amber-500 hover:bg-amber-500'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                    <span>白抜き一括解消 ({report?.categoryCounts.path_intersection}件)</span>
                  </button>
                )}

                {activeTab === 'missing_extrema' && (report?.categoryCounts.missing_extrema ?? 0) > 0 && (
                  <button
                    onClick={() => handleBatchFix('missing_extrema')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center space-x-1.5 transition-colors border shadow-xs ${
                      isLight
                        ? 'bg-cyan-700 text-white border-cyan-800 hover:bg-cyan-800'
                        : 'bg-cyan-600 text-white border-cyan-500 hover:bg-cyan-500'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>極点一括最適化 ({report?.categoryCounts.missing_extrema}件)</span>
                  </button>
                )}

                {activeTab === 'uneven_stroke' && (report?.categoryCounts.uneven_stroke ?? 0) > 0 && (
                  <button
                    onClick={() => handleBatchFix('uneven_stroke')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center space-x-1.5 transition-colors border shadow-xs ${
                      isLight
                        ? 'bg-emerald-700 text-white border-emerald-800 hover:bg-emerald-800'
                        : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>線幅一括均一化 ({report?.categoryCounts.uneven_stroke}件)</span>
                  </button>
                )}

                {activeTab === 'excessive_nodes' && (report?.categoryCounts.excessive_nodes ?? 0) > 0 && (
                  <button
                    onClick={() => handleBatchFix('excessive_nodes')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center space-x-1.5 transition-colors border shadow-xs ${
                      isLight
                        ? 'bg-purple-700 text-white border-purple-800 hover:bg-purple-800'
                        : 'bg-purple-600 text-white border-purple-500 hover:bg-purple-500'
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>過剰ノード一括間引き ({report?.categoryCounts.excessive_nodes}件)</span>
                  </button>
                )}

                {activeTab === 'baseline_deviation' && (report?.categoryCounts.baseline_deviation ?? 0) > 0 && (
                  <button
                    onClick={() => handleBatchFix('baseline_deviation')}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center space-x-1.5 transition-colors border shadow-xs ${
                      isLight
                        ? 'bg-blue-700 text-white border-blue-800 hover:bg-blue-800'
                        : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>ベースライン一括整列 ({report?.categoryCounts.baseline_deviation}件)</span>
                  </button>
                )}
              </div>
            </div>

        {/* Issue List View */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-3">
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
                        {/* Excessive Nodes / Density Heatmap Dots in Mini Preview */}
                        {issue.type === 'excessive_nodes' && issue.details?.densityAnalysis && (
                          <g>
                            {issue.details.densityAnalysis.contours.flatMap((c) =>
                              c.nodes.map((n, nIdx) => (
                                <circle
                                  key={`dn-${c.contourIndex}-${nIdx}`}
                                  cx={n.x}
                                  cy={n.y}
                                  r={n.level === 'critical' ? 24 : n.level === 'dense' ? 18 : 12}
                                  fill={n.color}
                                  opacity={n.level === 'optimal' ? 0.6 : 0.95}
                                />
                              ))
                            )}
                          </g>
                        )}
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

                    {/* Density Heatmap Statistics details if excessive_nodes */}
                    {issue.type === 'excessive_nodes' && issue.details?.densityAnalysis && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] pt-0.5">
                        <div
                          className={`px-2 py-1 rounded-md border font-mono flex items-center gap-1.5 ${
                            isLight
                              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                              : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                          }`}
                        >
                          <Flame className="w-3 h-3 text-amber-500" />
                          <span>総アンカー: <strong>{issue.details.totalNodes}個</strong></span>
                          <span className="text-stone-300 dark:text-stone-600">/</span>
                          <span>
                            過密箇所: <strong className="text-rose-500 font-bold">{issue.details.densityAnalysis.criticalNodeCount}点</strong>
                          </span>
                          <span className="text-stone-300 dark:text-stone-600">/</span>
                          <span>単一輪郭最大: <strong>{issue.details.maxContourNodes}点</strong></span>
                        </div>
                      </div>
                    )}

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
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-end gap-1.5 w-full sm:w-auto shrink-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-[#223025]">
                    {/* Primary Auto-Fix Action */}
                    {issue.canAutoFix && (
                      <button
                        onClick={() => handleFixIssue(issue)}
                        title="文字の形や角・曲率を崩さずに安全に修正します"
                        className={`w-full sm:w-auto px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs shrink-0 ${
                          issue.autoFixType === 'merge_intersection'
                            ? isLight
                              ? 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-700'
                              : 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-500'
                            : issue.autoFixType === 'optimize_extrema'
                            ? isLight
                              ? 'bg-cyan-700 hover:bg-cyan-800 text-white border border-cyan-800'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500'
                            : isLight
                            ? 'bg-emerald-700 text-white hover:bg-emerald-800 border border-emerald-800'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-500'
                        }`}
                      >
                        {issue.autoFixType === 'equalize_strokes' ? (
                          <>
                            <Scale className="w-3.5 h-3.5" />
                            <span>線幅を均一化</span>
                          </>
                        ) : issue.autoFixType === 'optimize_extrema' ? (
                          <>
                            <Compass className="w-3.5 h-3.5" />
                            <span>極点を最適化</span>
                          </>
                        ) : issue.autoFixType === 'merge_intersection' ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                            <span>白抜きを解消</span>
                          </>
                        ) : issue.autoFixType === 'excessive_nodes' ? (
                          <>
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>ノード間引き</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>安全修正</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Density Heatmap Modal Button if excessive nodes */}
                    {issue.type === 'excessive_nodes' && (
                      <button
                        onClick={() => setHeatmapModalUnicode(issue.unicode)}
                        title="この文字の輪郭密度ヒートマップを開き、過密アンカー箇所を可視化してクリックで即時単純化します"
                        className={`w-full sm:w-auto px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors border shadow-xs shrink-0 ${
                          isLight
                            ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                            : 'bg-amber-950/60 text-amber-300 border-amber-800 hover:bg-amber-900'
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                        <span>ヒートマップ診断</span>
                      </button>
                    )}

                    {/* Open in Canvas button */}
                    <button
                      onClick={() => handleGoToGlyph(issue.unicode)}
                      className={`w-full sm:w-auto px-3 py-1.5 rounded-lg font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors border shrink-0 ${
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
        </>
        )}

        {/* Footer info and close button */}
        <div
          className={`flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t text-xs gap-3 shrink-0 ${
            isLight ? 'bg-stone-50/80 border-stone-200' : 'bg-[#111a14] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2 text-stone-500 dark:text-stone-400 text-[11px] leading-relaxed">
            <span className="hidden md:inline">
              ※ 赤破線はベースライン (Y=800)。形状保護モードで安全に最適化。「元に戻す (Ctrl+Z)」でいつでも取り消せます。
            </span>
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-stone-200/60 dark:bg-stone-800/80 font-mono text-[10px] text-stone-600 dark:text-stone-300">
              <kbd className="font-bold">D</kbd>: 診断切替
            </span>
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-stone-200/60 dark:bg-stone-800/80 font-mono text-[10px] text-stone-600 dark:text-stone-300">
              <kbd className="font-bold">R</kbd>: 再検査
            </span>
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-stone-200/60 dark:bg-stone-800/80 font-mono text-[10px] text-stone-600 dark:text-stone-300">
              <kbd className="font-bold">H</kbd>: ヒートマップ
            </span>
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-stone-200/60 dark:bg-stone-800/80 font-mono text-[10px] text-stone-600 dark:text-stone-300">
              <kbd className="font-bold">/</kbd>: 検索
            </span>
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-stone-200/60 dark:bg-stone-800/80 font-mono text-[10px] text-stone-600 dark:text-stone-300">
              <kbd className="font-bold">F</kbd>: 全画面切替
            </span>
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-stone-200/60 dark:bg-stone-800/80 font-mono text-[10px] text-stone-600 dark:text-stone-300">
              <kbd className="font-bold">Esc</kbd>: 閉じる
            </span>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center space-x-1.5 ${
                isLight
                  ? 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                  : 'bg-[#1a261f] border-[#25362b] text-emerald-200 hover:bg-[#223328]'
              }`}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>通常表示</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>全画面</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className={`px-4 py-1.5 rounded-xl font-bold transition-colors ${
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

      {/* Glyph Density Heatmap Inspector Modal */}
      {heatmapModalUnicode !== null && (
        <GlyphDensityHeatmapModal
          isOpen={true}
          onClose={() => setHeatmapModalUnicode(null)}
          unicode={heatmapModalUnicode}
          project={project}
          setProject={setProject}
          theme={theme}
          onShowToast={onShowToast}
          commitHistory={commitHistory}
          onRefreshQualityReport={runScan}
        />
      )}
    </div>
  );
};
