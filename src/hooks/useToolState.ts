import { useState, useCallback } from 'react';
import {
  ToolMode,
  BrushStyle,
  PressureCurveConfig,
  UserPenPreset,
} from '../types';
import {
  DEFAULT_PRESSURE_CURVES,
  DEFAULT_PEN_PRESETS,
  loadStickyBrushConfigs,
  saveStickyBrushConfig,
  loadUserPenPresets,
} from '../utils/presetData';

export function useToolState() {
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
  const [pressureCurve, setPressureCurve] = useState<PressureCurveConfig>(() => {
    const saved = loadStickyBrushConfigs();
    return saved.brush?.pressureCurve ?? DEFAULT_PRESSURE_CURVES.soft;
  });
  const [smoothingIntensity, setSmoothingIntensity] = useState<number>(() => {
    const saved = loadStickyBrushConfigs();
    return saved.brush?.smoothingIntensity ?? 50;
  });

  // Advanced Writing Feeling Parameters
  const [autoSmoothBrush, setAutoSmoothBrush] = useState<boolean>(true);
  const [smoothStrength, setSmoothStrength] = useState<'mild' | 'standard' | 'strong'>('standard');
  const [smoothPreserveCorners, setSmoothPreserveCorners] = useState<boolean>(true);
  const [autoUnionBrush, setAutoUnionBrush] = useState<boolean>(() => {
    const saved = loadStickyBrushConfigs();
    return saved.brush?.autoUnionBrush ?? true;
  });

  // User Writing Presets
  const [penPresets, setPenPresets] = useState<UserPenPreset[]>(() => loadUserPenPresets());
  const [activePenPreset, setActivePenPreset] = useState<UserPenPreset | undefined>(() => {
    const loaded = loadUserPenPresets();
    return loaded[0] || DEFAULT_PEN_PRESETS[0];
  });
  const [isPenPresetsModalOpen, setIsPenPresetsModalOpen] = useState<boolean>(false);

  // Sticky Brush Settings: Change style and automatically restore saved parameters
  const handleChangeBrushStyle = useCallback((newStyle: BrushStyle) => {
    setActivePenPreset(undefined);
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
      if (targetConfig.pressureCurve) {
        setPressureCurve(targetConfig.pressureCurve);
      }
      if (typeof targetConfig.smoothingIntensity === 'number') {
        setSmoothingIntensity(targetConfig.smoothingIntensity);
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

  const handleChangePressureCurve = useCallback((newCurve: PressureCurveConfig) => {
    setPressureCurve(newCurve);
    saveStickyBrushConfig(brushStyle, { pressureCurve: newCurve });
  }, [brushStyle]);

  const handleChangeSmoothingIntensity = useCallback((newIntensity: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newIntensity)));
    setSmoothingIntensity(clamped);
    saveStickyBrushConfig(brushStyle, { smoothingIntensity: clamped });
  }, [brushStyle]);

  // Adjust brush size via [ / ] keys
  const handleAdjustBrushSize = useCallback((delta: number) => {
    setBrushWidth((current: number) => {
      const next = Math.max(2, Math.min(200, current + delta));
      saveStickyBrushConfig(brushStyle, { brushWidth: next });
      return next;
    });
  }, [brushStyle]);

  const handleApplyPenPreset = useCallback((preset: UserPenPreset) => {
    setActivePenPreset(preset);
    setBrushStyle(preset.brushStyle);
    setBrushWidth(preset.brushWidth);
    setPressureSensitivity(preset.pressureSensitivity);
    if (preset.pressureCurve) {
      setPressureCurve(preset.pressureCurve);
    }
    if (typeof preset.smoothingIntensity === 'number') {
      setSmoothingIntensity(preset.smoothingIntensity);
    }
    setAutoSmoothBrush(preset.autoSmoothBrush);
    setSmoothStrength(preset.smoothStrength);
    setSmoothPreserveCorners(preset.smoothPreserveCorners);
    setAutoUnionBrush(preset.autoUnionBrush);
    saveStickyBrushConfig(preset.brushStyle, {
      brushWidth: preset.brushWidth,
      pressureSensitivity: preset.pressureSensitivity,
      pressureCurve: preset.pressureCurve,
      smoothingIntensity: preset.smoothingIntensity,
      autoSmoothBrush: preset.autoSmoothBrush,
      smoothStrength: preset.smoothStrength,
      smoothPreserveCorners: preset.smoothPreserveCorners,
      autoUnionBrush: preset.autoUnionBrush,
    });
  }, []);

  return {
    toolMode,
    setToolMode,
    brushStyle,
    setBrushStyle,
    brushWidth,
    setBrushWidth,
    pressureSensitivity,
    setPressureSensitivity,
    pressureCurve,
    setPressureCurve,
    smoothingIntensity,
    setSmoothingIntensity,
    autoSmoothBrush,
    setAutoSmoothBrush,
    smoothStrength,
    setSmoothStrength,
    smoothPreserveCorners,
    setSmoothPreserveCorners,
    autoUnionBrush,
    setAutoUnionBrush,
    penPresets,
    setPenPresets,
    activePenPreset,
    setActivePenPreset,
    isPenPresetsModalOpen,
    setIsPenPresetsModalOpen,
    handleChangeBrushStyle,
    handleChangeBrushWidth,
    handleChangePressureSensitivity,
    handleChangePressureCurve,
    handleChangeSmoothingIntensity,
    handleAdjustBrushSize,
    handleApplyPenPreset,
  };
}
