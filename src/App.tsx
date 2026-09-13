import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FontProject,
  GlyphData,
  PathContour,
  ToolMode,
  BrushStyle,
  TraceSettings,
  GridSettings,
  UserPenPreset,
} from './types';
import { createDefaultProject } from './utils/fontCompiler';
import { loadUserPenPresets, loadStickyBrushConfigs, saveStickyBrushConfig } from './utils/presetData';
import { Header } from './components/Header';
import { GlyphGrid } from './components/GlyphGrid';
import { ToolBar } from './components/ToolBar';
import { GlyphCanvas } from './components/GlyphCanvas';
import { MetricsPanel } from './components/MetricsPanel';
import { RadicalsDrawer } from './components/RadicalsDrawer';
import { TestPreviewModal } from './components/TestPreviewModal';
import { FontInfoModal } from './components/FontInfoModal';
import { TraceSettingsModal } from './components/TraceSettingsModal';
import { SvgVectorizerModal } from './components/SvgVectorizerModal';
import { BatchNormalizeModal } from './components/BatchNormalizeModal';
import { FontQualityModal } from './components/FontQualityModal';
import { GlyphSynthesisModal } from './components/GlyphSynthesisModal';
import { KerningModal } from './components/KerningModal';
import { RadicalStudioModal } from './components/RadicalStudioModal';
import { PenPresetsModal } from './components/PenPresetsModal';
import { Toast, ToastMessage } from './components/Toast';
import { ThemeMode } from './utils/theme';
import { createSmallKanaContours, generateId, simplifyGlyphContours } from './utils/pathUtils';
import { DAKUTEN_MAPPINGS, createDakutenContours, createHandakutenContours, cloneContours } from './utils/dakutenHelper';
import {
  getPrevGlyphNav,
  getNextGlyphNav,
  getPrevUncompletedGlyphNav,
  getNextUncompletedGlyphNav,
} from './utils/navigationHelper';
import { calculateOptimalSpacing, AutoSpacingPreset } from './utils/metricsHelper';
import { KANA_PAIRS } from './data/unicodeTables';
import { Grid, Paintbrush, Sliders, Eye, Undo2, Redo2, ChevronRight } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'font_editor_project_data_v2';
const THEME_STORAGE_KEY = 'font_editor_theme_mode';

export default function App() {
  // Theme Mode (light / dark) - default to light (Japonica style eye-friendly white/green)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  // Synchronize dark class to documentElement for consistent Tailwind styling
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Main Project State
  const [project, setProject] = useState<FontProject>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.metadata && parsed.glyphs) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load project from localStorage:', e);
    }
    return createDefaultProject();
  });

  // Selected Glyph
  const [selectedUnicode, setSelectedUnicode] = useState<number>(12354); // 'あ' (U+3042)
  const [selectedChar, setSelectedChar] = useState<string>('あ');

  // Tool Modes & Canvas Options (Default tuned for smooth natural handwriting font creation)
  const [toolMode, setToolMode] = useState<ToolMode>('brush');
  const [brushStyle, setBrushStyle] = useState<BrushStyle>('brush');
  const [brushWidth, setBrushWidth] = useState<number>(() => {
    const saved = loadStickyBrushConfigs();
    return saved.brush?.brushWidth ?? 38;
  });
  const [pressureSensitivity, setPressureSensitivity] = useState<'high' | 'normal' | 'low' | 'off'>(() => {
    const saved = loadStickyBrushConfigs();
    return saved.brush?.pressureSensitivity ?? 'high';
  });

  // Advanced Writing Feeling Parameters
  const [autoSmoothBrush, setAutoSmoothBrush] = useState<boolean>(true);
  const [smoothStrength, setSmoothStrength] = useState<'mild' | 'standard' | 'strong'>('standard');
  const [smoothPreserveCorners, setSmoothPreserveCorners] = useState<boolean>(true);
  const [autoUnionBrush, setAutoUnionBrush] = useState<boolean>(false);

  // Sticky Brush Settings: Change style and automatically restore saved parameters
  const handleChangeBrushStyle = useCallback((newStyle: BrushStyle) => {
    setBrushStyle(newStyle);
    const configs = loadStickyBrushConfigs();
    const targetConfig = configs[newStyle];
    if (targetConfig) {
      if (typeof targetConfig.brushWidth === 'number') {
        setBrushWidth(targetConfig.brushWidth);
      }
      if (targetConfig.pressureSensitivity) {
        setPressureSensitivity(targetConfig.pressureSensitivity);
      }
      if (typeof targetConfig.autoSmoothBrush === 'boolean') {
        setAutoSmoothBrush(targetConfig.autoSmoothBrush);
      }
      if (targetConfig.smoothStrength) {
        setSmoothStrength(targetConfig.smoothStrength);
      }
      if (typeof targetConfig.smoothPreserveCorners === 'boolean') {
        setSmoothPreserveCorners(targetConfig.smoothPreserveCorners);
      }
      if (typeof targetConfig.autoUnionBrush === 'boolean') {
        setAutoUnionBrush(targetConfig.autoUnionBrush);
      }
    }
  }, []);

  const handleChangeBrushWidth = useCallback((newWidth: number) => {
    const clamped = Math.max(2, Math.min(200, Math.round(newWidth)));
    setBrushWidth(clamped);
    saveStickyBrushConfig(brushStyle, { brushWidth: clamped });
  }, [brushStyle]);

  const handleChangePressureSensitivity = useCallback((newSensitivity: 'high' | 'normal' | 'low' | 'off') => {
    setPressureSensitivity(newSensitivity);
    saveStickyBrushConfig(brushStyle, { pressureSensitivity: newSensitivity });
  }, [brushStyle]);

  // Adjust brush size via [ / ] keys
  const handleAdjustBrushSize = useCallback((delta: number) => {
    setBrushWidth((current) => {
      const next = Math.max(2, Math.min(200, current + delta));
      saveStickyBrushConfig(brushStyle, { brushWidth: next });
      return next;
    });
  }, [brushStyle]);

  // User Writing Presets
  const [penPresets, setPenPresets] = useState<UserPenPreset[]>(() => loadUserPenPresets());
  const [isPenPresetsModalOpen, setIsPenPresetsModalOpen] = useState<boolean>(false);

  const handleApplyPenPreset = useCallback((preset: UserPenPreset) => {
    setBrushStyle(preset.brushStyle);
    setBrushWidth(preset.brushWidth);
    setPressureSensitivity(preset.pressureSensitivity);
    setAutoSmoothBrush(preset.autoSmoothBrush);
    setSmoothStrength(preset.smoothStrength);
    setSmoothPreserveCorners(preset.smoothPreserveCorners);
    setAutoUnionBrush(preset.autoUnionBrush);
    saveStickyBrushConfig(preset.brushStyle, {
      brushWidth: preset.brushWidth,
      pressureSensitivity: preset.pressureSensitivity,
      autoSmoothBrush: preset.autoSmoothBrush,
      smoothStrength: preset.smoothStrength,
      smoothPreserveCorners: preset.smoothPreserveCorners,
      autoUnionBrush: preset.autoUnionBrush,
    });
  }, []);

  // One-click quick profile to re-apply handwriting-optimized settings
  const handleApplyHandwritingPreset = useCallback(() => {
    setToolMode('brush');
    setBrushStyle('brush');
    setBrushWidth(38);
    setPressureSensitivity('high');
    setAutoSmoothBrush(true);
    setSmoothStrength('standard');
    setSmoothPreserveCorners(true);
    setAutoUnionBrush(false);
    setGridSettings((prev) => ({
      ...prev,
      snapToGrid: false,
      snapToPoints: false,
      japaneseGuide: 'cross',
      showBodyFrame: true,
      showKanaFrame: true,
      showMetrics: true,
      highContrastCursor: true,
    }));
    setTraceSettings((prev) => ({
      ...prev,
      enabled: true,
      opacity: 0.18,
      fontSize: 780,
    }));
    showToast('手書きフォント最適化設定（毛筆38px・高感度筆圧・十文字字面枠・手振れ補正）を適用しました', 'success');
  }, [showToast]);

  // Trace Guidelines Settings (Default enabled with subtle Noto Sans JP guide for comfortable handwriting tracing)
  const [traceSettings, setTraceSettings] = useState<TraceSettings>({
    enabled: true,
    type: 'char',
    text: '',
    fontFamily: "'Noto Sans JP', sans-serif",
    fontSize: 780,
    opacity: 0.18,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  // Grid & Guideline Settings (Optimized for Japanese handwriting balance: cross guide + body/kana frame, snap OFF)
  const [gridSettings, setGridSettings] = useState<GridSettings>({
    showGrid: true,
    gridSize: 50,
    snapToGrid: false,
    snapToPoints: false,
    showMetrics: true,
    showPoints: true,
    showHandles: true,
    japaneseGuide: 'cross',
    showBodyFrame: true,
    showKanaFrame: true,
    highContrastCursor: true,
    showCursorCrosshair: false,
  });

  // Modals & Drawers Visibility
  const [showRadicals, setShowRadicals] = useState<boolean>(false);
  const [showGridDrawer, setShowGridDrawer] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  });
  const [showMetricsDrawer, setShowMetricsDrawer] = useState<boolean>(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  const [isFontInfoModalOpen, setIsFontInfoModalOpen] = useState<boolean>(false);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState<boolean>(false);
  const [isSvgModalOpen, setIsSvgModalOpen] = useState<boolean>(false);
  const [isBatchNormalizeModalOpen, setIsBatchNormalizeModalOpen] = useState<boolean>(false);
  const [isQualityModalOpen, setIsQualityModalOpen] = useState<boolean>(false);
  const [isSynthesisModalOpen, setIsSynthesisModalOpen] = useState<boolean>(false);
  const [isKerningModalOpen, setIsKerningModalOpen] = useState<boolean>(false);
  const [isRadicalStudioOpen, setIsRadicalStudioOpen] = useState<boolean>(false);

  const isAnyModalOpen =
    isTestModalOpen ||
    isFontInfoModalOpen ||
    isTraceModalOpen ||
    isSvgModalOpen ||
    isBatchNormalizeModalOpen ||
    isQualityModalOpen ||
    isSynthesisModalOpen ||
    isKerningModalOpen ||
    isRadicalStudioOpen ||
    isPenPresetsModalOpen;

  // Responsive layout tracking to prevent sidebar/grid overlaps onto canvas
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    return typeof window !== 'undefined' ? window.innerWidth : 1280;
  });

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // When viewport width is narrow or multiple sidebars compete for space,
  // automatically transition sidebars to overlay drawers with elevated z-index and backdrops,
  // preventing canvas squishing or inadvertent visual overlap.
  const isGridOverlay = viewportWidth < 1024;
  const isMetricsOverlay = viewportWidth < 1280 || (viewportWidth < 1440 && showGridDrawer);

  // Zen Mode (Maximized Workspace): All sidebars collapsed for 100% canvas focus
  const isZenMode = !showGridDrawer && !showMetricsDrawer && !showRadicals;
  const toggleZenMode = useCallback(() => {
    if (showGridDrawer || showMetricsDrawer || showRadicals) {
      setShowGridDrawer(false);
      setShowMetricsDrawer(false);
      setShowRadicals(false);
      showToast('全面作図・集中モード（サイドバー収納）', 'info');
    } else {
      setShowGridDrawer(true);
      showToast('標準レイアウトに戻しました', 'info');
    }
  }, [showGridDrawer, showMetricsDrawer, showRadicals, showToast]);

  // Clipboard for copying glyph shapes
  const [clipboardContours, setClipboardContours] = useState<PathContour[] | null>(null);

  // Undo / Redo History stack per glyph
  const [undoStack, setUndoStack] = useState<GlyphData[]>([]);
  const [redoStack, setRedoStack] = useState<GlyphData[]>([]);

  // Project and current glyph refs for zero-rebind listeners and fast operations
  const projectRef = useRef<FontProject>(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // Get current active glyph or fallback default (memoized to avoid creating new object identity every render)
  const currentGlyph: GlyphData = useMemo(() => {
    return (
      project.glyphs[selectedUnicode] || {
        unicode: selectedUnicode,
        char: selectedChar,
        name: `uni${selectedUnicode.toString(16).toUpperCase().padStart(4, '0')}`,
        advanceWidth: 1000,
        lsb: 50,
        contours: [],
        modified: false,
      }
    );
  }, [project.glyphs, selectedUnicode, selectedChar]);

  const currentGlyphRef = useRef<GlyphData>(currentGlyph);
  useEffect(() => {
    currentGlyphRef.current = currentGlyph;
  }, [currentGlyph]);

  // Auto-save to LocalStorage with 750ms debounce to prevent UI stutter during drawing
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(project));
      } catch (e) {
        console.warn('Auto-save to localStorage failed:', e);
      }
    }, 750);
    return () => clearTimeout(timer);
  }, [project]);

  // Ensure synchronous save before window closes or refreshes
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projectRef.current));
      } catch {
        // Ignored
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Record history snapshot before mutation
  const commitHistory = useCallback(() => {
    const glyphSnapshot = currentGlyphRef.current;
    setUndoStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(glyphSnapshot))]);
    setRedoStack([]);
  }, []);

  // Undo action
  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const previous = prevUndo[prevUndo.length - 1];
      const nextUndo = prevUndo.slice(0, prevUndo.length - 1);
      
      const currentSnapshot = currentGlyphRef.current;
      setRedoStack((prevRedo) => [...prevRedo, JSON.parse(JSON.stringify(currentSnapshot))]);

      setProject((prevProj) => ({
        ...prevProj,
        glyphs: {
          ...prevProj.glyphs,
          [previous.unicode]: previous,
        },
        updatedAt: Date.now(),
      }));

      return nextUndo;
    });
  }, []);

  // Redo action
  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const next = prevRedo[prevRedo.length - 1];
      const nextRedo = prevRedo.slice(0, prevRedo.length - 1);

      const currentSnapshot = currentGlyphRef.current;
      setUndoStack((prevUndo) => [...prevUndo, JSON.parse(JSON.stringify(currentSnapshot))]);

      setProject((prevProj) => ({
        ...prevProj,
        glyphs: {
          ...prevProj.glyphs,
          [next.unicode]: next,
        },
        updatedAt: Date.now(),
      }));

      return nextRedo;
    });
  }, []);

  // Update current glyph contours
  const handleUpdateContours = useCallback(
    (newContours: PathContour[]) => {
      setProject((prev) => {
        const existing = prev.glyphs[selectedUnicode] || {
          unicode: selectedUnicode,
          char: selectedChar,
          name: `uni${selectedUnicode.toString(16).toUpperCase().padStart(4, '0')}`,
          advanceWidth: 1000,
          lsb: 50,
        };

        return {
          ...prev,
          glyphs: {
            ...prev.glyphs,
            [selectedUnicode]: {
              ...existing,
              contours: newContours,
              modified: true,
            },
          },
          updatedAt: Date.now(),
        };
      });
    },
    [selectedUnicode, selectedChar]
  );

  // Update Advance Width
  const handleUpdateAdvanceWidth = useCallback(
    (val: number) => {
      setProject((prev) => {
        const existing = prev.glyphs[selectedUnicode] || currentGlyph;
        return {
          ...prev,
          glyphs: {
            ...prev.glyphs,
            [selectedUnicode]: {
              ...existing,
              advanceWidth: val,
              modified: true,
            },
          },
          updatedAt: Date.now(),
        };
      });
    },
    [selectedUnicode, currentGlyph]
  );

  // Update LSB
  const handleUpdateLsb = useCallback(
    (val: number) => {
      setProject((prev) => {
        const existing = prev.glyphs[selectedUnicode] || currentGlyph;
        return {
          ...prev,
          glyphs: {
            ...prev.glyphs,
            [selectedUnicode]: {
              ...existing,
              lsb: val,
              modified: true,
            },
          },
          updatedAt: Date.now(),
        };
      });
    },
    [selectedUnicode, currentGlyph]
  );

  // Select Glyph from character matrix
  const handleSelectGlyph = useCallback((unicode: number, char: string) => {
    setSelectedUnicode(unicode);
    setSelectedChar(char);
    setUndoStack([]);
    setRedoStack([]);
    if (isGridOverlay) {
      setShowGridDrawer(false);
    }
  }, [isGridOverlay]);

  const handleSelectPrevGlyph = useCallback(() => {
    const prev = getPrevGlyphNav(selectedUnicode);
    handleSelectGlyph(prev.unicode, prev.char);
    showToast(`文字「${prev.char}」へ移動 (U+${prev.unicode.toString(16).toUpperCase().padStart(4, '0')})`, 'info');
  }, [selectedUnicode, handleSelectGlyph, showToast]);

  const handleSelectNextGlyph = useCallback(() => {
    const next = getNextGlyphNav(selectedUnicode);
    handleSelectGlyph(next.unicode, next.char);
    showToast(`文字「${next.char}」へ移動 (U+${next.unicode.toString(16).toUpperCase().padStart(4, '0')})`, 'info');
  }, [selectedUnicode, handleSelectGlyph, showToast]);

  const handleSelectPrevUncompletedGlyph = useCallback(() => {
    const prev = getPrevUncompletedGlyphNav(selectedUnicode, project.glyphs || {});
    if (prev) {
      handleSelectGlyph(prev.unicode, prev.char);
      showToast(`前の未作成文字「${prev.char}」へジャンプしました`, 'info');
    } else {
      showToast('前の未作成グリフはありません（すべて作図完了しています）', 'success');
    }
  }, [selectedUnicode, project.glyphs, handleSelectGlyph, showToast]);

  const handleSelectNextUncompletedGlyph = useCallback(() => {
    const next = getNextUncompletedGlyphNav(selectedUnicode, project.glyphs || {});
    if (next) {
      handleSelectGlyph(next.unicode, next.char);
      showToast(`次の未作成文字「${next.char}」へジャンプしました`, 'info');
    } else {
      showToast('次の未作成グリフはありません（すべて作図完了！）', 'success');
    }
  }, [selectedUnicode, project.glyphs, handleSelectGlyph, showToast]);

  // Simplify current glyph contours (アンカー点削減・最適化)
  const handleSimplifyCurrentGlyph = useCallback(
    (level: 'mild' | 'normal' | 'strong' = 'normal') => {
      const contours = currentGlyph.contours || [];
      if (contours.length === 0) {
        showToast('単純化する輪郭がありません', 'warning');
        return;
      }
      commitHistory();
      const res = simplifyGlyphContours(contours, {
        level,
        preserveSharpCorners: true,
      });

      if (!res.changed) {
        showToast('既に最適な頂点配置です (不要な重複・共線ノードなし)', 'info');
        return;
      }

      handleUpdateContours(res.contours);
      showToast(
        `輪郭を単純化しました: 頂点数 ${res.originalNodeCount}点 → ${res.optimizedNodeCount}点 (${res.reductionPercentage}% 削減)`,
        'success'
      );
    },
    [currentGlyph, commitHistory, handleUpdateContours, showToast]
  );

  // Auto-Spacing (サイドベアリング自動設定)
  const handleAutoSpaceCurrentGlyph = useCallback(
    (preset: AutoSpacingPreset = 'smart') => {
      const contours = currentGlyph.contours || [];
      if (contours.length === 0) {
        showToast('字形が作図されていません', 'warning');
        return;
      }
      commitHistory();
      const res = calculateOptimalSpacing(selectedUnicode, contours, preset);

      setProject((prev) => {
        const existing = prev.glyphs[selectedUnicode] || {
          unicode: selectedUnicode,
          char: selectedChar,
          name: `uni${selectedUnicode.toString(16).toUpperCase().padStart(4, '0')}`,
        };

        return {
          ...prev,
          glyphs: {
            ...prev.glyphs,
            [selectedUnicode]: {
              ...existing,
              advanceWidth: res.advanceWidth,
              lsb: res.lsb,
              contours: res.contours,
              modified: true,
            },
          },
          updatedAt: Date.now(),
        };
      });

      const presetLabel =
        preset === 'smart'
          ? 'スマート自動'
          : preset === 'japanese-fullwidth'
          ? '和文全角センタリング'
          : preset === 'proportional-tight'
          ? '欧文タイト'
          : preset === 'proportional-loose'
          ? '欧文ルーズ'
          : '欧文プロポーショナル';

      showToast(
        `オートスペーシング適用 [${presetLabel}]: 送り幅 ${res.advanceWidth}px, 左余白 ${res.lsb}px`,
        'success'
      );
    },
    [currentGlyph, selectedUnicode, selectedChar, commitHistory, showToast]
  );

  // Clear Glyph (with undo preservation and toast)
  const handleClearGlyph = useCallback((unicode: number) => {
    const targetGlyph = project.glyphs[unicode];
    if (!targetGlyph) return;

    if (unicode === selectedUnicode) {
      commitHistory();
    } else {
      setUndoStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(targetGlyph))]);
    }

    setProject((prev) => {
      const copy = { ...prev.glyphs };
      delete copy[unicode];
      return {
        ...prev,
        glyphs: copy,
        updatedAt: Date.now(),
      };
    });

    const ch = targetGlyph.char || String.fromCodePoint(unicode);
    showToast(`文字「${ch}」の字形を消去しました (Ctrl+Zで復元可能)`, 'info');
  }, [project.glyphs, selectedUnicode, commitHistory, showToast]);

  // Copy Glyph contours
  const handleCopyGlyph = useCallback((unicode: number) => {
    const glyph = project.glyphs[unicode];
    if (glyph && glyph.contours && glyph.contours.length > 0) {
      setClipboardContours(JSON.parse(JSON.stringify(glyph.contours)));
      const ch = glyph.char || String.fromCodePoint(unicode);
      showToast(`文字「${ch}」の字形 (${glyph.contours.length}パス) をコピーしました`, 'success');
    } else {
      showToast('コピーする輪郭がありません', 'warning');
    }
  }, [project.glyphs, showToast]);

  // Paste Glyph contours
  const handlePasteGlyph = useCallback((unicode: number) => {
    if (!clipboardContours || clipboardContours.length === 0) {
      showToast('クリップボードに字形がありません', 'warning');
      return;
    }
    commitHistory();
    setProject((prev) => {
      const existing = prev.glyphs[unicode] || {
        unicode,
        char: String.fromCodePoint(unicode),
        name: `uni${unicode.toString(16).toUpperCase().padStart(4, '0')}`,
        advanceWidth: 1000,
        lsb: 50,
      };
      return {
        ...prev,
        glyphs: {
          ...prev.glyphs,
          [unicode]: {
            ...existing,
            contours: JSON.parse(JSON.stringify(clipboardContours)),
            modified: true,
          },
        },
        updatedAt: Date.now(),
      };
    });
    const targetChar = String.fromCodePoint(unicode);
    showToast(`「${targetChar}」に字形を貼り付けました`, 'success');
  }, [clipboardContours, commitHistory, showToast]);

  // Duplicate Normal Kana to Small Kana automatically
  const handleDuplicateAsSmallKana = useCallback((sourceUnicode: number) => {
    const sourceGlyph = project.glyphs[sourceUnicode];
    if (!sourceGlyph || !sourceGlyph.contours || sourceGlyph.contours.length === 0) return;

    const sourceChar = sourceGlyph.char || String.fromCodePoint(sourceUnicode);
    const pair = KANA_PAIRS[sourceChar];
    if (!pair) return;

    const targetUnicode = pair.smallUnicode;
    const smallContours = createSmallKanaContours(sourceGlyph.contours);

    commitHistory();
    setProject((prev) => {
      const existing = prev.glyphs[targetUnicode] || {
        unicode: targetUnicode,
        char: pair.smallChar,
        name: `uni${targetUnicode.toString(16).toUpperCase().padStart(4, '0')}`,
        advanceWidth: 1000,
        lsb: 60,
      };

      return {
        ...prev,
        glyphs: {
          ...prev.glyphs,
          [targetUnicode]: {
            ...existing,
            contours: smallContours,
            modified: true,
          },
        },
        updatedAt: Date.now(),
      };
    });

    // Select the generated small kana to inspect
    setSelectedUnicode(targetUnicode);
    setSelectedChar(pair.smallChar);
    showToast(`「${sourceChar}」から小文字「${pair.smallChar}」を自動生成しました`, 'success');
  }, [project.glyphs, commitHistory, showToast]);

  // Generate Dakuten / Handakuten from Current Glyph Automatically
  const handleGenerateDakutenTarget = useCallback((targetChar: string, isHandakuten: boolean) => {
    const targetUnicode = targetChar.codePointAt(0);
    if (!targetUnicode) return;

    // Current glyph contours
    const baseContours = currentGlyph.contours || [];
    const cloned = cloneContours(baseContours);
    const accentContours = isHandakuten
      ? createHandakutenContours()
      : createDakutenContours();

    const combinedContours = [...cloned, ...accentContours];

    commitHistory();
    setProject((prev) => {
      const existing = prev.glyphs[targetUnicode] || {
        unicode: targetUnicode,
        char: targetChar,
        name: `uni${targetUnicode.toString(16).toUpperCase().padStart(4, '0')}`,
        advanceWidth: currentGlyph.advanceWidth || 1000,
        lsb: currentGlyph.lsb ?? 50,
      };

      return {
        ...prev,
        glyphs: {
          ...prev.glyphs,
          [targetUnicode]: {
            ...existing,
            contours: combinedContours,
            advanceWidth: currentGlyph.advanceWidth || 1000,
            lsb: currentGlyph.lsb ?? 50,
            modified: true,
          },
        },
        updatedAt: Date.now(),
      };
    });

    // Select the newly generated glyph
    setSelectedUnicode(targetUnicode);
    setSelectedChar(targetChar);
    showToast(
      `「${selectedChar}」から${isHandakuten ? '半濁音' : '濁音'}「${targetChar}」を自動生成しました！`,
      'success'
    );
  }, [currentGlyph, commitHistory, selectedChar, showToast]);

  // Copy strokes from another char (e.g., from seion)
  const handleCopyFromChar = (sourceChar: string) => {
    const sourceUnicode = sourceChar.codePointAt(0);
    if (!sourceUnicode) return;
    const sourceGlyph = project.glyphs[sourceUnicode];
    if (!sourceGlyph || !sourceGlyph.contours || sourceGlyph.contours.length === 0) {
      showToast(`「${sourceChar}」にはまだ字形が作図されていません`, 'warning');
      return;
    }
    commitHistory();
    const cloned = cloneContours(sourceGlyph.contours);
    handleUpdateContours(cloned);
    showToast(`「${sourceChar}」から字形を読み込みました`, 'success');
  };

  // Insert Radical Contours
  const handleInsertRadical = (radicalContours: PathContour[]) => {
    if (!radicalContours || radicalContours.length === 0) {
      showToast('挿入する輪郭データがありません', 'warning');
      return;
    }
    commitHistory();
    const base = currentGlyphRef.current?.contours || [];
    const insertedIds = radicalContours.map((c) => c.id);
    handleUpdateContours([...base, ...radicalContours]);
    setToolMode('select');
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('font_editor_select_contours', { detail: { ids: insertedIds } })
      );
    }, 60);
    showToast(`部首パーツ (${radicalContours.length}パス) を挿入しました（選択ツールで移動・変形可能）`, 'success');
  };

  // Batch Insert Radical Contours to multiple kanji glyphs
  const handleBatchInsertRadical = (radicalContours: PathContour[], targetChars: string[]) => {
    commitHistory();
    setProject((prev) => {
      const updatedGlyphs = { ...(prev.glyphs || {}) };
      targetChars.forEach((char) => {
        const unicode = char.codePointAt(0) || 0;
        if (!unicode) return;
        const existingGlyph = updatedGlyphs[unicode] || {
          unicode,
          char,
          name: `uni${unicode.toString(16).toUpperCase().padStart(4, '0')}`,
          contours: [],
          advanceWidth: 1000,
          lsb: 50,
        };

        const clonedRadical = radicalContours.map((c) => ({
          ...c,
          id: generateId(),
          nodes: c.nodes.map((n) => ({
            ...n,
            id: generateId(),
            handleIn: n.handleIn ? { ...n.handleIn } : null,
            handleOut: n.handleOut ? { ...n.handleOut } : null,
          })),
        }));

        updatedGlyphs[unicode] = {
          ...existingGlyph,
          contours: [...(existingGlyph.contours || []), ...clonedRadical],
          updatedAt: Date.now(),
        };
      });
      return { ...prev, glyphs: updatedGlyphs, updatedAt: Date.now() };
    });
    showToast(`${targetChars.length}文字の字形に部首パーツを一括挿入しました`, 'success');
  };

  // Apply SVG / Vectorizer Contours (Replace or Append)
  const handleApplySvgContours = (importedContours: PathContour[], append: boolean) => {
    commitHistory();
    if (append) {
      handleUpdateContours([...(currentGlyph.contours || []), ...importedContours]);
      showToast(`SVGパーツ (${importedContours.length}パス) を追加しました`, 'success');
    } else {
      handleUpdateContours(importedContours);
      showToast(`SVGパーツ (${importedContours.length}パス) で置き換えました`, 'success');
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetEl?.tagName) ||
        targetEl?.isContentEditable ||
        isAnyModalOpen
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projectRef.current));
          showToast('プロジェクトをローカル保存しました', 'success');
        } catch {
          showToast('保存に失敗しました', 'error');
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setGridSettings((prev) => {
          const nextShow = !prev.showGrid;
          showToast(
            `方眼グリッド: ${nextShow ? `ON (${prev.gridSize || 50}px)` : 'OFF'} (G: 表示切替 / Alt +/-: サイズ微調整)`,
            'info'
          );
          return { ...prev, showGrid: nextShow };
        });
      } else if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.key === 'Add')
      ) {
        e.preventDefault();
        setGridSettings((prev) => {
          const current = prev.gridSize || 50;
          let step = 5;
          if (current >= 100) step = 10;
          else if (current < 20) step = 2;
          const nextSize = Math.min(250, current + step);
          showToast(
            `グリッドサイズ: ${nextSize}px${prev.snapToGrid ? ' (スナップON)' : ''} (Alt +/- で微調整)`,
            'info'
          );
          return {
            ...prev,
            showGrid: true,
            gridSize: nextSize,
          };
        });
      } else if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.key === 'Subtract')
      ) {
        e.preventDefault();
        setGridSettings((prev) => {
          const current = prev.gridSize || 50;
          let step = 5;
          if (current > 100) step = 10;
          else if (current <= 20) step = 2;
          const nextSize = Math.max(5, current - step);
          showToast(
            `グリッドサイズ: ${nextSize}px${prev.snapToGrid ? ' (スナップON)' : ''} (Alt +/- で微調整)`,
            'info'
          );
          return {
            ...prev,
            showGrid: true,
            gridSize: nextSize,
          };
        });
      } else if (e.altKey && !e.shiftKey && (e.key === 'ArrowRight' || e.key === 'PageDown')) {
        // Continuous next glyph navigation: Alt+Right / PageDown
        e.preventDefault();
        handleSelectNextGlyph();
        return;
      } else if (e.altKey && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'PageUp')) {
        // Continuous prev glyph navigation: Alt+Left / PageUp
        e.preventDefault();
        handleSelectPrevGlyph();
        return;
      } else if (
        (e.altKey && e.key.toLowerCase() === 'n') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowRight')
      ) {
        // Skip to next uncompleted glyph: Alt+N / Cmd+Shift+Right
        e.preventDefault();
        handleSelectNextUncompletedGlyph();
        return;
      } else if (
        (e.altKey && e.key.toLowerCase() === 'p') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowLeft')
      ) {
        // Skip to prev uncompleted glyph: Alt+P / Cmd+Shift+Left
        e.preventDefault();
        handleSelectPrevUncompletedGlyph();
        return;
      } else if (e.altKey && e.shiftKey && e.key.toLowerCase() === 's') {
        // Auto-spacing shortcut: Shift+Alt+S
        e.preventDefault();
        handleAutoSpaceCurrentGlyph('smart');
        return;
      } else if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 's') {
        // Simplify shortcut: Alt+S
        e.preventDefault();
        handleSimplifyCurrentGlyph('normal');
        return;
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'v') setToolMode('select');
        else if (key === 'a') setToolMode('node');
        else if (key === 'p') setToolMode('pen');
        else if (key === 'b') setToolMode('brush');
        else if (key === 'r') setToolMode('ruler');
        else if (key === 'u' || key === 's') setToolMode('rect');
        else if (key === 'o') setToolMode('ellipse');
        else if (key === 'e') setToolMode('eraser');
        else if (key === 'h') setToolMode('hand');
        else if (key === '[') {
          e.preventDefault();
          handleAdjustBrushSize(e.shiftKey ? -10 : -2);
        } else if (key === ']') {
          e.preventDefault();
          handleAdjustBrushSize(e.shiftKey ? 10 : 2);
        } else if (key === '\\') {
          e.preventDefault();
          setShowGridDrawer((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleSelectPrevGlyph,
    handleSelectNextGlyph,
    handleSelectPrevUncompletedGlyph,
    handleSelectNextUncompletedGlyph,
    handleAutoSpaceCurrentGlyph,
    handleSimplifyCurrentGlyph,
    handleAdjustBrushSize,
    showToast,
    isAnyModalOpen,
  ]);

  const isLight = theme === 'light';

  return (
    <div
      className={`flex flex-col h-full w-full overflow-hidden font-sans select-none transition-colors ${
        isLight ? 'bg-[#f7faf8] text-stone-900' : 'dark bg-[#0f1712] text-emerald-100'
      }`}
    >
      {/* Top Main Navigation Bar */}
      <Header
        project={project}
        setProject={setProject}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenTestModal={() => setIsTestModalOpen(true)}
        onOpenFontInfoModal={() => setIsFontInfoModalOpen(true)}
        onOpenTraceModal={() => setIsTraceModalOpen(true)}
        onOpenSvgModal={() => setIsSvgModalOpen(true)}
        onOpenBatchNormalizeModal={() => setIsBatchNormalizeModalOpen(true)}
        onOpenQualityModal={() => setIsQualityModalOpen(true)}
        onOpenGlyphSynthesisModal={() => setIsSynthesisModalOpen(true)}
        onOpenKerningModal={() => setIsKerningModalOpen(true)}
        onOpenRadicalStudio={() => setIsRadicalStudioOpen(true)}
        onToggleRadicals={() => setShowRadicals(!showRadicals)}
        showRadicals={showRadicals}
        onToggleGridDrawer={() => setShowGridDrawer(!showGridDrawer)}
        showGridDrawer={showGridDrawer}
        onToggleMetricsDrawer={() => setShowMetricsDrawer(!showMetricsDrawer)}
        showMetricsDrawer={showMetricsDrawer}
        onToggleZenMode={toggleZenMode}
        isZenMode={isZenMode}
        onApplyHandwritingPreset={handleApplyHandwritingPreset}
        selectedChar={selectedChar}
        selectedUnicode={selectedUnicode}
        theme={theme}
        onToggleTheme={toggleTheme}
        onShowToast={showToast}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col sm:flex-row min-h-0 min-w-0 w-full flex-grow flex-shrink grow shrink relative overflow-hidden isolate">
        {/* Quick expand tab for GlyphGrid when closed (desktop) */}
        {!showGridDrawer && (
          <button
            onClick={() => setShowGridDrawer(true)}
            className={`hidden sm:flex absolute left-13 md:left-14 top-14 z-20 px-2 py-1.5 rounded-r-xl border border-l-0 shadow-md items-center space-x-1 text-xs font-bold transition-all hover:pl-2.5 ${
              isLight
                ? 'bg-white text-emerald-950 border-[#d4e5dc] hover:bg-emerald-50 shadow-emerald-950/5'
                : 'bg-[#18231c] text-emerald-200 border-[#25362b] hover:bg-[#202f26] shadow-black/40'
            }`}
            title="文字一覧（サイドバー）を展開 [ショートカット: []"
          >
            <ChevronRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px]">文字一覧</span>
          </button>
        )}

        {/* Character Matrix Table (Glyph Grid) */}
        <GlyphGrid
          project={project}
          selectedUnicode={selectedUnicode}
          onSelectGlyph={handleSelectGlyph}
          onClearGlyph={handleClearGlyph}
          onCopyGlyph={handleCopyGlyph}
          onPasteGlyph={handlePasteGlyph}
          onDuplicateAsSmallKana={handleDuplicateAsSmallKana}
          onGenerateDakutenTarget={handleGenerateDakutenTarget}
          onOpenGlyphSynthesisModal={() => setIsSynthesisModalOpen(true)}
          onOpenKerningModal={() => setIsKerningModalOpen(true)}
          onOpenQualityModal={() => setIsQualityModalOpen(true)}
          hasClipboard={Boolean(clipboardContours)}
          isOpen={showGridDrawer}
          onClose={() => setShowGridDrawer(false)}
          theme={theme}
          isOverlay={isGridOverlay}
        />

        {/* Vertical Tool Palette */}
        <ToolBar
          toolMode={toolMode}
          setToolMode={setToolMode}
          brushWidth={brushWidth}
          setBrushWidth={handleChangeBrushWidth}
          brushStyle={brushStyle}
          setBrushStyle={handleChangeBrushStyle}
          pressureSensitivity={pressureSensitivity}
          onChangePressureSensitivity={handleChangePressureSensitivity}
          gridSettings={gridSettings}
          setGridSettings={setGridSettings}
          onOpenTraceModal={() => setIsTraceModalOpen(true)}
          onOpenPenPresetsModal={() => setIsPenPresetsModalOpen(true)}
          theme={theme}
        />

        {/* Central Vector Canvas (Bézier, Stylus, Touch, Guides) */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 relative z-0 flex-grow flex-shrink grow shrink overflow-hidden">
          <GlyphCanvas
            contours={currentGlyph.contours || []}
            onChangeContours={handleUpdateContours}
            advanceWidth={currentGlyph.advanceWidth || 1000}
            lsb={currentGlyph.lsb ?? 50}
            onChangeAdvanceWidth={handleUpdateAdvanceWidth}
            onChangeLsb={handleUpdateLsb}
            toolMode={toolMode}
            onSetToolMode={setToolMode}
            brushWidth={brushWidth}
            brushStyle={brushStyle}
            onChangeBrushStyle={handleChangeBrushStyle}
            onChangeBrushWidth={handleChangeBrushWidth}
            pressureSensitivity={pressureSensitivity}
            onChangePressureSensitivity={handleChangePressureSensitivity}
            traceSettings={traceSettings}
            onChangeTraceSettings={setTraceSettings}
            selectedUnicode={selectedUnicode}
            gridSettings={gridSettings}
            onChangeGridSettings={setGridSettings}
            activeChar={selectedChar}
            onSelectPrevGlyph={handleSelectPrevGlyph}
            onSelectNextGlyph={handleSelectNextGlyph}
            onCommitHistory={commitHistory}
            theme={theme}
            onCopyFromChar={handleCopyFromChar}
            onGenerateDakutenTarget={handleGenerateDakutenTarget}
            onToggleGridDrawer={() => setShowGridDrawer(!showGridDrawer)}
            showGridDrawer={showGridDrawer}
            onToggleMetricsDrawer={() => setShowMetricsDrawer(!showMetricsDrawer)}
            showMetricsDrawer={showMetricsDrawer}
            onToggleRadicals={() => setShowRadicals(!showRadicals)}
            showRadicals={showRadicals}
            onToggleZenMode={toggleZenMode}
            isZenMode={isZenMode}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onOpenPenPresetsModal={() => setIsPenPresetsModalOpen(true)}
            isAnyModalOpen={isAnyModalOpen}
          />
        </div>

        {/* Metrics & Transforms Sidebar */}
        <MetricsPanel
          advanceWidth={currentGlyph.advanceWidth || 1000}
          lsb={currentGlyph.lsb ?? 50}
          onChangeAdvanceWidth={handleUpdateAdvanceWidth}
          onChangeLsb={handleUpdateLsb}
          contours={currentGlyph.contours || []}
          onChangeContours={handleUpdateContours}
          onCommitHistory={commitHistory}
          selectedChar={selectedChar}
          selectedUnicode={selectedUnicode}
          isOpen={showMetricsDrawer}
          onClose={() => setShowMetricsDrawer(false)}
          theme={theme}
          isOverlay={isMetricsOverlay}
          onSelectPrevGlyph={handleSelectPrevGlyph}
          onSelectNextGlyph={handleSelectNextGlyph}
          onSelectPrevUncompletedGlyph={handleSelectPrevUncompletedGlyph}
          onSelectNextUncompletedGlyph={handleSelectNextUncompletedGlyph}
          onAutoSpaceGlyph={handleAutoSpaceCurrentGlyph}
          onSimplifyGlyph={handleSimplifyCurrentGlyph}
          onShowToast={showToast}
        />

        {/* Kanji Radicals Slide-over Drawer */}
        <RadicalsDrawer
          isOpen={showRadicals}
          onClose={() => setShowRadicals(false)}
          onInsertRadical={handleInsertRadical}
          currentContours={currentGlyph.contours || []}
          selectedChar={selectedChar}
          allGlyphs={project.glyphs}
          theme={theme}
          onOpenRadicalStudio={() => {
            setShowRadicals(false);
            setIsRadicalStudioOpen(true);
          }}
        />
      </div>

      {/* Mobile Bottom Navigation Bar (< 640px) */}
      <div
        className={`flex sm:hidden items-center justify-around py-1 px-2 border-t shrink-0 z-30 select-none pb-[max(env(safe-area-inset-bottom),6px)] ${
          isLight
            ? 'bg-white/95 border-[#d8e6df] text-stone-700 backdrop-blur-md shadow-lg'
            : 'bg-[#121a14]/95 border-[#25362b] text-emerald-200 backdrop-blur-md shadow-lg'
        }`}
      >
        <button
          onClick={() => {
            setShowGridDrawer(!showGridDrawer);
            setShowMetricsDrawer(false);
          }}
          className={`flex flex-col items-center py-1 px-2.5 rounded-md transition-colors ${
            showGridDrawer
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 font-bold'
                : 'bg-emerald-950 text-emerald-300 font-bold'
              : ''
          }`}
        >
          <Grid className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">文字一覧</span>
        </button>

        <button
          onClick={() => {
            setShowGridDrawer(false);
            setShowMetricsDrawer(false);
          }}
          className={`flex flex-col items-center py-1 px-2.5 rounded-md transition-colors ${
            !showGridDrawer && !showMetricsDrawer
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 font-bold'
                : 'bg-emerald-950 text-emerald-300 font-bold'
              : ''
          }`}
        >
          <Paintbrush className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">作図</span>
        </button>

        <button
          onClick={() => {
            setShowMetricsDrawer(!showMetricsDrawer);
            setShowGridDrawer(false);
          }}
          className={`flex flex-col items-center py-1 px-2.5 rounded-md transition-colors ${
            showMetricsDrawer
              ? isLight
                ? 'bg-emerald-100 text-emerald-950 font-bold'
                : 'bg-emerald-950 text-emerald-300 font-bold'
              : ''
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">メトリクス</span>
        </button>

        <button
          onClick={() => setIsTestModalOpen(true)}
          className="flex flex-col items-center py-1 px-2.5 rounded-md hover:bg-emerald-50 dark:hover:bg-[#1a251e] transition-colors"
        >
          <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] mt-0.5">組版テスト</span>
        </button>

        <div className="flex items-center space-x-1 pl-2 border-l border-stone-200 dark:border-stone-800">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800"
            title="取り消し"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800"
            title="やり直し"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modals */}
      <TestPreviewModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        project={project}
        setProject={setProject}
        theme={theme}
        onShowToast={showToast}
      />

      <FontInfoModal
        isOpen={isFontInfoModalOpen}
        onClose={() => setIsFontInfoModalOpen(false)}
        project={project}
        setProject={setProject}
        theme={theme}
        onShowToast={showToast}
      />

      <TraceSettingsModal
        isOpen={isTraceModalOpen}
        onClose={() => setIsTraceModalOpen(false)}
        traceSettings={traceSettings}
        setTraceSettings={setTraceSettings}
        activeChar={selectedChar}
        selectedUnicode={selectedUnicode}
        theme={theme}
        onShowToast={showToast}
      />

      <SvgVectorizerModal
        isOpen={isSvgModalOpen}
        onClose={() => setIsSvgModalOpen(false)}
        onApplyContours={handleApplySvgContours}
        selectedChar={selectedChar}
        theme={theme}
        onShowToast={showToast}
      />

      <BatchNormalizeModal
        isOpen={isBatchNormalizeModalOpen}
        onClose={() => setIsBatchNormalizeModalOpen(false)}
        project={project}
        setProject={setProject}
        selectedUnicode={selectedUnicode}
        theme={theme}
        onShowToast={showToast}
      />

      <FontQualityModal
        isOpen={isQualityModalOpen}
        onClose={() => setIsQualityModalOpen(false)}
        project={project}
        setProject={setProject}
        onSelectGlyph={(unicode) => {
          const g = project.glyphs?.[unicode];
          const char = g?.char || String.fromCodePoint(unicode);
          handleSelectGlyph(unicode, char);
        }}
        theme={theme}
        onShowToast={showToast}
        commitHistory={commitHistory}
      />

      <GlyphSynthesisModal
        isOpen={isSynthesisModalOpen}
        onClose={() => setIsSynthesisModalOpen(false)}
        project={project}
        setProject={setProject}
        onUpdateProject={setProject}
        theme={theme}
        onShowToast={showToast}
        showToast={showToast}
      />

      <KerningModal
        isOpen={isKerningModalOpen}
        onClose={() => setIsKerningModalOpen(false)}
        project={project}
        setProject={setProject}
        onUpdateProject={setProject}
        theme={theme}
        onShowToast={showToast}
        showToast={showToast}
      />

      <RadicalStudioModal
        isOpen={isRadicalStudioOpen}
        onClose={() => setIsRadicalStudioOpen(false)}
        project={project}
        selectedChar={selectedChar}
        selectedUnicode={selectedUnicode}
        onInsertToCurrentGlyph={handleInsertRadical}
        onBatchInsertToGlyphs={handleBatchInsertRadical}
        theme={theme}
        onShowToast={showToast}
      />

      <PenPresetsModal
        isOpen={isPenPresetsModalOpen}
        onClose={() => setIsPenPresetsModalOpen(false)}
        currentParams={{
          brushStyle,
          brushWidth,
          pressureSensitivity,
          autoSmoothBrush,
          smoothStrength,
          smoothPreserveCorners,
          autoUnionBrush,
        }}
        onApplyPreset={handleApplyPenPreset}
        presets={penPresets}
        onUpdatePresets={setPenPresets}
        theme={theme}
      />

      {/* Floating Toast Notification System */}
      <Toast toasts={toasts} onDismiss={dismissToast} theme={theme} />
    </div>
  );
}
